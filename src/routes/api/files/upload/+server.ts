import { prisma } from "$lib/db/client";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs'
import path from 'path';
import { readFileSync, createWriteStream, statSync, unlinkSync, createReadStream } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import busboy from 'busboy';
import { pipeline } from 'stream/promises';
import {files as filesStore } from '$lib/stores';
import type { RequestHandler } from './$types'; 
import { error, json, redirect } from '@sveltejs/kit';
import { SECRET_UPLOAD_DIR } from '$env/static/private';

interface TranscriberError {
    code: number;
    message: string;
    log: string;
}

const uploadToTranscriber = async (pathString, filename) => {
    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();
    const stats = statSync(pathString);
    const fileSizeInBytes = stats.size;
    const uploadedAt = stats.ctime;
    const file = await readFile(pathString);
    // await writeFile('test30.wav', file)
    const result = await fetch(
        "http://bark.phon.ioc.ee/transcribe/v1/upload?extension=" + extension,
        {
            method: "PUT",
            headers: {
                "Content-length": fileSizeInBytes.toString()
            },
            body: file
        }
    )
    if ( !result.ok ) {
        const body = (await result.json()) as { error: TranscriberError  };
            console.log(body.error.code, body.error.message, body.error.log)
            unlinkSync(pathString); // delete the file
            throw error(result.status, body.error.message)
    }
    
    return { externalId: result.headers.get("x-request-id"), uploadedAt };

};

export const POST: RequestHandler = async ({ request, locals, url }) => {
    if (!locals.userId) {
        throw error( 401, "notSignedIn")
    }
    const content = request.headers.get('content-type');
    const bb = busboy({
        headers: {
            'content-type': content
        },
        /* limits: {
            fileSize: 1024 * 1024 * 400  // 400MB
        } */
    });

    let fileData = {
        id: "",
        filename: "",
        mimetype: '',
        encoding: '',
        path: ''
    }

    bb.on('file', (name, file, info) => {
        let { filename, encoding, mimeType } = info;
        filename = `${Date.now()}-${Math.round(Math.random() * 1E4)}-${filename}`
        const uploadDir = join(SECRET_UPLOAD_DIR, locals.userId);
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const saveTo = join(uploadDir, filename);
        console.log(
            `File [${name}]: filename: %j, encoding: %j, mimeType: %j, path: %j`,
            filename,
            encoding,
            mimeType,
            saveTo
        );
        file.pipe(createWriteStream(saveTo));

        let id = uuidv4()
        id = id.replace(/[-]/gi, '').substr(0, 30)

        fileData = {
            id: id,
            filename: filename,
            mimetype: mimeType,
            encoding: encoding,
            path: saveTo
        }
    });

    bb.on('limit', (name, val, info) => {
        
    })
    bb.on('close', () => {
        console.log("valmis")
    });
    bb.on("error", () => {
        throw error(500, 'fileUploadError')
    })
    await pipeline(request.body as any, bb);
    const uploaded = await uploadToTranscriber(fileData.path, fileData.filename)
    if (!uploaded.externalId) {
        throw error(400, "transcriptionServiceError")
    }
    
    console.log(fileData, statSync(fileData.path).ctime, uploaded.externalId)
    const uploadedFile = await prisma.file.create({
        data: {
            ...fileData,
            uploadedAt: statSync(fileData.path).ctime,
            externalId: uploaded.externalId,
            User: {
                connect: { id: locals.userId }
            }
        }
    })
    console.log("Upload saved to DB", uploadedFile)

    return json(fileData, {
        status: 201
    });
}

export const GET: RequestHandler = async ({request, locals}) => {
    if (!locals.userId) {
        throw redirect(307, "/signin");
    }
    const { files } = await prisma.user.findUnique({
        where: {
            id: locals.userId
        },
        include: {
            files: {
                select: {
                    id: true,
                    state: true,
                    text: true,
                    filename: true,
                    duration: true,
                    mimetype: true,
                    uploadedAt: true,
                    textTitle: true,
                    initialTranscription: true,
                    externalId: true,
                    path: true
                }
            }
        }
    })

    const result = files.map(
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
                initialTranscription: file.initialTranscription
            }

        }
    )
    return json( {files: result}, {status: 200} );
}