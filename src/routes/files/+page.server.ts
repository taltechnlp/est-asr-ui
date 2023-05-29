import { prisma, } from "$lib/db/client";
import type { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';
import { checkCompletion, getFiles } from '$lib/helpers/api';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { SECRET_UPLOAD_DIR, FIN_ASR_UPLOAD_URL, EST_ASR_USE_NEW } from '$env/static/private';
import { existsSync, mkdirSync, statSync, unlinkSync} from 'fs';
import type { FinUploadResult, EstProgress, EstResult, EstUploadResult } from "$lib/helpers/api.d";
import { promises as fs } from 'fs'; 
import axios from 'axios';
import Form from 'form-data'; 
import { uploadToBark, uploadToEstAsr, uploadToFinnishAsr, UPLOAD_LIMIT } from "./upload";


type FileWithProgress = {
    uploadedAt: Date;
    id: string;
    state: string;
    text: string | null;
    path: string;
    filename: string;
    language: string;
    duration: Prisma.Decimal | null;
    mimetype: string;
    externalId: string;
    textTitle: string | null;
    initialTranscription: string | null;
    progressPrc?: number;
    totalJobsQueued?: number;
    totalJobsStarted?: number;
}

const uploadResult = {
    0: "failed", 
    1: "network_error", 
    2: "ok"
 } as const satisfies {[index: number]: string;};
type UploadResult = (typeof uploadResult)[keyof typeof uploadResult]

 
export const load: PageServerLoad = async ({ locals }) => {
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
    if (!session || !session.user) {
        throw redirect(307, "/signin");
    }
    let files: FileWithProgress[] = await getFiles(session.user.email);
    const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')
    if (pendingFiles.length > 0) {
        const promises = pendingFiles.map(file => checkCompletion(file.id, file.externalId, file.path, file.language, SECRET_UPLOAD_DIR))
        const resultRetrieved = (await Promise.all(promises)).reduce((acc, x) => {
            if (!x.done && x.fileId && x.progressPrc) {
                const index = files.findIndex(file => file.id === x.fileId);
                files[index].progressPrc = x.progressPrc;
                files[index].state = x.status;
                files[index].totalJobsQueued = x.totalJobsQueued;
                files[index].totalJobsStarted = x.totalJobsStarted;
            }
            return acc || x.done
        }, false);
        if (resultRetrieved) {
            files = await getFiles(session.user.email)
        }
    }
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
                initialTranscription: file.initialTranscription,
                progressPrc: file.progressPrc,
                totalJobsQueued: file.totalJobsQueued,
                totalJobsStarted: file.totalJobsStarted
            }

        }
    )
    return { files: result };
}

export const actions: Actions = {
    uploadEst: async ({locals, request}) => {
        /* if (EST_ASR_USE_NEW){
            if (!locals.userId) {
                throw redirect(307, "/signin")
            }
            const data = await request.formData();
            
            const file = data.get('file') as File;
            if (!file.name || !file.size || !file.type) {
                return fail(400, { noFile: true})
            }
            if (file.size > UPLOAD_LIMIT) {
                return fail(400, { uploadLimit: true });
            }
            const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E4)}-${file.name}`
            const uploadDir = join(SECRET_UPLOAD_DIR, locals.userId);
            if (!existsSync(uploadDir)) {
                mkdirSync(uploadDir, { recursive: true });
            }
            const saveTo = join(uploadDir, newFilename);
            console.log(
                `File [${newFilename}]: filename: %j, mimeType: %j, path: %j`,
                file.name,
                file.type,
                saveTo,
                "est"
            );
            try {
                // @ts-ignore
                await writeFile(saveTo, file.stream())
            } catch (err) {
                console.error("File saving failed", err);
                return fail(400, {fileSaveFailed: true});
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
            const uploadResult = await uploadToEstAsr(fileData.path, fileData.filename)
            if (!uploadResult.externalId) {
                console.log("Upload failed", uploadResult)
                return { file: fileData, result: uploadResult[1] };
            }
            console.log(fileData, statSync(fileData.path).ctime, uploadResult.externalId)
            const uploadedFile = await prisma.file.create({
                data: {
                    ...fileData,
                    uploadedAt: statSync(fileData.path).ctime,
                    externalId: uploadResult.externalId,
                    language: "est",
                    User: {
                        connect: { id: locals.userId }
                    }
                }
            })
            console.log("Upload saved to DB", uploadedFile)
            return { success: true , file: fileData }; 

        } */
        // Bark server
        const session = await locals.getSession();
        if (!session || !session.user) {
            throw redirect(307, "/signin")
        }
        console.log("bark upload")
        const data = await request.formData();
        
        const file = data.get('file') as File;
        if (!file.name || !file.size || !file.type) {
            return fail(400, { noFile: true})
        }
        if (file.size > UPLOAD_LIMIT) {
            return fail(400, { uploadLimit: true });
        }
        const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E4)}-${file.name}`
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email
            },
            select: {
                id: true
            }
        })
        const uploadDir = join(SECRET_UPLOAD_DIR, user.id);
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
            return fail(400, {fileSaveFailed: true});
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
        console.log("enne")
        const result = await uploadToBark(fileData.path, fileData.filename)
        console.log("pärast")
        if (!result.externalId) {
            return { file: fileData, result: uploadResult[1] };
        }
        console.log(fileData, statSync(fileData.path).ctime, result.externalId)
        const uploadedFile = await prisma.file.create({
            data: {
                ...fileData,
                uploadedAt: statSync(fileData.path).ctime,
                externalId: result.externalId,
                language: "est",
                User: {
                    connect: { id: user.id}
                }
            }
        })
        console.log("Upload saved to DB", uploadedFile)
        return { success: true , file: fileData, error: undefined };
    },
    uploadFin: async ({locals, request}) => {
        const session = await locals.getSession();
        if (!session || !session.user) {
            throw redirect(307, "/signin")
        }
        const data = await request.formData();
        
        const file = data.get('file') as File;
        if (!file.name || !file.size || !file.type) {
            return fail(400, { noFile: true})
        }
        if (file.size > UPLOAD_LIMIT) {
            return fail(400, { uploadLimit: true });
        }
        const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E4)}-${file.name}`
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email
            },
            select: {
                id: true
            }
        })
        const uploadDir = join(SECRET_UPLOAD_DIR, user.id);
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
            return fail(400, {fileSaveFailed: true});
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
                User: {
                    connect: { id: user.id }
                }
            }
        })
        console.log("Upload saved to DB", uploadedFile)
        return { success: true , file: fileData };
    },
    
};