import type { RequestHandler } from './$types';
import { prisma } from "$lib/db/client";
import type { Prisma } from "@prisma/client";
import { error } from '@sveltejs/kit';
import type { IWeblog } from '$lib/helpers/api.d'
import { logger } from '$lib/logging/client';
import { sendMail, createEmail } from "$lib/email";

export const POST: RequestHandler = async ({ request, fetch }) => {
    const workflow: IWeblog = await request.json();
    if (!workflow) {
        return error(400, { message: "Nextflow sent an empty POST message." })
    } else {
        const file = await prisma.file.findFirst({
            where: {
                externalId: workflow.runName
            },
            select: { 
                id: true, 
                externalId: true, 
                filename: true,
                User: {
                    select: {
                        email: true,
                    }
                }
            },
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
                    try {
                        const failed = await prisma.file.update({
                            data: { state: "PROCESSING_ERROR" },
                            where: {
                                id: updatedWf.file_id,
                            },
                            select: {
                                uploader: true,
                            }
                        });
                        await sendMail({
                            to: file.User.email,
                            subject: "Transkribeerimine ebaõnnestus - tekstiks.ee",
                            html: createEmail(`Teenusel tekstiks.ee ei õnnestunud teie faili paraku transkribeerida.
                            \n\n
                            Rikete kohta võib infot saada kasutajatoelt, kirjutades aadressile tugi@tekstiks.ee
                            \n\n
                            <a href="https://tekstiks.ee/files">Klõpsa siia, et tutvuda oma ülesse laaditud failidega.</a>`)
                        });
                        await prisma.file.update({
                            data: {
                                notified: true,
                            },
                            where: {
                                id: updatedWf.file_id,
                            }
                        });
                    }
                    catch(e) {
                        console.log("Saving failed transcription or sending email notification failed", e);
                    }
                }
                else if (workflow.event === "completed" && workflow.metadata.workflow.stats.succeededCount == workflow.metadata.workflow.stats.progressLength) {
                    try {
                        const failed = await prisma.file.update({
                            data: { state: "READY" },
                            where: {
                                id: updatedWf.file_id,
                            },
                            select: {
                                uploader: true,
                            }
                        });
                        await sendMail({
                            to: file.User.email,
                            subject: "Transkribeerimine õnnestus - tekstiks.ee",
                            html: createEmail(`Teie faili nimega ${file.filename} transkribeerimine õnnestus!
                            \n\n
                            <a href="https://tekstiks.ee/files/${file.id}">Tuvastatud tekst asub siin.</a>`)
                        });
                        await prisma.file.update({
                            data: {
                                notified: true,
                            },
                            where: {
                                id: updatedWf.file_id,
                            }
                        });
                    }
                    catch(e) {
                        console.log("Saving successful transcription result or sending email notification failed", e);
                    }
                }
            }
            catch(e) {
                console.log("save NF info to db failed", e);
            }
        }
        return new Response("received", { status: 200 });
    }
};