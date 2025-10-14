import type { Actions } from './$types';
import { prisma } from '$lib/db/client';
import { sendEmail, createEmail } from '$lib/email';
import { fail } from '@sveltejs/kit';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { ORIGIN } from '$env/static/private';

export const load = ({ url, fetch }) => {
	const email = url.searchParams.get('email');
	if (email)
		return {
			email
		};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		// 1. Check whether user exists
		const user = await prisma.user.findUnique({
			where: {
				email
			}
		});
		if (!user) {
			return fail(400, { email, doesNotExist: true });
		}
		// 2. Set a reset token and expiry on that user
		const randomBytesPromiseified = promisify(randomBytes);
		const resetToken = (await randomBytesPromiseified(20)).toString('hex');
		const resetTokenExpiry = Date.now() + 3600000 * 24; // 24h
		const res = await prisma.user.update({
			where: { email },
			data: { resetToken, resetTokenExpiry }
		});
		// 3. Email them that reset token
		// TODO: replace language in URL to be dynamic. Required b.c. of Chrome loosing token on redirect
		const mailRes = await sendEmail({
			to: user.email,
			subject: 'Parooli lähtestamise link',
			html: createEmail(`Siin on tellitud parooli lähtestamise link! See aegub 24 tunni jooksul.
            \n\n
            <a href="${ORIGIN}/et/reset?resetToken=${resetToken}">Klõpsa siia, et lähtestada oma parool.</a>`)
		});
		return {
			success: true
		};
	}
};
