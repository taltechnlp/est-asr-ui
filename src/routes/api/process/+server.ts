import type { RequestHandler } from './$types';
import { prisma } from "$lib/db/client";
import type { Prisma } from "@prisma/client";
import { error } from '@sveltejs/kit';
import type { IWeblog } from '$lib/helpers/api.d'
import { logger } from '$lib/logging/client';

export const POST: RequestHandler = async ({ request, fetch }) => {
    const workflow: IWeblog = await request.json();
    console.log("received workflow", workflow)
    if (!workflow) {
        return error(400, { message: "Nextflow sent an empty POST message." })
    } else {
        const file = await prisma.file.findFirst({
            where: {
                externalId: workflow.runName
            },
            select: { id: true, externalId: true }
        });
        console.log("fail on:", file)
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
                            // container:
                            //native_id: 
                            // cpu
                            // mem
                            // peak_rss
                            // peak_vmem
                            // rchar
                            // wchar
                            // vol_ctxt
                            // inv_ctxt
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
                            // container:
                            //native_id: 
                            duration: workflow.trace.duration,
                            realtime: workflow.trace.realtime,
                            // cpu
                            // mem
                            // peak_rss
                            // peak_vmem
                            // rchar
                            // wchar
                            // vol_ctxt
                            // inv_ctxt

                        }
                    }
                }
            }).catch(e => console.log("save NF info to db failed", e))
            
        } // metadata is only provided for the following events: started, completed
        else if (workflow.metadata) {
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
                }
            }).catch(e => console.log("save NF info to db failed", e))
        }
        return new Response("received", { status: 200 })
    }
};