import { prisma } from "$lib/db/client"; 
import { v4 as uuidv4 } from 'uuid';
import { checkCompletion, getFiles } from '$lib/helpers/api';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PageServerLoad, Actions } from './$types';
import { fail, error, redirect } from '@sveltejs/kit';
import { SECRET_UPLOAD_DIR, FIN_ASR_UPLOAD_URL, EST_ASR_URL } from '$env/static/private';
import { existsSync, mkdirSync, statSync, unlinkSync} from 'fs';
import type { FinUploadResult, EstProgress, EstResult, EstUploadResult } from "$lib/helpers/api.d";
import { promises as fs } from 'fs'; 
import axios from 'axios';
import Form from 'form-data';

const UPLOAD_LIMIT = 1024 * 1024 * 400  // 400MB

export const load: PageServerLoad = async ({ locals, params, url }) => {
    if (!locals.userId) {
        throw redirect(307, "/signin");
    }
    let currentUser = locals.userId;
    const isAdmin = await (await prisma.user.findUnique({where: {id: locals.userId}})).role === "ADMIN";
    if (!isAdmin) throw error(403);

    let users = await prisma.user.findMany({select: {email: true, id: true}});
    if (url.searchParams.get("user") && users.find(u => u.id === url.searchParams.get("user"))) currentUser = url.searchParams.get("user");
    let files = await getFiles(currentUser);
    const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')
    if (pendingFiles.length > 0) {
        const promises = pendingFiles.map(file => checkCompletion(file.id, file.externalId, file.path, file.language, SECRET_UPLOAD_DIR))
        const resultRetrieved = (await Promise.all(promises)).reduce((acc, x) => acc || x.done, false);
        if (resultRetrieved) {
            files = await getFiles(currentUser);
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
                initialTranscription: file.initialTranscription
            }

        }
    )
    return { files: result, users, currentUser };
}

interface TranscriberError {
    code: number;
    message: string;
    log: string;
}

type FileSaveResult = boolean | {
    fileData: {
    id: string;
    filename: string;
    mimetype: string;
    encoding: string;
    path: string;
}}

const uploadToFinnishAsr = async (pathString, filename, mimeType) => {
    const stats = statSync(pathString);
	const fileSizeInBytes = stats.size;
	const uploadedAt = stats.ctime;
	const form = new Form();
	const file = await readFile(pathString);
	form.append('file', file, filename);
	const result = await axios.post(FIN_ASR_UPLOAD_URL, form, {
		headers: {
			...form.getHeaders()
		},
        maxBodyLength: UPLOAD_LIMIT,
        maxContentLength: UPLOAD_LIMIT 
	});

    if (result.status !== 200) {
        await fs.unlink(pathString);
		throw error(result.status, result.statusText);
	}
	const body = result.data as FinUploadResult;
	if (body.error) {
		await fs.unlink(pathString);
		throw error(result.status, result.statusText);
	}
	return { jobid: body.jobid };
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
    const result = await fetch(
        "http://bark.phon.ioc.ee/transcribe/v1/upload?extension=" + extension,
        {
            method: "PUT",
            headers: {
                "Content-length": fileSizeInBytes.toString()
            },
            body: file
        }
    ).catch(e => console.log("Upload failed", "http://bark.phon.ioc.ee/transcribe/v1/upload?extension=" + extension, e))
    if (!result) {
        await fs.unlink(pathString);
        return { uploadedAt }
    }
    if (!result.ok) {
        const body = (await result.json()) as { error: TranscriberError };
        console.log(body.error.code, body.error.message, body.error.log)
        await fs.unlink(pathString);
        return { uploadedAt }
    }

    return { externalId: result.headers.get("x-request-id"), uploadedAt };

};

const uploadToEstAsr = async (pathString, filename) => {
    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();
    const stats = statSync(pathString);
    const fileSizeInBytes = stats.size;
    const uploadedAt = stats.ctime;
    const file = await readFile(pathString);
    const form = new Form();
	form.append('file', file, filename);
	const result = await axios.post(`${EST_ASR_URL}/upload`, form, {
		headers: {
			...form.getHeaders()
		},
        maxBodyLength: UPLOAD_LIMIT,
        maxContentLength: UPLOAD_LIMIT 
	});
    if (result.status !== 200) {
        await fs.unlink(pathString);
		throw error(result.status, result.statusText);
	}
	const body = result.data as EstUploadResult;
	if (body.success == false) {
		await fs.unlink(pathString);
		throw error(result.status, result.statusText);
	}
	return { externalId: body.requestId, uploadedAt };
};

export const actions: Actions = {
    uploadEst: async ({locals, request}) => {
        if (!locals.userId) {
            throw error(401, "notSignedIn")
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
            saveTo
        );
        try {
            // @ts-ignore
            await writeFile(saveTo, file.stream())
        } catch (err) {
            console.error(err);
            throw error(500, "fileSavingFailed");
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
        const uploadResult = await uploadToTranscriber(fileData.path, fileData.filename)
        if (!uploadResult.externalId) {
            throw error(400, "transcriptionServiceError")
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
    },
    uploadFin: async ({locals, request}) => {
        if (!locals.userId) {
            throw error(401, "notSignedIn")
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
            saveTo
        );
        try {
             // @ts-ignore
            await writeFile(saveTo, file.stream())
        } catch (err) {
            console.error(err);
            throw error(500, "fileSavingFailed");
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
        const uploadResult = await uploadToFinnishAsr(fileData.path, fileData.filename, fileData.mimetype)
        if (!uploadResult.jobid) {
            throw error(400, "transcriptionServiceError")
        }
        console.log(fileData, statSync(fileData.path).ctime, uploadResult.jobid)
        const uploadedFile = await prisma.file.create({
            data: {
                ...fileData,
                uploadedAt: statSync(fileData.path).ctime,
                externalId: uploadResult.jobid,
                language: "fin",
                User: {
                    connect: { id: locals.userId }
                }
            }
        })
        console.log("Upload saved to DB", uploadedFile)
        return { success: true , file: fileData };
    },
    uploadEst2: async ({locals, request}) => {
        if (!locals.userId) {
            throw error(401, "notSignedIn")
        }
        const data = await request.formData();
        
        const file = data.get('file') as File;
        if (!file.name || !file.size || !file.type) {
            console.log("Invalid file.")
            return fail(400, { noFile: true})
        }
        if (file.size > UPLOAD_LIMIT) {
            console.log("Upload limit exceeded.")
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
            saveTo
        );
        try {
             // @ts-ignore
            await writeFile(saveTo, file.stream())
        } catch (err) {
            console.error(err, "Saving file failed");
            throw error(500, "fileSavingFailed");
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
            console.log("No external ID")
            throw error(400, "transcriptionServiceError")
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
    },
    switchUser: async ({ request }) => {
		const data = await request.formData();
        const userId = data.get('user');
        console.log(userId)
        throw redirect(303, `/admin/files?user=${userId}`);
	}
} 