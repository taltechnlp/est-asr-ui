import { prisma } from "$lib/db/client";
import type { PageServerLoad } from './$types';
import { promises as fs } from 'fs';
import { error } from '@sveltejs/kit';
import { spawn } from "child_process";

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
    })
    let session = await locals.getSession();
    if (!session && locals.userId) {
    const user = await prisma.user.findUnique({
      where: {
        id: locals.userId
      }
    })
    session = {
      user: {
        email: user.email,
        image: user.image,
        name: user.name 
      }, 
      expires: new Date("2099").toISOString()    }
  }
    if (session.user && session.user.email === file.User.email) {
        const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');

        let peaksExist = true;
        let peaksPath = file.path + '.json';
        await fs.access(file.path + ".json").catch(e => peaksExist = false);
        if (!peaksExist) {
            let fileExists = true;
            await fs.access(file.path).catch(e => fileExists = false);
            console.log('file', fileExists)
            if (fileExists) {
                let failed = false;
                const wavPath = file.path + '.wav';
                // ffmpeg - i!{ audio_file } -f sox - | sox - t sox - -c 1 - b 16 - t wav audio.wav rate - v 16k
                const toWav = new Promise((resolve, reject) => {
                    const ffmpeg = spawn('ffmpeg', ['-i', file.path,  wavPath] );
                    ffmpeg.on('exit', function (code) {
                        console.log('ffmpeg finished with ' + code);
                        if (code === 1 || code == 2) {
                            failed = true;
                        }
                        resolve(true);
                    })
                })
                await toWav.catch(e => failed = true);
                if (failed) {
                    return false;
                }
                const peaksDone = new Promise((resolve, reject) => {
                    const generatePeaks = spawn('audiowaveform', ['-i', wavPath, '-o', peaksPath, '--pixels-per-second', '20', '--bits', '8']);
                    generatePeaks.on('exit', function (code) {
                        console.log('generate peaks exited with code ' + code);
                        if (code === 1 || code == 2) {
                            failed = true;
                        }
                        resolve(true);
                    })
                })
                await peaksDone.catch(e => {
                    peaksExist = false;
                    console.log(e);
                })
                await fs.unlink(wavPath);
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
                        url: url.origin,
                        peaks: null
                    }
                }
                peaksExist = true;
                const normalizeDone = new Promise((resolve, reject) => {
                    const normalize = spawn('python', ['./scripts/normalize_peaks.py', peaksPath]);
                    normalize.on('exit', function (code) {
                        console.log('normalize exited with code ' + code);
                        resolve(true);
                    })
                })
                await normalizeDone.catch(e => console.log(e))
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