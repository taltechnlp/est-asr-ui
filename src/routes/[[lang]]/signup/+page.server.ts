import type { Actions } from './$types'
import { prisma } from "$lib/db/client";
import { hash } from 'bcrypt'
import { v4 as uuidv4 } from 'uuid';
import { sendEmail, createEmail } from '$lib/email';
import { fail } from '@sveltejs/kit';
import { uiLanguages } from '$lib/i18n';
import { auth } from '$lib/auth';

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

export async function load({ params, url }) {
    return { 
        name: url.searchParams.get("name"),
        email: url.searchParams.get("email")
    }
}

export const actions: Actions = {
    register: async ({ cookies, request, params }) => {
        let error = false;
        const data = await request.formData();
        const email = data.get('email') as string;
        const password = data.get('password') as string;
        const name = data.get('name') as string;
        let language = params.lang || cookies.get("language");
        if (!language || !uiLanguages.includes(language)){
            language = "et";
        }
        if (!validateEmail(email)) {
            return fail(400, { email, invalid: true });
        }

        try {
            // Use Better Auth's signup API
            const result = await auth.api.signUpEmail({
                body: {
                    email,
                    password,
                    name
                },
                headers: request.headers
            });

            if (result.user) {
                // Send welcome email
                const signupMailRes = await sendEmail({
                    to: result.user.email,
                    subject: "Konto loodud",
                    html: createEmail(`Konto e-posti aadressiga ${result.user.email} edukalt loodud!
                    \n\n
                    `)
                }).catch(e => console.log("User creation email sending failed", e));

                console.log("User created", result.user.id, result.user.email, result.user.name);
                return { success: true, user: {
                    id: result.user.id,
                    email: result.user.email,
                    name: result.user.name
                } };
            } else {
                console.error("Signup failed: No user returned from Better Auth");
                return fail(400, {retry: true});
            }
        } catch (e) {
            console.error("Error during signup", e);
            
            // Check if it's a duplicate email error
            if (e.message && e.message.includes('email')) {
                return fail(400, { email, exists: true });
            }
            
            return fail(400, {retry: true});
        }
    }
};