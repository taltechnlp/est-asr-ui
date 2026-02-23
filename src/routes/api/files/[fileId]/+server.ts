import { prisma } from '$lib/db/client';
import { promises as fs } from 'fs';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function getOwnedFile(fileId: string, userId: string) {
	const file = await prisma.file.findUnique({
		where: {
			id: fileId
		},
		select: {
			path: true,
			initialTranscriptionPath: true,
			User: {
				select: {
					id: true
				}
			}
		}
	});

	if (!file || file.User.id !== userId) {
		error(404, 'fileNotFound');
	}

	return file;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session || !session.user.id) {
		error(401, 'Not authenticated user');
	}

	const file = await getOwnedFile(params.fileId, session.user.id);
	let transcription = '';
	try {
		transcription = await fs.readFile(file.initialTranscriptionPath, 'utf8');
	} catch (readError) {
		console.log('Failed to read transcription file', readError);
		error(500, 'fileReadError');
	}

	return new Response(transcription, {
		status: 200,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session || !session.user.id) {
		error(401, 'Not authenticated user');
	}

	const file = await getOwnedFile(params.fileId, session.user.id);
	await fs.rm(file.path).catch((deleteError) => {
		console.log('Failed to remove file from disk!', deleteError);
	});

	await prisma.file
		.delete({
			where: {
				id: params.fileId
			}
		})
		.catch((deleteError) => {
			console.log('Failed to remove file from DB!', deleteError);
			error(503, 'fileNotDeleted');
		});

	console.log(`file ${params.fileId} deleted`);
	return new Response('', { status: 200 });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const session = await locals.auth();
	if (!session || !session.user.id) {
		error(401, 'Not authenticated user');
	}

	const editorContent = await request.json();
	const file = await getOwnedFile(params.fileId, session.user.id);

	let success = false;
	try {
		await fs.writeFile(file.initialTranscriptionPath, JSON.stringify(editorContent));
		success = true;
	} catch (writeError) {
		console.log(writeError, file.initialTranscriptionPath);
		success = false;
	}

	if (success) {
		return new Response('', { status: 201 });
	}

	error(500, 'fileWriteError');
};
