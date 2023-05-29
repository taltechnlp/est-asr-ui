import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import type { LayoutServerLoad } from '../../.svelte-kit/types/src/routes/$types';
import { SECRET_KEY } from '$env/static/private';
import { prisma } from "$lib/db/client";

export const load: LayoutServerLoad = async ({ request, locals }) => {
    await waitLocale();
    let session = await locals.getSession();
    if (!session && locals.userId) {
        const user = await prisma.user.findUnique({
            where: {
                id: locals.userId
            }
        })
        if (user) {
            session = {
                user: {
                    email: user.email,
                    image: user.image,
                    name: user.name
                },
                expires: new Date("2099").toISOString()
            }
        }
    }
    if (session && session.user) {
        return {
            email: session.user.email
        }
    } else {
        return {};
    }
}
