import axios from 'axios';
import { prisma } from "$lib/db/client";
import { unlink } from 'fs/promises';
import fs from 'fs'
import { SECRET_UPLOAD_DIR} from '$env/static/private';

const uploadDir = SECRET_UPLOAD_DIR;
export const checkCompletion = async (fileId, externalId, path) => {
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
            await unlink(path);
          } else {
            const path = `${uploadDir}/${fileId}.json`;
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