import type { PageServerLoad, Actions } from './$types';
import { prisma } from "$lib/db/client";
import { redirect } from '@sveltejs/kit';
import google from 'svelte-awesome/icons/google';
import facebook from 'svelte-awesome/icons/facebook';
import github from 'svelte-awesome/icons/github';
import { auth } from '$lib/auth';
import { parseSetCookieHeader } from 'better-auth/cookies';

export const load = (async (event) => {
    let session = await event.locals.auth();
    if (!session || !session.user || !session.user.id) {
        redirect(307, "/signin");
    }
    let accounts = {
        google: false,
        facebook: false,
        github: false
    }
    const user = await prisma.user.findUnique({
        where: {
           id: session.user.id 
        },
        include: {
            accounts: {
                select: {
                    provider: true,
                }
            },
        }
    }); 
    if (!user) {
        return {
            accounts,
            user: {}
        }
    };
    if ( user.accounts ) {
        user.accounts.forEach(account => {
            accounts[account.provider] = true;
        });
    }
    return {
        accounts,
        user: {
            passwordSet: user.password ? true : false,
            emailVerified: user.emailVerified,
            image: user.image
        }
    };
});

export const actions: Actions = {
    remove: async ({ request, locals }) => {
        const session = await locals.auth();
        if (!session || !session.user.id) {
            redirect(307, "/signin");
        }
        const accounts = await prisma.user.findUnique({
            where: {
                id: session.user.id
            },
            include: {
                accounts: {
                    select: {
                        provider: true,
                        id: true
                    }
                }
            }
        })
        const data = await request.formData();
        const provider = data.get('provider')
        // console.log(provider)
        const account = accounts.accounts.find(x => x.provider === provider);
        if (account) await prisma.account.delete({
            where: {
                id: account.id
            }
        })
        return { success: true };
    },

    logout: async ({ request, cookies }) => {
        // Better Auth's signOut invalidates the server-side session and returns
        // Set-Cookie headers that clear the browser's session cookies. Without
        // forwarding those, the cookie cache (better-auth.session_data, valid
        // for 5 min) keeps the user appearing logged in for Google/Facebook
        // sign-ins.
        try {
            const result = await auth.api.signOut({
                headers: request.headers,
                returnHeaders: true,
            });
            const setCookie = result.headers.get('set-cookie');
            if (setCookie) {
                const parsed = parseSetCookieHeader(setCookie);
                for (const [name, attrs] of parsed) {
                    cookies.delete(name, { path: attrs.path || '/' });
                }
            }
        } catch (error) {
            console.log('[LOGOUT] Error during signOut:', error);
        }

        // Also clear the legacy session cookie used by email/password sign-in
        cookies.delete('session', { path: '/' });

        redirect(302, '/signin');
    }
};