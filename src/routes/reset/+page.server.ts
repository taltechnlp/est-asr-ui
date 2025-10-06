import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db/client';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url}) => {
    const resetToken = url.searchParams.get('resetToken')
    if (resetToken && resetToken.length === 40 ) {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: {
                    equals: resetToken
                }
            }
        })
        if (!user) {
            error(404, 'Token not found');
        }
        // @ts-ignore
        const valid = user.resetTokenExpiry >= Date.now();
        // console.log(resetToken, user.resetTokenExpiry , user, Date.now(), valid)
        return {valid, resetToken};
    }
    error(400, 'No valid resetToken provided');
};