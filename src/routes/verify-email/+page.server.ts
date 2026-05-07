import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db/client';
import { fail } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { sendEmail } from '$lib/email';
import { buildVerificationEmail } from '$lib/emails/verifyEmail';
import { generateShortId } from '$lib/utils/generateId';
import { uiLanguages } from '$lib/i18n';

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const VERIFICATION_IDENTIFIER_PREFIX = 'email-verification:';

const consumeToken = async (token: string) => {
    const record = await prisma.verification.findFirst({
        where: {
            value: token,
            identifier: { startsWith: VERIFICATION_IDENTIFIER_PREFIX }
        }
    });
    if (!record) return { status: 'invalid' as const };
    if (record.expiresAt.getTime() < Date.now()) {
        await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
        return { status: 'expired' as const };
    }
    const userId = record.identifier.slice(VERIFICATION_IDENTIFIER_PREFIX.length);
    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { emailVerified: new Date() }
        }),
        prisma.verification.delete({ where: { id: record.id } })
    ]);
    return { status: 'verified' as const };
};

export const load: PageServerLoad = async ({ url }) => {
    const token = url.searchParams.get('token');
    if (!token) {
        return { status: 'noToken' as const };
    }
    try {
        const result = await consumeToken(token);
        return { status: result.status };
    } catch (e) {
        console.error('[VERIFY-EMAIL] Failed to verify token', e);
        return { status: 'error' as const };
    }
};

export const actions: Actions = {
    resend: async ({ request, cookies }) => {
        const data = await request.formData();
        const email = (data.get('email') as string | null)?.trim().toLowerCase();
        if (!email) return fail(400, { resendInvalid: true });

        let language = cookies.get('language');
        if (!language || !uiLanguages.includes(language)) language = 'et';

        const user = await prisma.user.findUnique({ where: { email } });
        // Don't reveal whether the email exists
        if (!user || user.emailVerified || !user.password) {
            return { resendSuccess: true };
        }

        try {
            await prisma.verification.deleteMany({
                where: { identifier: `${VERIFICATION_IDENTIFIER_PREFIX}${user.id}` }
            });
            const randomBytesAsync = promisify(randomBytes);
            const token = (await randomBytesAsync(20)).toString('hex');
            await prisma.verification.create({
                data: {
                    id: generateShortId(),
                    identifier: `${VERIFICATION_IDENTIFIER_PREFIX}${user.id}`,
                    value: token,
                    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
                }
            });
            const { subject, html } = buildVerificationEmail(token, language);
            await sendEmail({ to: user.email, subject, html });
        } catch (e) {
            console.error('[VERIFY-EMAIL] Resend failed', e);
        }

        return { resendSuccess: true };
    }
};
