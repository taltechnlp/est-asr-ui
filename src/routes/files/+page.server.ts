import { prisma } from "$lib/db/client";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs'
import { variables } from "$lib/variables";
import path from 'path';
import { readFileSync, createWriteStream, statSync, unlinkSync, createReadStream } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import busboy from 'busboy';
import { pipeline } from 'stream/promises';
import { checkCompletion } from "./helpers";
import {files as filesStore } from '$lib/stores';
import type { PageServerLoad } from './$types'; 
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({locals}) => {
    const { files } = await prisma.user.findUnique({
        where: {
            id: locals.userId
        },
        include: {
            files: true
        }
    })
    const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED') 
    const promises = pendingFiles.map(file => checkCompletion(file.id, file.externalId, file.path))
    Promise.all(promises).then(values => console.log(values))
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
    filesStore.set(result);
    return {files: result};
}

const uploadToTranscriber = async (pathString, filename) => {
    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();
    const stats = statSync(pathString);
    const fileSizeInBytes = stats.size;
    const uploadedAt = stats.ctime;
    const file = await readFile(pathString, "binary");
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
    ).catch(error => {
        console.log(error, pathString, filename)
        unlinkSync(pathString); // delete the file
        return error
    })
    return { externalId: result.headers.get("x-request-id"), uploadedAt };

};

export async function post({ request, locals }) {
    if (!locals.userId) {
        return {
            status: 401,
            body: {
                error: "notSignedIn"
            }
        }
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
        const saveTo = join(variables.uploadDir, filename);
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
        console.log("error")
    })
    await pipeline(request.body as any, bb).catch(error => {
        return {
            status: 500,
            body: error
        }
    })
    console.log("hakkan teenusesse saatma")
    const uploaded = await uploadToTranscriber(fileData.path, fileData.filename).catch(
        error => {
            console.log(error)
            return error
        }
    )
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
    }).catch(error => {
        return {
            status: 500,
            body: error
        }
    })
    console.log(uploadedFile)
    //.then(x=>console.log(x)).catch(e=>console.log(e))
    // const { } = uploadToTranscriber(saveTo, mimeType, filename)

    return {
        status: 201,
        body: {
            uploadedFile
        }
    };
}