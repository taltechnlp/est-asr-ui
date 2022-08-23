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
import axios from 'axios';

const checkCompletion = async (fileId, externalId, path) => {
    // console.log(fileId, externalId, path)
    await axios.get("http://bark.phon.ioc.ee/transcribe/v1/result?id=" + externalId)
    .then(res => {const data = (res.data);  return data})
    .then(async resultFile => {
      if (resultFile.done) {
          // console.log(`Transcription of ${fileId}`, resultFile.done);
          if (resultFile.error) {
            const updatePrisma = await prisma.file.update({
              data: { state: "PROCESSING_ERROR" },
              where: {
                id: fileId
              }
            });
            console.log(
              `Failed to transcribe ${fileId}. Failed with code`,
              resultFile.error.code,
              resultFile.error.message
            );
            fs.unlinkSync(path);
          } else {
            const path = `${variables.uploadDir}/${fileId}.json`;
            const text = JSON.stringify(resultFile.result);
            const writeStream = fs.createWriteStream(path);
            writeStream.on("finish", async function() {
                console.log("file has been written");
                const updatePrisma = await prisma.file.update({
                  data: {
                    initialTranscriptionPath: path,
                    state: "READY"
                  },
                  where: {
                    id: fileId
                  }
                });
              });
              writeStream.write(text);
              writeStream.end();
            }
          }
          return;
        }
      )
      .catch(error => console.log(error));
};

export async function get({ locals }) {
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
                duration: file.duration,
                mimetype: file.mimetype,
                uploadedAt: file.uploadedAt,
                textTitle: file.textTitle,
                initialTranscription: file.initialTranscription
            }

        }
    )
    return {
        status: 200,
        body: {
            files: result
        },
    };
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