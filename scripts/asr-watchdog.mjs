#!/usr/bin/env node
// Restarts the live dictation server (pm2 app rust-asr-server) when it stops answering.
// A hung server keeps its pm2 status `online`, so pm2 itself never notices.
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import process from 'node:process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const url = process.env.ASR_WATCHDOG_URL || 'ws://127.0.0.1:8081/asr/v2';
const app = process.env.ASR_WATCHDOG_APP || 'rust-asr-server';
const language = process.env.ASR_WATCHDOG_LANGUAGE || 'et';
const intervalMs = Number(process.env.ASR_WATCHDOG_INTERVAL_MS || 60_000);
const timeoutMs = Number(process.env.ASR_WATCHDOG_TIMEOUT_MS || 15_000);
const maxFailures = Number(process.env.ASR_WATCHDOG_FAILURES || 3);
// Loading the models takes a little over 2 minutes after a restart
const graceMs = Number(process.env.ASR_WATCHDOG_GRACE_MS || 300_000);
const pm2 = process.env.ASR_WATCHDOG_PM2 || 'pm2';

const port = new URL(url).port || '80';
// Half a second of 16 kHz PCM silence, so the probe also goes through the decode path
const silence = Buffer.alloc(16_000).toString('base64');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log(new Date().toISOString(), ...parts);

// One full session: start -> ready -> audio -> stop -> session_ended
const probe = () =>
	new Promise((resolve, reject) => {
		const started = Date.now();
		let step = 'connect';
		let done = false;
		const ws = new WebSocket(url);
		const finish = (error) => {
			// close() fires the close event, which comes back here
			if (done) return;
			done = true;
			clearTimeout(timer);
			try {
				ws.close();
			} catch {
				// already closed
			}
			if (error) reject(new Error(`${error} (step: ${step})`));
			else resolve(Date.now() - started);
		};
		const timer = setTimeout(() => finish(`no answer within ${timeoutMs} ms`), timeoutMs);
		ws.addEventListener('open', () => {
			step = 'ready';
			ws.send(JSON.stringify({ type: 'start', sample_rate: 16000, format: 'pcm', language }));
		});
		ws.addEventListener('message', (event) => {
			let message;
			try {
				message = JSON.parse(String(event.data));
			} catch {
				return;
			}
			if (message.type === 'error') finish(`server error: ${message.message ?? ''}`);
			else if (message.type === 'ready' && step === 'ready') {
				step = 'session_ended';
				ws.send(JSON.stringify({ type: 'audio', data: silence }));
				ws.send(JSON.stringify({ type: 'stop' }));
			} else if (message.type === 'session_ended' && step === 'session_ended') finish();
		});
		ws.addEventListener('error', () => finish('websocket error'));
		ws.addEventListener('close', (event) => finish(`closed with code ${event.code}`));
	});

const pm2Process = async () => {
	const { stdout } = await run(pm2, ['jlist'], { maxBuffer: 64 * 1024 * 1024 });
	return JSON.parse(stdout).find((entry) => entry.name === app);
};

// What the server looked like when it hung, for the log
const diagnostics = async (pid) => {
	const lines = [];
	try {
		const { stdout } = await run('ss', ['-ltn', `sport = :${port}`]);
		lines.push(`listen socket: ${stdout.trim().split('\n').slice(1).join(' | ') || 'none'}`);
	} catch (error) {
		lines.push(`ss failed: ${error.message}`);
	}
	if (pid) {
		try {
			const counts = {};
			for (const tid of await readdir(`/proc/${pid}/task`)) {
				const wchan = (await readFile(`/proc/${pid}/task/${tid}/wchan`, 'utf8').catch(() => '?')) || '0';
				counts[wchan] = (counts[wchan] || 0) + 1;
			}
			lines.push(
				`threads by wchan: ${Object.entries(counts)
					.sort((a, b) => b[1] - a[1])
					.map(([name, count]) => `${name}=${count}`)
					.join(' ')}`
			);
		} catch (error) {
			lines.push(`thread scan failed: ${error.message}`);
		}
	}
	return lines;
};

let failures = 0;
log(`watching ${url} (pm2 app ${app}), every ${intervalMs} ms, restart after ${maxFailures} failures`);

while (true) {
	try {
		const ms = await probe();
		if (failures > 0) log(`probe ok again after ${failures} failure(s), ${ms} ms`);
		failures = 0;
	} catch (error) {
		failures += 1;
		log(`probe failed (${failures}/${maxFailures}): ${error.message}`);
	}

	if (failures >= maxFailures) {
		try {
			const entry = await pm2Process();
			const status = entry?.pm2_env?.status;
			const uptimeMs = Date.now() - (entry?.pm2_env?.pm_uptime || 0);
			if (!entry) {
				log(`pm2 has no app ${app}, not restarting`);
			} else if (status !== 'online') {
				// Stopped on purpose, or crashed and left to pm2's own autorestart
				log(`${app} is ${status} in pm2, not restarting`);
			} else if (uptimeMs < graceMs) {
				log(`${app} started ${Math.round(uptimeMs / 1000)} s ago, giving it time to load`);
			} else {
				for (const line of await diagnostics(entry.pid)) log(line);
				log(`restarting ${app} (pid ${entry.pid}, up ${Math.round(uptimeMs / 60_000)} min)`);
				await run(pm2, ['restart', app]);
				failures = 0;
			}
		} catch (error) {
			log(`restart check failed: ${error.message}`);
		}
	}

	await sleep(intervalMs);
}
