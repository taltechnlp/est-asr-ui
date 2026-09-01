import { prisma } from "$lib/db/client";
import { ASR_BACKEND } from "$env/static/private";
import { checkCompletion } from "$lib/helpers/api";

// Background poller for in-flight ASR jobs.
//
// Transcription runs on external services: Finnish goes to kielipankki at
// upload time, Estonian to the Ray cluster. In both cases completion is
// discovered by polling, and historically that poll only ran inside `getFiles`,
// i.e. only while the owning user had their files page open. A user who
// uploaded and closed the tab left the job un-polled:
//
//   - Finnish: the remote purges finished jobs after a while, so the file could
//     get stuck in UPLOADED forever (remote later returns "job id not found").
//   - Estonian: a submit that fails because the Ray head is down (a cluster
//     restart, say) leaves the file in UPLOADED with no job at all, and a job
//     that succeeds while the user is away leaves the file in PROCESSING with
//     the finished transcript sitting unclaimed in the Ray job store.
//
// This module polls those jobs server-side, independent of any open page.
// `checkCompletion` handles the per-language differences, including resubmitting
// an Estonian file that never got a Ray job.

const POLL_INTERVAL_MS = 60_000;

// Estonian is only pollable on the Ray backend; the Nextflow path reports
// completion by POSTing to /api/process instead.
const polledLanguages = ["finnish", ...(ASR_BACKEND === "ray" ? ["estonian"] : [])];

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function pollOnce(): Promise<void> {
    // Guard against overlapping ticks (a slow remote could make one tick
    // outlast the interval).
    if (running) return;
    running = true;
    try {
        const files = await prisma.file.findMany({
            // UPLOADED = submitted, not yet confirmed in-flight; PROCESSING =
            // remote acknowledged and transcribing. Both need polling until they
            // reach a terminal state (READY / PROCESSING_ERROR).
            where: {
                language: { in: polledLanguages },
                state: { in: ["UPLOADED", "PROCESSING"] },
            },
            select: {
                id: true,
                state: true,
                externalId: true,
                path: true,
                language: true,
                initialTranscriptionPath: true,
                duration: true,
            },
        });
        if (files.length === 0) return;
        for (const file of files) {
            // Without somewhere to write the result there is nothing useful to
            // do; leave it for the page to surface (a missing path means a
            // malformed record). Finnish additionally needs the remote job id —
            // it has no way to resubmit — whereas an Estonian file with no
            // usable Ray job id is exactly the case `checkCompletion` recovers
            // by submitting a fresh job off `path`.
            if (!file.initialTranscriptionPath) continue;
            if (file.language === "finnish" && !file.externalId) continue;
            try {
                await checkCompletion(
                    file.id,
                    file.state,
                    file.externalId,
                    file.path,
                    file.language,
                    file.initialTranscriptionPath,
                    fetch,
                    file.duration ? file.duration.toNumber() : undefined
                );
            } catch (e) {
                console.error(`ASR poller: checkCompletion failed for ${file.id}`, e);
            }
        }
    } catch (e) {
        console.error("ASR poller: tick failed", e);
    } finally {
        running = false;
    }
}

// Starts the poller once per process. Safe to call multiple times.
export function startAsrPoller(): void {
    if (timer) return;
    timer = setInterval(() => {
        void pollOnce();
    }, POLL_INTERVAL_MS);
    // Don't keep the event loop alive solely for the poller.
    if (typeof timer.unref === "function") timer.unref();
    console.log(
        `ASR background poller started (every ${POLL_INTERVAL_MS / 1000}s, languages: ${polledLanguages.join(", ")})`
    );
    // Kick off an initial tick shortly after boot so pending jobs aren't held
    // for a full interval on restart.
    setTimeout(() => void pollOnce(), 5_000);
}
