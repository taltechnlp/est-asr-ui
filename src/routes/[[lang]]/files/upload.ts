import { readFile, writeFile } from 'fs/promises';
import { SECRET_UPLOAD_DIR, FIN_ASR_UPLOAD_URL, EST_ASR_URL } from '$env/static/private';
import { statSync} from 'fs';
import type { FinUploadResult, EstUploadResult } from "$lib/helpers/api.d";
import { promises as fs } from 'fs'; 
import axios from 'axios';
import Form from 'form-data';

export const UPLOAD_LIMIT = 1024 * 1024 * 1000  // 1000MB
export const uploadResult = {
    0: "failed", 
    1: "network_error", 
    2: "ok"
 } as const satisfies {[index: number]: string;};
type UploadResult = (typeof uploadResult)[keyof typeof uploadResult]

type UploadToService = (
    filePath: string,
    filename: string,
 ) => Promise<{
    externalId?: string;
    uploadedAt: Date;
    result: UploadResult;
}> 

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

export const uploadToFinnishAsr: UploadToService = async (filePath, filename) => {
    const stats = statSync(filePath);
	const fileSizeInBytes = stats.size;
	const uploadedAt = stats.ctime;
	const form = new Form();
	const file = await readFile(filePath);
	form.append('file', file, filename);
	const result = await axios.post(FIN_ASR_UPLOAD_URL, form, {
		headers: {
			...form.getHeaders()
		},
        maxBodyLength: UPLOAD_LIMIT,
        maxContentLength: UPLOAD_LIMIT 
	});

    // Network error or service down
    if (result.status !== 200) {
        await fs.unlink(filePath);
        console.log(result.status, result.statusText)
        return { uploadedAt, result: uploadResult[1] };
    }
	const body = result.data as FinUploadResult;
    // Error in the service
	if (body.error) {
		await fs.unlink(filePath);
		console.log(result.status, result.statusText);
		return { externalId: "", uploadedAt, result: uploadResult[0] };
	}
    // Ok
	return { externalId: body.jobid, uploadedAt, result: uploadResult[2]};
}

export const uploadToBark: UploadToService = async (filePath, filename) => {
    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();
    const stats = statSync(filePath);
    const fileSizeInBytes = stats.size;
    const uploadedAt = stats.ctime;
    const file = await readFile(filePath);
    const result = await fetch(
        "http://bark.phon.ioc.ee/transcribe/v1/upload?extension=" + extension,
        {
            method: "PUT",
            headers: {
                "Content-length": fileSizeInBytes.toString()
            },
            body: file
        }
    ).catch(e => console.error("Upload failed", "http://bark.phon.ioc.ee/transcribe/v1/upload?extension=" + extension, e))
    if (!result) return { uploadedAt, result: uploadResult[1] };
    const externalId = result.headers.get("x-request-id");
    console.log(result.ok, result.status, result.statusText, externalId)
    if (!result.ok) {
        const body = (await result.json()) as { error: TranscriberError };
        console.log(body.error.code, body.error.message, body.error.log)
        await fs.unlink(filePath);
        // Some other error: network or service down
        if (!externalId) {
            return { uploadedAt, result: uploadResult[1] };
        }
        return { externalId, uploadedAt, result: uploadResult[0] };
    }

    return { externalId, uploadedAt, result: uploadResult[2] };

};

export const uploadToEstAsr: UploadToService = async (filePath, filename) => {
    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();
    const stats = statSync(filePath);
    const fileSizeInBytes = stats.size;
    const uploadedAt = stats.ctime;
    const file = await readFile(filePath);
    const form = new Form();
	form.append('file', file, filename);
	const result = await axios.post(`${EST_ASR_URL}/upload`, form, {
		headers: {
			...form.getHeaders()
		},
        maxBodyLength: UPLOAD_LIMIT,
        maxContentLength: UPLOAD_LIMIT 
	});
    const body = result.data as EstUploadResult;
    // Upload rejected
    if (result.status !== 201 || !body.success && body.requestId) {
        await fs.unlink(filePath);
		return { externalId: body.requestId, uploadedAt, result: uploadResult[0] };
	}
    // Network error
    else if (!body.requestId) { // Network error or server down 
        return { uploadedAt, result: uploadResult[1] };
    }
    // Ok
	else return { externalId: body.requestId, uploadedAt, result: uploadResult[2]};
};