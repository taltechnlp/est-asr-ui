import { prisma } from "$lib/db/client";
import { checkCompletion } from "$lib/helpers/api";

// Background poller for Finnish ASR jobs.
//
// Finnish transcription is submitted to an external service (kielipankki) at
// upload time; completion is then discovered by POSTing the job id to
// FIN_ASR_RESULTS_URL. Historically that poll only ran inside `getFiles`, i.e.
// only while the owning user had their files page open. A user who uploaded and
// closed the tab left the job un-polled; the remote purges finished jobs after a
// while, so the file could get stuck in UPLOADED forever (remote later returns
// "job id not found"). This module polls those jobs server-side, independent of
// any open page.

const POLL_INTERVAL_MS = 60_000;

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
            where: { language: "finnish", state: { in: ["UPLOADED", "PROCESSING"] } },
            select: {
                id: true,
                state: true,
                externalId: true,
                path: true,
                initialTranscriptionPath: true,
            },
        });
        if (files.length === 0) return;
        for (const file of files) {
            // Without a job id there is nothing to poll; leave it for the page
            // to surface (it never got a valid remote job). Finnish uploads
            // always set both fields, so a missing one means a malformed record.
            if (!file.externalId || !file.initialTranscriptionPath) continue;
            try {
                await checkCompletion(
                    file.id,
                    file.state,
                    file.externalId,
                    file.path,
                    "finnish",
                    file.initialTranscriptionPath,
                    fetch
                );
            } catch (e) {
                console.error(`Finnish poller: checkCompletion failed for ${file.id}`, e);
            }
        }
    } catch (e) {
        console.error("Finnish poller: tick failed", e);
    } finally {
        running = false;
    }
}

// Starts the poller once per process. Safe to call multiple times.
export function startFinnishPoller(): void {
    if (timer) return;
    timer = setInterval(() => {
        void pollOnce();
    }, POLL_INTERVAL_MS);
    // Don't keep the event loop alive solely for the poller.
    if (typeof timer.unref === "function") timer.unref();
    console.log(`Finnish ASR background poller started (every ${POLL_INTERVAL_MS / 1000}s)`);
    // Kick off an initial tick shortly after boot so pending jobs aren't held
    // for a full interval on restart.
    setTimeout(() => void pollOnce(), 5_000);
}
