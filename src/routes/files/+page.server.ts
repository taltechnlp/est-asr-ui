import { v4 as uuidv4 } from 'uuid';
import { checkCompletion, getFiles } from '$lib/helpers/api';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PageServerLoad, Action } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { SECRET_UPLOAD_DIR } from '$env/static/private';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    throw redirect(307, "/signin");
  }
  let files = await getFiles(locals.userId)
  const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')
  if (pendingFiles.length > 0) {
    const promises = pendingFiles.map(file => checkCompletion(file.id, file.externalId, file.path, SECRET_UPLOAD_DIR))
        const resultRetrieved = (await Promise.all(promises)).reduce((acc, x) => acc || x, false);
        if (resultRetrieved) {
            files = await getFiles(locals.userId)
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
  return { files: result };
}