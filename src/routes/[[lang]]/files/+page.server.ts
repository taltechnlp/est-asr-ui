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
import { logger } from '$lib/logging/client';
import { getAudioDurationInSeconds } from "get-audio-duration";
import { Buffer } from 'node:buffer'; 
import { Readable } from 'stream';
import { unlink } from "fs/promises";

export const load: PageServerLoad = async ({ locals, fetch, depends, url }) => {
    depends('/api/files')
    let userId = locals.userId;
    let session = await locals.getSession();
    if (!userId) {
        if (session && session.user) userId = session.user.id;
    }
    if (!userId) {
        throw redirect(307, "/signin");
    }
    const isAdmin = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            role: true
        }
    })
    let adminSearchParam = "";
    if (isAdmin && url.searchParams.has("userId")) {
        adminSearchParam = "?userId=" + url.searchParams.get("userId");
    }
    try {
        const result = await fetch('/api/files' + adminSearchParam);
        
        let files = await result.json();
        if (files.length > 0) {
            files = files.map(
                file => {
                    return {
                        id: file.id,
                        state: file.state,
                        text: file.text,
                        filename: file.filename,
                        duration: file.duration?.toNumber(),
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
    uploadEst: async ({ locals, request, fetch }) => {
        let userId = locals.userId;
        if (!userId) {
            let session = await locals.getSession();
            if (session && session.user) userId = session.user.id;
        }
        if (!userId) {
            throw redirect(307, "/signin");
        }
        const data = await request.formData();
        const notify = data.get('notify') === "yes" ? true : false;
        const file = data.get('file') as File;
        if (!file.name || !file.size || !file.type) {
            console.info("No file");
            return fail(400, { noFile: true })
        }
        if (file.size > UPLOAD_LIMIT) {
            console.info("File too large");
            return fail(400, { uploadLimit: true });
        }
        let id: string = uuidv4()
        id = id.replace(/[-]/gi, '').substr(0, 30)
        const newFilename = `${id}_${file.name}`
        const uploadDir = join(SECRET_UPLOAD_DIR, userId);
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
        const uploadedAt = new Date()
        const increaseAscii = (char: string) => {
            const ascii = char.charCodeAt(0);
            if (ascii <= 57) {
              return String.fromCharCode(ascii + 60);
            } else return char;
          };
        const externalId = Array.from(id)
            .map(increaseAscii)
            .join("");
        const fileData = {
            id: id,
            uploadedAt,
            filename: file.name,
            mimetype: file.type,
            encoding: "7bit",
            path: saveTo,
            externalId
        }
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
        logger.info({userId, message: `file uploaded to ${saveTo}` })

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
            await unlink(saveTo).catch(e => console.log("Failed to remove uploaded file that was too long", e));
            return fail(400, { fileTooLong: true });
        }

        const resultDir = path.join(RESULTS_DIR, userId, fileData.id)
        const resultPath = path.join(resultDir, "result.json")
        await prisma.file.create({
            data: {
                ...fileData,
                language: "est",
                initialTranscriptionPath: resultPath,
                notified: false,
                notify: notify,
                User: {
                    connect: { id: userId }
                }
            }
        }).catch(() => {return fail(400, { fileSaveFailed: true })})
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

        return { success: true, file: fileData, error: undefined };
    },
    uploadFin: async ({ locals, request }) => {
        let userId = locals.userId;
        if (!userId) {
            let session = await locals.getSession();
            if (session && session.user) userId = session.user.id;
        }
        if (!userId) {
            throw redirect(307, "/signin");
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
        const uploadDir = join(SECRET_UPLOAD_DIR, userId);
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
        try {
            // @ts-ignore
            await writeFile(saveTo, file.stream())
        } catch (err) {
            console.error(err);
            return fail(400, { fileSaveFailed: true });
        }
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
            return { file: fileData, result: uploadResult[1] };
        }
        console.log(fileData, statSync(fileData.path).ctime, uploadResult.externalId)
        const uploadedFile = await prisma.file.create({
            data: {
                ...fileData,
                uploadedAt: statSync(fileData.path).ctime,
                externalId: uploadResult.externalId,
                language: "fin",
                notified: false,
                User: {
                    connect: { id: userId }
                }
            }
        })
        console.log("Upload saved to DB", uploadedFile)
        return { success: true, file: fileData };
    },

} satisfies Actions;