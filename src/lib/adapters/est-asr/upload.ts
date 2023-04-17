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
    const body = result.data as EstUploadResult;
    if (body.success == false) {
        await fs.unlink(pathString);
        return {
            error: true,
            reason: body.msg
        }
	}
	return { externalId: body.requestId, uploadedAt };
};

uploadEstAsr: async ({locals, request}) => {
    if (!locals.userId) {
        throw error(401, "notSignedIn")
    }
    const data = await request.formData();
    
    const file = data.get('file') as File;
    if (!file.name || !file.size || !file.type) {
        return invalid(400, { noFile: true})
    }
    if (file.size > UPLOAD_LIMIT) {
        return invalid(400, { uploadLimit: true });
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
        console.error("File saving failed", err);
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
        console.log("Upload failed", uploadResult.reason)
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