import type { PageServerLoad, Actions } from './$types';
import { prisma } from "$lib/db/client";
import { redirect } from '@sveltejs/kit';
import google from 'svelte-awesome/icons/google';
import facebook from 'svelte-awesome/icons/facebook';
import github from 'svelte-awesome/icons/github';

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
        console.log(provider)
        const account = accounts.accounts.find(x => x.provider === provider);
        if (account) await prisma.account.delete({
            where: {
                id: account.id
            }
        })
        return { success: true };
    }
};