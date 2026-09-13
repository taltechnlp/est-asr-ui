import { prisma } from '$lib/db/client';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { sendEmail } from '$lib/email';
import { buildVerificationEmail } from '$lib/emails/verifyEmail';
import { buildEmailChangeEmail } from '$lib/emails/changeEmail';
import { generateShortId } from '$lib/utils/generateId';
import { uiLanguages } from '$lib/i18n';

export const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
// Address verification for an account: `email-verification:<userId>`
export const VERIFICATION_IDENTIFIER_PREFIX = 'email-verification:';
// Pending address change: `email-change:<userId>:<newEmail>`.
// The address is only written to the user row once the link sent to the new
// address is opened, so a mistyped address can never lock someone out.
export const EMAIL_CHANGE_IDENTIFIER_PREFIX = 'email-change:';

const randomBytesAsync = promisify(randomBytes);
export const newToken = async () => (await randomBytesAsync(20)).toString('hex');

export const EMAIL_RE =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const uiLanguage = (cookieLang: string | undefined) =>
    cookieLang && uiLanguages.includes(cookieLang) ? cookieLang : 'et';

export const emailTaken = async (email: string, exceptUserId: string) => {
    const other = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, id: { not: exceptUserId } },
        select: { id: true }
    });
    return !!other;
};

/** Sends a fresh verification link for the account's current address. */
export const sendVerificationEmail = async (user: { id: string; email: string }, language: string) => {
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
};

export type EmailChangeError = 'invalidEmail' | 'sameEmail' | 'emailTaken';

/**
 * Validates a requested address change and, if acceptable, records it and
 * mails a confirmation link to the new address. Returns an error code or
 * null when the confirmation mail was sent. Throws if sending fails.
 */
export const requestEmailChange = async (
    user: { id: string; email: string },
    newEmail: string,
    language: string
): Promise<EmailChangeError | null> => {
    if (!EMAIL_RE.test(newEmail)) return 'invalidEmail';
    if (newEmail === user.email.toLowerCase()) return 'sameEmail';
    if (await emailTaken(newEmail, user.id)) return 'emailTaken';

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
    console.log(`[EMAIL-CHANGE] Change requested for user ${user.id} -> ${newEmail}`);
    return null;
};
