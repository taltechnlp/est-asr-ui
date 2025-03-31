import { prisma } from "$lib/db/client";
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { SECRET_UPLOAD_DIR, RESULTS_DIR } from '$env/static/private';
import { existsSync, mkdirSync, statSync } from 'fs';
import { promises as fs } from 'fs';
import { uploadToFinnishAsr, UPLOAD_LIMIT } from "./upload";
import path from "path";
// import { logger } from '$lib/logging/client';
import { getAudioDurationInSeconds } from "get-audio-duration";
import { Buffer } from 'node:buffer'; 
import { Readable } from 'stream';
import { unlink } from "fs/promises";
import "../../../app.css";
import { spawn } from "node:child_process";
export const load: PageServerLoad = async ({ locals, fetch, depends }) => {
    depends('/api/files');
    let session = await locals.auth();
    if (!session || !session.user.id) {
        redirect(307, "/signin");
    }
    const result = await fetch('/api/files');
    try {
        let files = await result.json();
        if (files.length > 0) {
            files = files.map(
                file => {
                    return {
                        id: file.id,
                        state: file.state,
                        text: file.text,
                        filename: file.filename,
                        duration: file.duration,
                        mimetype: file.mimetype,
                        uploadedAt: file.uploadedAt?.toString(),
                        textTitle: file.textTitle,
                        initialTranscription: file.initialTranscription,
                        progress: file.progress,
                        oldSystem: file.path.includes('/mnt/volume1/')
                    }
                    
                }
            )
        }
        return { files, session };
    }
    catch (error) {
        console.log("Retrieveing user files from API failed", error);
        return { files: [], session };
    }
}

