import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db/client';
import { fail } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { compare } from 'bcrypt';
import { sendEmail } from '$lib/email';
import { buildVerificationEmail } from '$lib/emails/verifyEmail';
import { buildEmailChangeEmail } from '$lib/emails/changeEmail';
import { generateShortId } from '$lib/utils/generateId';
import { uiLanguages } from '$lib/i18n';

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const VERIFICATION_IDENTIFIER_PREFIX = 'email-verification:';
// Pending address change for an unverified account: `email-change:<userId>:<newEmail>`.
// The address is only written to the user row once the link sent to the new
// address is opened, so a mistyped address can never lock someone out.
const EMAIL_CHANGE_IDENTIFIER_PREFIX = 'email-change:';

const randomBytesAsync = promisify(randomBytes);
const newToken = async () => (await randomBytesAsync(20)).toString('hex');

const EMAIL_RE =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const emailTaken = async (email: string, exceptUserId: string) => {
    const other = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, id: { not: exceptUserId } },
        select: { id: true }
    });
    return !!other;
};

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
                data: { email: newEmail, emailVerified: new Date() }
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

const uiLanguage = (cookieLang: string | undefined) =>
    cookieLang && uiLanguages.includes(cookieLang) ? cookieLang : 'et';

export const actions: Actions = {
    resend: async ({ request, cookies }) => {
        const data = await request.formData();
        const email = (data.get('email') as string | null)?.trim().toLowerCase();
        if (!email) return fail(400, { resendInvalid: true });

        const language = uiLanguage(cookies.get('language'));

        const user = await prisma.user.findUnique({ where: { email } });
        // Don't reveal whether the email exists
        if (!user || user.emailVerified || !user.password) {
            return { resendSuccess: true };
        }

        try {
            await prisma.verification.deleteMany({
                where: { identifier: `${VERIFICATION_IDENTIFIER_PREFIX}${user.id}` }
            });
            const token = await newToken();
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
    },

    // Lets someone who mistyped their address at signup fix it. Only allowed
    // while the account is still unverified, only with the account password,
    // and the change takes effect only after the new address confirms it.
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
        if (newEmail === user.email.toLowerCase()) {
            return fail(400, { change: 'sameEmail' as const, currentEmail, newEmail });
        }
        if (await emailTaken(newEmail, user.id)) {
            return fail(400, { change: 'emailTaken' as const, currentEmail, newEmail });
        }

        const language = uiLanguage(cookies.get('language'));
        try {
            await prisma.verification.deleteMany({
                where: { identifier: { startsWith: `${EMAIL_CHANGE_IDENTIFIER_PREFIX}${user.id}:` } }
            });
            const token = await newToken();
            await prisma.verification.create({
                data: {
                    id: generateShortId(),
                    identifier: `${EMAIL_CHANGE_IDENTIFIER_PREFIX}${user.id}:${newEmail}`,
                    value: token,
                    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
                }
            });
            const { subject, html } = buildEmailChangeEmail(token, language);
            await sendEmail({ to: newEmail, subject, html });
        } catch (e) {
            console.error('[VERIFY-EMAIL] Email change request failed', e);
            return fail(500, { change: 'error' as const, currentEmail, newEmail });
        }

        console.log(`[VERIFY-EMAIL] Email change requested for user ${user.id} -> ${newEmail}`);
        return { change: 'sent' as const, newEmail };
    }
};
