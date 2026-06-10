import type { Actions } from './$types'
import { prisma } from "$lib/db/client";
import { hash } from 'bcrypt'
import { sendEmail } from '$lib/email';
import { buildVerificationEmail } from '$lib/emails/verifyEmail';
import { fail, redirect } from '@sveltejs/kit';
import { uiLanguages } from '$lib/i18n';
import { generateShortId } from '$lib/utils/generateId';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const VERIFICATION_IDENTIFIER_PREFIX = 'email-verification:';

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

export async function load(event) {
    const session = await event.locals.auth();
    if (session?.user) {
        redirect(302, '/files');
    }

    return { 
        name: event.url.searchParams.get("name"),
        email: event.url.searchParams.get("email")
    }
}

export const actions: Actions = {
    register: async ({ cookies, request, params }) => {
        console.log('[SIGNUP] Starting registration process...');
        let error = false;
        const data = await request.formData();
        const email = data.get('email') as string;
        const password = data.get('password') as string;
        const name = data.get('name') as string;
        
        console.log('[SIGNUP] Form data received:', {
            email,
            name,
            passwordLength: password?.length
        });


        let language = cookies.get("language");
        if (!language || !uiLanguages.includes(language)){
            language = "et";
        }
        
        if (!email || !password || !name) {
            console.log('[SIGNUP] Missing required fields');
            return fail(400, { email, invalid: true });
        }
        
        if (!validateEmail(email)) {
            console.log('[SIGNUP] Invalid email format:', email);
            return fail(400, { email, invalid: true });
        }

        console.log('[SIGNUP] Creating user manually with Prisma...');
        try {
            // Check if user already exists
            console.log('[SIGNUP] Checking if user exists for email:', email);
            const existingUser = await prisma.user.count({
                where: {
                    email: email
                }
            });
            console.log('[SIGNUP] Existing user count for', email, ':', existingUser);

            if (existingUser > 0) {
                console.log('[SIGNUP] User already exists:', email);
                return fail(400, { email, exists: true });
            }

            // Hash the password
            const hashedPassword = await hash(password, 10);
            console.log('[SIGNUP] Password hashed, creating user...');

            // Create user manually with generated ID
            const userId = generateShortId();
            const user = await prisma.user.create({
                data: {
                    id: userId,
                    email,
                    name,
                    password: hashedPassword,
                    // createdAt, updatedAt will be auto-generated
                }
            });

            console.log('[SIGNUP] User created successfully:', user.id, user.email);

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
            await sendEmail({ to: user.email, subject, html })
                .catch(e => console.log('Verification email sending failed', e));

            console.log("User created", user.id, user.email, user.name);
            return { success: true, user: {
                id: user.id,
                email: user.email,
                name: user.name
            } };
        } catch (e) {
            console.error("[SIGNUP] Error during signup", e);
            console.error("[SIGNUP] Error details:", {
                message: e.message,
                stack: e.stack,
                name: e.name,
                cause: e.cause
            });
            
            // Check if it's a duplicate email error
            if (e.message && e.message.includes('email')) {
                console.log('[SIGNUP] Duplicate email error');
                return fail(400, { email, exists: true });
            }
            
            return fail(400, {retry: true});
        }
    }
};