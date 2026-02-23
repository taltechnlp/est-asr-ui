import { prisma } from '$lib/db/client';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const file = await prisma.file.findUnique({
		where: {
			id: params.fileId
		},
		include: {
			User: {
				select: {
					id: true
				}
			}
		}
	});
	const session = await locals.auth();
	if (!session || !session.user.id) {
		error(401, 'unauthorized');
	}
	if (!file || session.user.id !== file.User.id) {
		error(401, 'unauthorized');
	}

	return {
		file: {
			id: file.id,
			state: file.state,
			path: file.path,
			mimetype: file.mimetype,
			name: file.filename,
			uploadedAt: file.uploadedAt
		}
	};
};