export const actions: Actions = {
    default: async ({ locals, request, fetch }) => {
        let session = await locals.auth();
        if (!session || !session.user.id) {
            redirect(307, "/signin");
        }
        const data = await request.formData();
        const lang = data.get('lang') as string;
        if (lang !== "estonian" && lang !== "finnish") {
            console.error("Invalid language", lang)
            return fail(400, { invalidLang: true })
        }
        const notify = data.get('notify') === "yes" ? true : false;
        const file = data.get('file') as Blob;
        if (!file || !('name' in file) || !('size' in file) || !('type' in file)) {
            console.error("no file name, size or type", file)
            return fail(400, { noFile: true })
        }
        if (file.size > UPLOAD_LIMIT) {
            console.error("File too large");
            return fail(400, { uploadLimit: true });
        }
        let id: string = uuidv4()
        id = id.replace(/[-]/gi, '').substr(0, 30)
        const newFilename = `${id}_${file.name}`
        const uploadDir = join(SECRET_UPLOAD_DIR, session.user.id);
        if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
        }
        const saveTo = join(uploadDir, newFilename);
        console.log(
            `File [${newFilename}]: filename: %j, mimeType: %j, path: %j`,
            file.name,
            file.type,
            saveTo
        );
        const uploadedAt = new Date();
        const increaseAscii = (char: string) => {
            const ascii = char.charCodeAt(0);
            if (ascii <= 57) {
              return String.fromCharCode(ascii + 60);
            } else return char;
          };
        let externalId = "";
        if (lang === "estonian") {
            externalId = Array.from(id)
                .map(increaseAscii)
                .join("");
        }
        const fileData = {
            id: id,
            uploadedAt,
            filename: file.name,
            mimetype: file.type,
            encoding: "7bit",
            externalId,
            language: lang,
            path: saveTo
        }
        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            // Convert the Buffer to a Readable stream
            const stream = Readable.from(buffer);
            await fs.writeFile(saveTo, stream);
            console.log("File saved to", saveTo);
        } catch (err) {
            console.error(err);
            return fail(400, { fileSaveFailed: true });
        }

        let duration = 0;
        let error = false;
        try {
            await getAudioDurationInSeconds(saveTo).then((dur) => {
                duration = dur;
                console.log("File duration in seconds:", duration)
                if (duration > 7200) { // not more than 2h
                    error = true;
                }
            });
        }
        catch (e) {
            console.log("Failed to read file duration at", saveTo);
            error = true;
        };
        if (error) {
            await unlink(saveTo).catch(e => console.error("Failed to remove uploaded file that was too long", e));
            return fail(400, { fileTooLong: true });
        }
        const opusPath = saveTo + '.opus';
        let failed = false;
        const toOpus = new Promise((resolve, reject) => {
            console.log('converting to opus', saveTo, opusPath);
            const ffmpeg = spawn('ffmpeg', [
                '-i', saveTo,
                '-c:a', 'libopus',        // Use Opus codec
                '-b:a', '24k',            // 24kbps bitrate (good for speech)
                '-y',
                /* '--vbr', 'on',             // Variable bitrate
                '-compression_level', '10', // Maximum compression
                '-application', 'voip',    // Optimize for speech */
                opusPath
            ]);
            ffmpeg.on('error', function (e) {
                console.log('ffmpeg error: ' + e);
                failed = true;
                resolve(true);
            })
            ffmpeg.on('exit', function (code) {
                console.log('ffmpeg finished with ' + code);
                if (code === 1 || code === 2) {
                    failed = true;
                }
                resolve(true);
            });
        })
        await toOpus.catch(e => failed = true);
        if (failed) {
            await unlink(opusPath).catch(e => console.error("Failed to remove opus file", e));
            return fail(400, { fileSaveFailed: true });
        }
        fileData.path = opusPath;
        const resultDir = path.join(RESULTS_DIR, session.user.id, fileData.id)
        const resultPath = path.join(resultDir, "result.json")
        if (lang === "estonian") {
            await unlink(saveTo).catch(e => console.error("Failed to remove uploaded file converted to opus", e));
            await prisma.file.create({
                data: {
                    ...fileData,
                    duration: duration,
                    initialTranscriptionPath: resultPath,
                    notified: false,
                    notify: notify,
                    User: {
                        connect: { id: session.user.id }
                    }
                }
            }).catch((e) => {
                console.error("Could not save file UPLOADED status to DB", e)
                return fail(400, { fileSaveFailed: true })
            })
            const result = await fetch(
                `/api/transcribe`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        fileId: id,
                        filePath: saveTo,
                        resultDir,
                        workflowName: externalId
                    })
                }
            ).catch(e => console.error("Could not start Nextflow process", e))
            if (result && result.ok) { 
                const body = await result.json();
                if (body.requestId) {
                    await prisma.file.update({
                        where: {
                            id: fileData.id
                        },
                        data: {
                            state: "PROCESSING"
                        }
                    }).catch(e => console.error("Could not save file PROCESSING status to DB", e))
                };
            }
        }
        else { // Finnish
            const uploadResult = await uploadToFinnishAsr(saveTo, fileData.filename)
            if (!uploadResult.externalId) {
                console.error("Upload FIN", "Upload failed", fileData, uploadResult)
                return fail(400, { finnishUploadFailed: true });
            }
            fileData.externalId = uploadResult.externalId;
            await unlink(saveTo).catch(e => console.error("Failed to remove uploaded file converted to opus", e));
            await prisma.file.create({
                data: {
                    ...fileData,
                    duration: duration,
                    initialTranscriptionPath: resultPath,
                    notified: false,
                    notify: notify,
                    User: {
                        connect: { id: session.user.id }
                    }
                }
            }).catch(e => {
                console.error("Could not save file UPLOADED status to DB", e)
                return fail(400, { finnishUploadFailed: true })
            })
            console.log("File uploaded to DB", uploadResult.externalId)
        }
        return { success: true, file: fileData, error: undefined };
    },
    /* uploadFin: async ({ locals, request }) => {
        let session = await locals.auth();
        if (!session || !session.user.id) {
            redirect(307, "/signin");
        }
        const data = await request.formData();

        const file = data.get('file') as File;
        if (!file.name || !file.size || !file.type) {
            return fail(400, { noFile: true })
        }
        if (file.size > UPLOAD_LIMIT) {
            return fail(400, { uploadLimit: true });
        }
        const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E4)}-${file.name}`
        const uploadDir = join(SECRET_UPLOAD_DIR, session.user.id);
        if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
        }
        const saveTo = join(uploadDir, newFilename);
        console.log("Upload FIN",
            `File [${newFilename}]: filename: %j, mimeType: %j, path: %j`,
            file.name,
            file.type,
            saveTo
        );
        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            // Convert the Buffer to a Readable stream
            const stream = Readable.from(buffer);
            await fs.writeFile(saveTo, stream);
        } catch (err) {
            console.error(err);
            return fail(400, { fileSaveFailed: true });
        }
        logger.info({session, message: `file uploaded to ${saveTo}` })
        
        let id = uuidv4()
        id = id.replace(/[-]/gi, '').substr(0, 30)

        const fileData = {
            id: id,
            filename: file.name,
            mimetype: file.type,
            encoding: "7bit",
            path: saveTo
        }
        const uploadResult = await uploadToFinnishAsr(fileData.path, fileData.filename)
        if (!uploadResult.externalId) {
            console.log("Upload FIN", "Upload failed", fileData, uploadResult)
            return { file: fileData, result: uploadResult[1] };
        }
        console.log("Upload FIN", fileData, statSync(fileData.path).ctime, uploadResult.externalId)
        const uploadedFile = await prisma.file.create({
            data: {
                ...fileData,
                uploadedAt: statSync(fileData.path).ctime,
                externalId: uploadResult.externalId,
                language: "fin",
                notified: false,
                User: {
                    connect: { id: session.user.id }
                }
            }
        })
        console.log("Upload FIN", "Upload saved to DB", uploadedFile)
        return { success: true, file: fileData };
    }, */

} satisfies Actions;