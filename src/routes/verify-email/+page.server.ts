import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db/client';
import { fail } from '@sveltejs/kit';
import { compare } from 'bcrypt';
import {
    VERIFICATION_IDENTIFIER_PREFIX,
    EMAIL_CHANGE_IDENTIFIER_PREFIX,
    EMAIL_RE,
    emailTaken,
    requestEmailChange,
    sendVerificationEmail,
    uiLanguage
} from '$lib/server/emailChange';

const consumeToken = async (token: string) => {
    const record = await prisma.verification.findFirst({
        where: {
            value: token,
            OR: [
                { identifier: { startsWith: VERIFICATION_IDENTIFIER_PREFIX } },
                { identifier: { startsWith: EMAIL_CHANGE_IDENTIFIER_PREFIX } }
            ]
        }
    });
    if (!record) return { status: 'invalid' as const };
    if (record.expiresAt.getTime() < Date.now()) {
        await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
        return { status: 'expired' as const };
    }

    if (record.identifier.startsWith(EMAIL_CHANGE_IDENTIFIER_PREFIX)) {
        const rest = record.identifier.slice(EMAIL_CHANGE_IDENTIFIER_PREFIX.length);
        const sep = rest.indexOf(':');
        const userId = rest.slice(0, sep);
        const newEmail = rest.slice(sep + 1);
        if (!userId || !newEmail || (await emailTaken(newEmail, userId))) {
            await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
            return { status: 'changeConflict' as const };
        }
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { email: newEmail, emailVerified: true, emailVerifiedAt: new Date() }
            }),
            prisma.verification.deleteMany({
                where: {
                    OR: [
                        { identifier: { startsWith: `${EMAIL_CHANGE_IDENTIFIER_PREFIX}${userId}:` } },
                        { identifier: `${VERIFICATION_IDENTIFIER_PREFIX}${userId}` }
                    ]
                }
            })
        ]);
        return { status: 'changed' as const };
    }

    const userId = record.identifier.slice(VERIFICATION_IDENTIFIER_PREFIX.length);
    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { emailVerified: true, emailVerifiedAt: new Date() }
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

        const language = uiLanguage(cookies.get('language'));

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });
        // Don't reveal whether the email exists
        if (!user || user.emailVerified || !user.password) {
            return { resendSuccess: true };
        }

        try {
            await sendVerificationEmail(user, language);
        } catch (e) {
            console.error('[VERIFY-EMAIL] Resend failed', e);
        }

        return { resendSuccess: true };
    },

    // Lets someone who mistyped their address at signup fix it without signing
    // in. Only allowed while the account is still unverified and only with the
    // account password; verified accounts change their address on /me.
    change: async ({ request, cookies }) => {
        const data = await request.formData();
        const currentEmail = (data.get('currentEmail') as string | null)?.trim();
        const password = data.get('password') as string | null;
        const newEmail = (data.get('newEmail') as string | null)?.trim().toLowerCase();

        if (!currentEmail || !password || !newEmail) {
            return fail(400, { change: 'missing' as const, currentEmail, newEmail });
        }
        if (!EMAIL_RE.test(newEmail)) {
            return fail(400, { change: 'invalidEmail' as const, currentEmail, newEmail });
        }

        const user = await prisma.user.findFirst({
            where: { email: { equals: currentEmail, mode: 'insensitive' } }
        });
        const passwordOk = !!user && (await compare(password, user.password || ''));
        if (!user || !passwordOk) {
            return fail(400, { change: 'invalidCredentials' as const, currentEmail, newEmail });
        }
        if (user.emailVerified) {
            return fail(400, { change: 'alreadyVerified' as const, currentEmail, newEmail });
        }

        const language = uiLanguage(cookies.get('language'));
        try {
            const error = await requestEmailChange(user, newEmail, language);
            if (error) return fail(400, { change: error, currentEmail, newEmail });
        } catch (e) {
            console.error('[VERIFY-EMAIL] Email change request failed', e);
            return fail(500, { change: 'error' as const, currentEmail, newEmail });
        }

        return { change: 'sent' as const, newEmail };
    }
};
