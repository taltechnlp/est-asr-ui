import { prisma } from "$lib/db/client";
import type { PageServerLoad } from './$types';
import { promises as fs } from 'fs';
import { error } from '@sveltejs/kit';
import { spawn } from 'child_process';

export const load: PageServerLoad = async ({ params, locals, url }) => {
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        },
        include: {
            User: {
                select: {
                    id: true,
                    email: true
                }
            }
        }
    });
    const session = await locals.auth();
    if (!session || !session.user.id) {
        error(401, 'unauthorized');
    } 
    if (session.user.id !== file.User.id ) {
        return error(401, 'unauthorized');
    }
    const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');
    let fileExists = true;
    let mediaFile;
    try {
        mediaFile = await fs.access(file.path);
    } catch (e) {
        fileExists = false;
    }
    let peaksExists = true;
    let waveFormFile;
    try {
        waveFormFile = await fs.access(file.path + '.dat');
    } catch (e) {
        peaksExists = false;
    }
    if (!fileExists) {
        return error(404, 'file not found');
    }
    let peaksPath = file.path + '.dat';
    await fs.access(peaksPath).catch(e => peaksExists = false);
    if (!peaksExists) {
        await fs.access(file.path).catch(e => fileExists = false);
        let failed = false;
        if (fileExists) {
            const peaksDone = new Promise((resolve, reject) => {
                const generatePeaks = spawn('audiowaveform', ['-i', file.path, '-b', '8', '-o', peaksPath]);
                generatePeaks.on('exit', function (code) {
                    console.log('generate peaks exited with code ' + code);
                    if (code === 1 || code == 2) {
                        failed = true;
                    }
                    resolve(true);
                })
            })
            await peaksDone.catch(e => {
                failed = true;
                console.log(e);
            })
            
            if (failed) {
                return {
                    file: {
                        id: file.id,
                        state: file.state,
                        content: content,
                        path: file.path,
                        name: file.filename,
                        uploadedAt: file.uploadedAt
                    },
                    mediaUrl: `${url.origin}/uploaded/${file.id}`,
                    waveformUrl: ""
                }
            }
            /* const normalizeDone = new Promise((resolve, reject) => {
                const normalize = spawn('python', ['./scripts/normalize_peaks.py', peaksPath]);
                normalize.on('exit', function (code) {
                    console.log('normalize exited with code ' + code);
                    resolve(true);
                })
            })
            await normalizeDone.catch(e => console.log(e)) */
        }
    }

    return {
        file: {
            id: file.id,
            state: file.state,
            content: content,
            path: file.path,
            name: file.filename,
            uploadedAt: file.uploadedAt
        },
        mediaUrl: `${url.origin}/uploaded/${file.id}`,
        waveformUrl: `${url.origin}/uploaded/${file.id}/peaks`
    }   
}