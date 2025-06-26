import { unlink } from "fs/promises";
import { prisma } from "$lib/db/client";
import { createWriteStream, stat } from "fs";
import { promises as fs } from 'fs';
import path from "path";
import type {
    EditorContent,
    FinAsrFinished,
    FinAsrResult,
    SectionType,
} from "./api.d";
import { FIN_ASR_RESULTS_URL } from "$env/static/private";
// import { logger } from "../logging/client";

let finToEstFormat: (sucRes: FinAsrFinished) => EditorContent = function (
    sucRes: FinAsrFinished,
) {
    const result = {
        speakers: {
            S1: {
                name: "S1",
            },
        },
        sections: [{
            start: 0,
            end: 0,
            type: "non-speech" as SectionType,
        }],
    };
    if (
        sucRes.result && sucRes.result.sections && sucRes.result.sections.length > 0
    ) {
        result.sections = sucRes.result.sections.map(
            (seg) => {
                return {
                    start: seg.start,
                    end: seg.end,
                    type: "speech" as SectionType,
                    turns: [{
                        start: seg.start,
                        end: seg.end,
                        speaker: "S1",
                        transcript: seg.transcript,
                        unnormalized_transcript: seg.transcript,
                        words: seg.words.map((w) => {
                            return {
                                confidence: 1,
                                start: w.start + seg.start,
                                end: w.end + seg.start,
                                punctuation: "",
                                word: w.word,
                                word_with_punctuation: w.word,
                            };
                        }),
                    }],
                };
            },
        );
    }

    return result;
};

export const checkCompletion = async (
    fileId: string,
    state: string,
    externalId: string,
    filePath: string,
    language: string,
    initialTranscriptionPath: string,
    fetch: Function
): Promise<{ done: boolean }> => {
    if (language === "finnish") {
        const result = await fetch(FIN_ASR_RESULTS_URL, {
            method: "POST",
            body: externalId,
        }).catch(() => {
            console.error("Post failed to", FIN_ASR_RESULTS_URL, externalId);
            return { done: false };
        });
        if (!result) return { done: false };
        const body: FinAsrResult = await result.json();
        if (!body) return { done: false };
        if (!body.done) {
            return { done: false };
        } // Error case
        else if (body.error) {
            await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                    id: fileId,
                },
            });
            console.log(
                `Failed to transcribe ${fileId}. Failed with code ${body.error.code}, ${body.error.message}`
            );
            await unlink(filePath);
            return { done: true };
        } else if (body) {
            const formatted = finToEstFormat(body);
            const text = JSON.stringify(formatted);
            
            // Ensure parent directory exists
            const parentDir = path.dirname(initialTranscriptionPath);
            try {
                await fs.mkdir(parentDir, { recursive: true });
            } catch (err) {
                console.error('Error creating directory:', err);
                await prisma.file.update({
                    data: { state: "PROCESSING_ERROR" },
                    where: { id: fileId },
                });
                return { done: true };
            }

            const writeStream = createWriteStream(initialTranscriptionPath);
            writeStream.on("error", async (err) => {
                console.error("Error writing file:", err);
                await prisma.file.update({
                    data: { state: "PROCESSING_ERROR" },
                    where: { id: fileId },
                });
            });
            writeStream.on("finish", async function () {
                await prisma.file.update({
                    data: {
                        initialTranscriptionPath,
                        state: "READY", 
                    },
                    where: {
                        id: fileId,
                    },
                });
            });
            writeStream.write(text);
            writeStream.end();
            // Pre-generate waveform peaks
            // await generatePeaks(fileId);
            return { done: true };
        }
    }
    else {
        return { done: true };
    }
};

/**
 * Debug utility to analyze workflow events and progress
 */
