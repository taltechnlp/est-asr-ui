import { randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// Shared secret that Nextflow must present when it reports progress to
// /api/process via -with-weblog. Set PROCESS_WEBHOOK_SECRET to keep it stable
// across restarts; otherwise a fresh one is generated per process, which breaks
// callbacks for runs started before a restart.
export const PROCESS_WEBHOOK_TOKEN: string =
	env.PROCESS_WEBHOOK_SECRET || randomBytes(24).toString('hex');

export function isValidProcessToken(token: string | null): boolean {
	return !!token && token === PROCESS_WEBHOOK_TOKEN;
}
