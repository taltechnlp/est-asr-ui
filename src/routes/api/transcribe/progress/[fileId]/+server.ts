import type { RequestHandler } from "./$types";
import { prisma } from "$lib/db/client";
import { error, json } from '@sveltejs/kit';;

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