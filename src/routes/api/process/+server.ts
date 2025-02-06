import type { RequestHandler } from './$types';
import { prisma } from "$lib/db/client";
import type { Prisma } from "@prisma/client";
import { error } from '@sveltejs/kit';
import type { IWeblog } from '$lib/helpers/api.d'
import { logger } from '$lib/logging/client';

export const POST: RequestHandler = async ({ request, fetch }) => {
    const workflow: IWeblog = await request.json();
    if (!workflow) {
        return error(400, { message: "Nextflow sent an empty POST message." })
    } else {
        const file = await prisma.file.findFirst({
            where: {
                externalId: workflow.runName
            },
            select: { id: true, externalId: true }
        });
        // trace is only provided for the following events: process_submitted, process_started, process_completed, error
        if (workflow.trace) {
            await prisma.nfWorkflow.upsert({
                where: {
                    run_name: file.externalId
                },
                create: {
                    run_id: workflow.runId,
                    event: workflow.event,
                    run_name: workflow.runName,
                    file: {
                        connect: {
                            id: file.id
                        }
                    },
                    utc_time: new Date(workflow.utcTime),
                    processes: {
                        create: {
                            task_id: workflow.trace.task_id,
                            process: workflow.trace.process,
                            tag: workflow.trace.tag,
                            hash: workflow.trace.hash,
                            status: workflow.trace.status,
                            exit: workflow.trace.exit ? new Date(workflow.trace.exit) : null,
                            submit: workflow.trace.submit ? new Date(workflow.trace.submit) : null,
                            start: workflow.trace.start ? new Date(workflow.trace.start) : null,
                            complete: workflow.trace.complete ? new Date(workflow.trace.complete) : null,
                            duration: workflow.trace.duration,
                            realtime: workflow.trace.realtime,
                        }
                    }
                },
                update: {
                    run_id: workflow.runId,
                    // event: workflow.event,  Avoid overwriting the workflow status / event
                    run_name: workflow.runName,
                    file: {
                        connect: {
                            id: file.id
                        }
                    },
                    utc_time: new Date(workflow.utcTime),
                    processes: {
                        create: {
                            task_id: workflow.trace.task_id,
                            process: workflow.trace.process,
                            tag: workflow.trace.tag,
                            hash: workflow.trace.hash,
                            status: workflow.trace.status,
                            exit: workflow.trace.exit ? new Date(workflow.trace.exit) : null,
                            submit: workflow.trace.submit ? new Date(workflow.trace.submit) : null,
                            start: workflow.trace.start ? new Date(workflow.trace.start) : null,
                            complete: workflow.trace.complete ? new Date(workflow.trace.complete) : null,
                            duration: workflow.trace.duration,
                            realtime: workflow.trace.realtime,
                        }
                    }
                }
            }).catch(e => console.log("save NF info to db failed", e))
            
        } 
        else if (workflow.event === "error") {
            await prisma.nfWorkflow.upsert({
                where: {
                    run_name: file.externalId
                },
                create: {
                    run_id: workflow.runId,
                    event: workflow.event,
                    run_name: workflow.runName,
                    file: {
                        connect: {
                            id: file.id
                        }
                    },
                    utc_time: new Date(workflow.utcTime),
                    failedCount: 1,
                },
                update: {
                    run_id: workflow.runId,
                    event: workflow.event,
                    run_name: workflow.runName,
                    file: {
                        connect: {
                            id: file.id
                        }
                    },
                    utc_time: new Date(workflow.utcTime),
                    failedCount: 1,
                }
            }).catch(e => console.log("save NF info to db failed", e))
        }
        // metadata is only provided for the following events: started, completed
        else if (workflow.metadata) {
            try {
                const updatedWf = await prisma.nfWorkflow.upsert({
                    where: {
                        run_name: file.externalId
                    },
                    create: {
                        run_id: workflow.runId,
                        event: workflow.event,
                        run_name: workflow.runName,
                        file: {
                            connect: {
                                id: file.id
                            }
                        },
                        utc_time: new Date(workflow.utcTime),
                        succeededCount: workflow.metadata.workflow.stats.succeededCount,
                        runningCount: workflow.metadata.workflow.stats.runningCount,
                        pendingCount: workflow.metadata.workflow.stats.pendingCount,
                        failedCount: workflow.metadata.workflow.stats.failedCount,
                        progressLength: workflow.metadata.workflow.stats.progressLength,
                    },
                    update: {
                        run_id: workflow.runId,
                        event: workflow.event,
                        run_name: workflow.runName,
                        file: {
                            connect: {
                                id: file.id
                            }
                        },
                        utc_time: new Date(workflow.utcTime),
                        succeededCount: workflow.metadata.workflow.stats.succeededCount,
                        runningCount: workflow.metadata.workflow.stats.runningCount,
                        pendingCount: workflow.metadata.workflow.stats.pendingCount,
                        failedCount: workflow.metadata.workflow.stats.failedCount,
                        progressLength: workflow.metadata.workflow.stats.progressLength,
                    },
                    select: {
                        file_id: true,
                    }
                })
                if (workflow.metadata.workflow.stats.failedCount > 0){
                    await prisma.file.update({
                        data: { state: "PROCESSING_ERROR" },
                        where: {
                            id: updatedWf.file_id,
                        },
                    });
                }
                else if (workflow.event === "completed" && workflow.metadata.workflow.stats.succeededCount == workflow.metadata.workflow.stats.progressLength) {
                    await prisma.file.update({
                        data: {
                            state: "READY",
                        },
                        where: {
                            id: updatedWf.file_id,
                        },
                    });
                }
            }
            catch(e) {
                console.log("save NF info to db failed", e);
            }
        }
        return new Response("received", { status: 200 });
    }
};

