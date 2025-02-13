import type { PageServerLoad, Actions } from './$types';
import { prisma } from "$lib/db/client";
import { fail, redirect } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    let userId = locals.userId;
    if (!userId) {
        let session = await locals.getSession();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId) {
        redirect(307, "/signin");
    }
    const user = await prisma.user.findUnique({
        where: {
           id: userId 
        },
        include: {
            accounts: {
                select: {
                    provider: true,
                }
            },
        }
    })

    return {
        accounts: user.accounts.reduce((acc, x) => {
            acc[x.provider] = true;
            return acc;
        }, {}),
        user: {
            passwordSet: user.password ? true : false,
            emailVerified: user.emailVerified,
            image: user.image
        }
    };
});

export const actions: Actions = {
    remove: async ({ request, locals }) => {
        let userId = locals.userId;
        if (!userId) {
            let session = await locals.getSession();
            if (session && session.user) userId = session.user.id;
        }
        if (!userId) {
            redirect(307, "/signin");
        }
        const accounts = await prisma.user.findUnique({
            where: {
                id: userId
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