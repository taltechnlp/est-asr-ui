import type { RequestHandler } from './$types';
import { prisma } from '$lib/db/client';
import { error } from '@sveltejs/kit';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { sendEmail, createEmail } from '$lib/email';
import { ORIGIN } from '$env/static/private';

export const POST: RequestHandler = async ({ params, url }) => {
	// Check whether user exists
	const user = await prisma.user.findUnique({
		where: {
			email: params.email
		}
	});
	if (!user) {
		error(403, 'No user with this email');
	}
	const randomBytesPromiseified = promisify(randomBytes);
	const resetToken = (await randomBytesPromiseified(20)).toString('hex');
	const resetTokenExpiry = Date.now() + 3600000 * 24; // 1 hour from now
	// 2. Set a reset token and expiry on that user
	const res = await prisma.user.update({
		where: { email: params.email },
		data: { resetToken, resetTokenExpiry }
	});
	// 3. Email them that reset token
	const mailRes = await sendEmail({
		to: user.email,
		subject: 'Parooli lähtestamise link',
		html: createEmail(`Siin on tellitud parooli lähtestamise link! See aegub 24 tunni jooksul.
    \n\n
    <a href="${ORIGIN}/reset?resetToken=${resetToken}">Klõpsa siia, et lähtestada oma parool.</a>`)
	});
	return new Response('', { status: 201, statusText: 'resetTokenCreated' });
};
