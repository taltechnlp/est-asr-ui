import { error } from '@sveltejs/kit';
import { waitLocale } from 'svelte-i18n';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import type { LayoutServerLoad } from '../../.svelte-kit/types/src/routes/$types';
import { SECRET_KEY } from '$env/static/private';
import { prisma } from "$lib/db/client";

export const load: LayoutServerLoad = async ({ request, locals }) => {
    await waitLocale();
    let session = await locals.getSession();
    if (locals.userId) {
        return {
            id: locals.userId
        }
    }
    else if (session && session.user) {
        return {
            id: session.user.id
        }
    } else {
        return {};
    }
}
