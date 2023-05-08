import type { PageServerLoad, Actions } from './$types';
import { prisma } from "$lib/db/client";
import { fail, redirect } from '@sveltejs/kit';

export const load = (async ({locals}) => {
    if (!locals.userId) {
        throw redirect(307, "/signin");
    } else {
        const accounts = await prisma.account.findMany({
            where: {
                userId: locals.userId
            },
            select: {
                provider: true
            }
        })
        return {accounts: accounts.reduce((acc, x)=> {
            acc[x.provider] = true;
            return acc;
        },{})};
    }
});

export const actions: Actions = {
    remove: async ({ request, locals }) => {
        if (!locals.userId) {
            throw redirect(307, "/signin");
        }
        const accounts = await prisma.user.findUnique({
            where: {
                id: locals.userId
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
        const account= accounts.accounts.find(x=>x.provider===provider);
        if (account) await prisma.account.delete({
            where: {
                id: account.id
            }
        })
        return { success: true };
    }
};