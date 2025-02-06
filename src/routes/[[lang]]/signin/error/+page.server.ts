import type { PageServerLoad } from './$types';
import { prisma } from "$lib/db/client";

export const load = (async ({ params, locals, url}) => {
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
                    id: user.id,
                    email: user.email,
                    image: user.image,
                    name: user.name
                },
                expires: new Date("2099").toISOString()
            }
        }
    }
    const error = url.searchParams.get("error");
    return {
        error,
        session 
    };
}) satisfies PageServerLoad;