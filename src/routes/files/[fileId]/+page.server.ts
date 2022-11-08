import { prisma } from "$lib/db/client";
import type { PageServerLoad } from './$types';
import { promises as fs } from 'fs';
import { error } from '@sveltejs/kit';
import { spawn } from "child_process";

export const load: PageServerLoad = async ({ params, locals, url }) => {
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        }
    })
    if (locals.userId && locals.userId === file.uploader) {
        const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');

        let peaksExist = true;
        let peaksPath = file.path + '.json';
        await fs.access(file.path + ".json").catch(e => peaksExist = false);
        if (!peaksExist) {
            let fileExists = true;
            await fs.access(file.path).catch(e => fileExists = false);
            console.log('file', fileExists)
            if (fileExists) {
                const peaksDone = new Promise((resolve, reject) => {
                    const generatePeaks = spawn('audiowaveform', ['-i', file.path, '-o', peaksPath, '--pixels-per-second', '20', '--bits', '8']);
                    generatePeaks.on('exit', function (code) {
                        console.log('generate peaks exited with code ' + code);
                        if (code === 2) reject(new Error("File generation error"))
                        resolve(true);
                    })
                })
                peaksExist = true;
                await peaksDone.catch(e => peaksExist = false)
                const normalizeDone = new Promise((resolve, reject) => {
                    const normalize = spawn('python', ['./scripts/normalize_peaks.py', peaksPath]);
                    normalize.on('exit', function (code) {
                        console.log('normalize exited with code ' + code);
                        if (code === 2) reject(new Error("File generation error"))
                        resolve(true);
                    })
                })
                await normalizeDone.catch(e => peaksExist = false)
            }
        }
        let peaks = null;
        if (peaksExist) peaks = await fs.readFile(peaksPath, 'utf-8');
        return {
            file: {
                id: file.id,
                state: file.state,
                content: content,
                path: file.path,
                name: file.filename,
                uploadedAt: file.uploadedAt
            },
            url: url.origin,
            peaks
        }
    };
    throw error(401, 'unauthorized');
}