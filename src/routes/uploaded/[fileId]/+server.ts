import { prisma } from "$lib/db/client";
import { error } from '@sveltejs/kit'; 
import type {RequestHandler} from './$types';
import { promises as fs } from 'fs';
import path from 'path';
import { variables } from "$lib/variables";

export const GET: RequestHandler = async ({ params, locals }) => {
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        }
    })
    if (locals.userId && locals.userId === file.uploader) {
        const filePath = path.join(variables.uploadDir, file.path)
        const data = await fs.readFile(filePath)
        return new Response(data);
    }
    throw error(401, 'unauthorized'); 
}