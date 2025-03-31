import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from "$lib/db/client";
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync} from 'fs';
import { RESULTS_DIR } from '$env/static/private';
import { base } from '$app/paths';

export const load = (async ({ locals }) => {
    // depends('/api/files');
    console.log('load');
    let session = await locals.auth();
    if (!session || !session.user.id) {
        redirect(307, `${base}/signin`);
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
        redirect(307, `${base}/`);
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
            uploadedAt: true,
            path: true
        },
        orderBy: {
            uploadedAt: 'desc'
        }
    })
    files.forEach(async (file) => {
        // Check if the file was uploaded more than 3 hours ago
        if (file.state === 'PROCESSING' && file.uploadedAt < new Date(Date.now() - 3 * 60 * 60 * 1000)) {
            // Generate a new id that conforms to the required pattern
            // ^[a-z](?:[a-z\d]|[-_](?=[a-z\d])){0,79}$
            let baseId = uuidv4();
            // Remove hyphens and take a substring (e.g., 29 chars to keep total length 30)
            baseId = baseId.replace(/[-]/gi, '').substring(0, 29);
            // Prepend 'r' to ensure it starts with a letter
            const newId = `r${baseId}`;
            if (!existsSync(file.path)) {
                return { success: false };
            }
            const resultDir = join(RESULTS_DIR, session.user.id, newId);
            const resultPath = join(resultDir, "result.json");
            // Replace the externalId with the new id
            await prisma.file.update({
                where: {
                    id: file.id
                },
                data: { 
                    externalId: newId,
                    initialTranscriptionPath: resultPath
                }
            });
            // Send to Nextflow
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
                        resume: false
                    })
                }
            ).catch(e => console.error("Could not start Nextflow process", e))
        }
        // Add a delay of 1 second between each file
        await new Promise(resolve => setTimeout(resolve, 1000));
    })
    return { files, session };
}) satisfies PageServerLoad;

export const actions = {
    resumeProcessing: async ({ request, locals, fetch }) => {
        let session = await locals.auth();
        if (!session || !session.user.id) {
            redirect(307, `${base}/signin`);
        }
        const adminUser = await prisma.user.findUnique({
            where: {
                id: session.user.id,
                role: Role.ADMIN
            }
        });
        if (!adminUser) {
            // error(403, 'Forbidden: You do not have access to this page.');
            redirect(307, `${base}/`);
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
        // Generate a new id that conforms to the required pattern
        // ^[a-z](?:[a-z\d]|[-_](?=[a-z\d])){0,79}$
        let baseId = uuidv4();
        // Remove hyphens and take a substring (e.g., 29 chars to keep total length 30)
        baseId = baseId.replace(/[-]/gi, '').substring(0, 29);
        // Prepend 'r' to ensure it starts with a letter
        const newId = `r${baseId}`;
        if (!existsSync(file.path)) {
            return { success: false };
        }
        const resultDir = join(RESULTS_DIR, session.user.id, newId);
        const resultPath = join(resultDir, "result.json");
        // Replace the externalId with the new id
        await prisma.file.update({
            where: {
                id: fileId as string
            },
            data: { 
                externalId: newId,
                initialTranscriptionPath: resultPath
            }
        });
        // Send to Nextflow
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
                    resume: false
                })
            }
        ).catch(e => console.error("Could not start Nextflow process", e))
        if (result && result.ok) {
            return { success: true };
        }
        return { success: false };
    }
}