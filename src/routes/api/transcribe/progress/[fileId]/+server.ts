import type { RequestHandler } from "./$types";
import { prisma } from "$lib/db/client";
import { error, json } from '@sveltejs/kit';;
import { NEXTFLOW_PATH, PIPELINE_DIR, EST_ASR_URL, RESULTS_DIR } from '$env/static/private';
import { runNextflow } from "../../helpers";
import { v4 as uuidv4 } from 'uuid';
import path from "path";

export const GET: RequestHandler = async ({ locals, params }) => {
    console.log("Progress request")
    let userId = locals.userId;
    if (!userId) {
        let session = await locals.getSession();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId) {
        throw error(401, "Not authenticated user");
    }
    const progress = await prisma.file.findUnique({
        where: {
            id: params.fileId
        },
        include: {
            workflows: {
                select: {
                    utc_time: true,
                    event: true,
                    run_id: true,
                }
            }
        }
    }).catch(e => {
        console.log("Error connecting to DB to find file", params.fileId);
        json({ done: false }, { status: 200 });
    })
    if (!progress) {
        return json({}, { status: 404 });
    }
    const workflow = progress.workflows.reduce((acc, wf) => {
        if (wf.event !== "error") {
            return { status: wf.event, run_id: wf.run_id, utc_time: wf.utc_time};
        } 
        else if (wf.event === "error" && !acc.status) return { status: "error", run_id: wf.run_id, utc_time: wf.utc_time}
        else return acc;
    }, { status: null, run_id: null, utc_time: null});
    if ( workflow.status === "error" ) return json({ done: true, success: false, wf_id: workflow.run_id }, { status: 200 });
    if ( workflow.status === "completed" ) return json({ done: true, success: true, wf_id: workflow.run_id }, { status: 200 });
    if (workflow.utc_time) {
        // retry
        const hours = (new Date().getTime() - workflow.utc_time.getTime()) / 3600000;
        if (hours > 4) {
            // Change run name as it has to be unique.
            let id: string = uuidv4();
            id = id.replace(/[-]/gi, '').substr(0, 30)
            const increaseAscii = (char: string) => {
                const ascii = char.charCodeAt(0);
                if (ascii <= 57) {
                return String.fromCharCode(ascii + 60);
                } else return char;
            };
            const externalId = Array.from(id)
                .map(increaseAscii)
                .join("");
            await prisma.file.update({
                where: {
                    id: params.fileId
                },
                data: {
                    externalId: externalId
                }
            }).catch(e => console.log("Failed to update file externalId. FileId:", params.fileId))
            console.log("resuming workflow", externalId);
            const resultPath = path.join(RESULTS_DIR, userId);
            const processSpawned = runNextflow(params.fileId, progress.path, externalId, resultPath, true, true, true, PIPELINE_DIR, EST_ASR_URL, NEXTFLOW_PATH, true)
            return json({ done: false }, { status: 200 })
        }
        // return progress and queue size
        const latestProgress = await prisma.nfWorkflow.findUnique({
            where: { run_id: workflow.run_id},
            include: {
                processes: {
                    orderBy: {
                        task_id: 'desc'
                    },
                    take: 1
                }
            }
        });
        let progressPercentage = 0;
        if ( latestProgress && latestProgress.processes && latestProgress.processes[0] && latestProgress.processes[0].task_id ) progressPercentage = Math.round((latestProgress.processes[0].task_id / 13) * 100);
        // TODO: separate this query to only run sometimes or cache in memory
        const queued = await prisma.file.count({
            where: {
                state: {
                    notIn: ["READY", "ERROR"]
                }
            }
        });
        return json({ done: false, queued: queued, progress: progressPercentage, wf_id: workflow.run_id  }, { status: 200 })
    }
    // Should only happen when no Nextflow events have yet been received and there are no workflows.
    return json({ done: false }, { status: 200 })
}