import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from "$lib/db/client";
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync} from 'fs';
import { RESULTS_DIR } from '$env/static/private';
import { base } from '$app/paths';

export const load = (async ({ locals, fetch }) => {
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

    // Use a for...of loop instead of forEach for proper async/await handling
    for (const file of files) {
        // Check if the file was uploaded more than 3 hours ago
        // Also check if the state is 'PROCESSING' (it might be 'PROCESSING_ERROR')
        if ((file.state === 'PROCESSING' || file.state === 'UPLOADED') && file.uploadedAt < new Date(Date.now() - 3 * 60 * 60 * 1000)) {
            // Generate a new id that conforms to the required pattern
            // ^[a-z](?:[a-z\d]|[-_](?=[a-z\d])){0,79}$
            let baseId = uuidv4();
            // Remove hyphens and take a substring (e.g., 29 chars to keep total length 30)
            baseId = baseId.replace(/[-]/gi, '').substring(0, 29);
            // Prepend 'r' to ensure it starts with a letter
            const newId = `r${baseId}`;

            // Check if the original file path exists before proceeding
            if (!existsSync(file.path)) {
                console.error(`File path does not exist, skipping resume: ${file.path}`);
                // Optionally update the state to an error state here if needed
                // await prisma.file.update({ where: { id: file.id }, data: { state: 'PROCESSING_ERROR', statusMessage: 'Original file missing' } });
                continue; // Skip to the next file
            }

            const resultDir = join(RESULTS_DIR, session.user.id, newId);
            const resultPath = join(resultDir, "result.json");

            try {
                // Update the database first
                await prisma.file.update({
                    where: {
                        id: file.id
                    },
                    data: {
                        externalId: newId,
                        initialTranscriptionPath: resultPath,
                        state: 'PROCESSING'
                    }
                });

                // Send to Nextflow using the SvelteKit fetch
                const result = await fetch( // Use the fetch from load arguments
                    `/api/transcribe`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            fileId: newId, // Use the new ID
                            filePath: file.path,
                            resultDir: resultDir,
                            workflowName: newId, // Use the new ID
                            resume: false 
                        })
                    }
                );

                if (!result.ok) {
                    // Handle fetch error (e.g., log, update DB state)
                    console.error(`Failed to trigger /api/transcribe for file ${file.id}. Status: ${result.status}`);
                    // Optionally revert DB changes or set an error state
                    await prisma.file.update({
                        where: { id: file.id },
                        data: { state: 'PROCESSING_ERROR' }
                    });
                } else {
                    console.log(`Successfully triggered resume for file ${file.id} with new externalId ${newId}`);
                    // Optionally update state to indicate processing has been re-initiated
                    // await prisma.file.update({ where: { id: file.id }, data: { state: 'PROCESSING' } });
                }

            } catch (e) {
                console.error(`Error processing file ${file.id}:`, e);
                // Optionally update DB state to reflect the error during this process
                try {
                    await prisma.file.update({
                        where: { id: file.id },
                        data: { state: 'PROCESSING_ERROR' }
                    });
                } catch (dbError) {
                    console.error(`Failed to update error state for file ${file.id}:`, dbError);
                }
            }
        } else if (file.state === 'PROCESSING_ERROR') {
             // Handle files that are already in error state if needed,
             // maybe log them or attempt retry based on different logic
             // console.log(`File ${file.id} is in PROCESSING_ERROR state, skipping automatic resume.`);
        }

        // Add a delay of 1 second between each file processing attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
    } // End of for...of loop

    // Re-fetch files after potential updates to reflect current state on the page
    const updatedFiles = await prisma.file.findMany({
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
            path: true,
        },
        orderBy: {
            uploadedAt: 'desc'
        }
    });

    return { files: updatedFiles, session }; // Return the potentially updated list
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