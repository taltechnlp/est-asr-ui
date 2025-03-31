import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from "$lib/db/client";
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { RESULTS_DIR, SECRET_UPLOAD_DIR } from '$env/static/private';

export const load = (async ({ locals, fetch, depends }) => {
    // depends('/api/files');
    console.log('load');
    let session = await locals.auth();
    if (!session || !session.user.id) {
        redirect(307, "/signin");
    }

    // --- Admin Check ---
    // Find the user only if their ID matches AND their role is ADMIN
    const adminUser = await prisma.user.findUnique({
        where: {
            id: session.user.id,
            role: Role.ADMIN
        }
    });

    // If adminUser is null, it means no user was found with that ID AND ADMIN role
    if (!adminUser) {
        // error(403, 'Forbidden: You do not have access to this page.');
        redirect(307, '/');
    }
    // --- End Admin Check ---

    const files = await prisma.file.findMany({
        where: {
            state: {
                in: ['PROCESSING', 'PROCESSING_ERROR']
            }
        },
        select: {
            id: true,
            filename: true,
            state: true,
            uploadedAt: true
        },
        orderBy: {
            uploadedAt: 'desc'
        }
    })
    return { files, session };
}) satisfies PageServerLoad;

export const actions = {
    resumeProcessing: async ({ request, locals, fetch }) => {
        let session = await locals.auth();
        if (!session || !session.user.id) {
            redirect(307, "/signin");
        }
        const adminUser = await prisma.user.findUnique({
            where: {
                id: session.user.id,
                role: Role.ADMIN
            }
        });
        if (!adminUser) {
            // error(403, 'Forbidden: You do not have access to this page.');
            redirect(307, '/');
        }
        const formData = await request.formData();
        const fileId = formData.get('fileId');
        console.log('resumeProcessing', fileId);
        let file = await prisma.file.findUnique({
            where: {
                id: fileId as string
            }
        });
        if (!file) {
            return { success: false };
        }
        // Generate a new id
        let newId = uuidv4();
        newId = newId.replace(/[-]/gi, '').substr(0, 30)
        if (!existsSync(file.path)) {
            return { success: false };
        }
        // Replace the externalId with the new id
        await prisma.file.update({
            where: {
                id: fileId as string
            },
            data: { externalId: newId }
        });
        // Send to Nextflow
        const resultDir = join(RESULTS_DIR, session.user.id, file.id)
        const result = await fetch(
            `/api/transcribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fileId: newId,
                    filePath: file.path,
                    resultDir: resultDir,
                    workflowName: newId,
                    resume: true
                })
            }
        ).catch(e => console.error("Could not start Nextflow process", e))
        if (result && result.ok) {
            return { success: true };
        }
        return { success: false };
    }
}