export const debugWorkflowProgress = async (fileId: string) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: fileId },
            include: {
                workflows: {
                    orderBy: { utc_time: 'desc' },
                    include: {
                        processes: {
                            orderBy: { submit: 'desc' }
                        }
                    }
                }
            }
        });

        if (!file) {
            console.log(`[DEBUG] File ${fileId} not found`);
            return null;
        }

        console.log(`[WORKFLOW DEBUG] Analysis for file: ${file.filename}`, {
            fileId: file.id,
            externalId: file.externalId,
            state: file.state,
            workflowCount: file.workflows.length,
            workflows: file.workflows.map(wf => ({
                runId: wf.run_id,
                event: wf.event,
                utcTime: wf.utc_time,
                progressLength: wf.progressLength,
                succeededCount: wf.succeededCount,
                runningCount: wf.runningCount,
                pendingCount: wf.pendingCount,
                failedCount: wf.failedCount,
                processCount: wf.processes.length,
                processes: wf.processes.map(p => ({
                    taskId: p.task_id,
                    process: p.process,
                    status: p.status,
                    tag: p.tag
                }))
            }))
        });

        return file;
    } catch (error) {
        console.error(`[DEBUG ERROR] Failed to analyze workflow for file ${fileId}:`, error);
        return null;
    }
};

export const getFiles = async (id) => {
    		const user = await prisma.user.findUnique({
        where: {
            id: id
        },
        include: {
            files: {
                orderBy: {
                    uploadedAt: "desc",
                },
                select: {
                    id: true,
                    state: true,
                    text: true,
                    filename: true,
                    duration: true,
                    mimetype: true,
                    uploadedAt: true,
                    textTitle: true,
                    initialTranscription: true,
                    externalId: true,
                    path: true,
                    language: true,
                    initialTranscriptionPath: true,
                    workflows: {
                        take: 1, 
                        select: {
                            progressLength: true,
                            succeededCount: true,
                            runningCount: true,
                            pendingCount: true,
                            failedCount: true,
                            event: true,
                            processes: {
                                select: {
                                    status: true,
                                }
                            }
                        }
                    }
                },
            },
        },
    });
    if (user) return Promise.all(user.files.map(
        async file => {
            let progress = -1;
            let status = file.state;
            if (file.state !== "READY" && file.state !== "ABORTED" && file.state !== "PROCESSING_ERROR") {
                if (file.language === "finnish") {
                    await checkCompletion(file.id, file.state, file.externalId, file.path, file.language, file.initialTranscriptionPath, fetch);
                }
                
                // Improved progress calculation using actual workflow statistics
                if (file.workflows && file.workflows.length > 0) {
                    const workflow = file.workflows[0];

                    // Method 1: Use workflow statistics if available (most accurate)
                    if (workflow.progressLength && workflow.progressLength > 0) {
                        const totalProcesses = workflow.progressLength;
                        const completedProcesses = (workflow.succeededCount || 0) + (workflow.failedCount || 0);
                        progress = Math.min(100, Math.floor((completedProcesses / totalProcesses) * 100));
                    }
                    // Method 2: Fallback to process count estimation
                    else if (workflow.processes && workflow.processes.length > 0) {
                        // Estimate total processes based on completed ones
                        const completedProcesses = workflow.processes.filter(p => 
                            p.status === 'COMPLETED' || p.status === 'ERROR' || p.status === 'FAILED'
                        ).length;
                        const totalProcesses = workflow.processes.length;
                        
                        // Use a more realistic estimation based on typical workflow patterns
                        // Most workflows have a predictable number of processes per file
                        const estimatedTotal = Math.max(totalProcesses, 20); // Minimum reasonable estimate
                        progress = Math.min(100, Math.floor((completedProcesses / estimatedTotal) * 100));
                    }
                    // Method 3: Event-based estimation
                    else if (workflow.event) {
                        const eventProgress = {
                            'started': 10,
                            'process_submitted': 20,
                            'process_started': 30,
                            'process_completed': 80,
                            'completed': 100,
                            'error': 0
                        };
                        progress = eventProgress[workflow.event] || 0;
                    }
                    
                    // Ensure progress doesn't exceed 100%
                    progress = Math.min(100, Math.max(0, progress));
                }
            }
            return {
                id: file.id,
                state: file.state,
                text: file.text,
                filename: file.filename,
                duration: file.duration?.toNumber(),
                mimetype: file.mimetype,
                uploadedAt: file.uploadedAt?.toString(),
                textTitle: file.textTitle,
                initialTranscription: file.initialTranscription,
                externalId: file.externalId,
                path: file.path,
                language: file.language,
                userId: user.id,
                progress
            }
        }
    ));
    else return [];
};
