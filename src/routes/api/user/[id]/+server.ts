import { prisma } from "$lib/db/client";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    const user = await prisma.user.findUnique({
        where: {
           id: params.id
        }
    })
    if (!user) {
        return json({
            ok: false,
            body: {
                error: 'userNotFound',
            },
        });
    }
    return json({
        ok: true,
        body: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        },
    });
}
        