/* // Request successful
if (progressRequest.status === 200) {
    const progress = await progressRequest.json();
    // Transcription is in progress
    if (!progress.done) {
        logger.info({userId, message: `progress: ${progress.progress}, queued: ${progress.queued}`})
        return {
            done: false,
            fileId,
            progress: progress.progress,
            status: (progress.progress === 0 ? "UPLOADED" : "PROCESSING"),
            queued: progress.queued
        };
    } // Transe.log(
            `Failed to transcribe ${fileId}. Failed with code`,
            progress.errorCode,
            progress.errorMessage,
        );
        await unlink(filePath);
        return { done: true };
    }
} else if (
    progressRequest.status === 400 || progressRequest.status === 404
) {
    const progress = await progressRequest.json();
    await prisma.file.update({
        data: { state: "PROCESSING_ERROR" },
        where: {
            id: fileId,
        },
    });
    console.log(
        `Failed to transcribe ${fileId}. Failed with code`,
        progress.errorCode,
        progress.errorMessage,
    );
    await unlink(filePath);
    return { done: true };cription finished and succesfully
    else if (progress.done && progress.success) {
        await prisma.file.update({
            data: {
                state: "READY",
            },
            where: {
                id: fileId,
            },
        });
        return { done: true };
    } else if ((progress.done && !progress.success)) {
        await prisma.file.update({
            data: { state: "PROCESSING_ERROR" },
            where: {
                id: fileId,
            },
        });
        console.log(
            `Failed to transcribe ${fileId}. Failed with code`,
            progress.errorCode,
            progress.errorMessage,
        );
        await unlink(filePath);
        return { done: true };
    }
} else if (
    progressRequest.status === 400 || progressRequest.status === 404
) {
    const progress = await progressRequest.json();
    await prisma.file.update({
        data: { state: "PROCESSING_ERROR" },
        where: {
            id: fileId,
        },
    });
    console.log(
        `Failed to transcribe ${fileId}. Failed with code`,
        progress.errorCode,
        progress.errorMessage,
    );
    await unlink(filePath);
    return { done: true }; */