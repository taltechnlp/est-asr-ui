import type { PageLoad } from './$types';
import { prisma } from '$lib/db/client';

export const load: PageLoad = async ({ params, data, url, routeId }) => {
    const resetToken = url.searchParams.get('resetToken')
    if (resetToken && resetToken.length === 40 ) {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: {
                    equals: resetToken
                }
            }
        })
        const valid = user.resetTokenExpiry > Date.now();
        console.log(resetToken, user, Date.now(), valid)
    }
    return {};
};