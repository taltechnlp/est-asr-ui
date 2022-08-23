import { prisma } from "$lib/db/client";

export async function get({ params }) {
    const user = await prisma.user.findUnique({
        where: {
            id: params.id
        }
    })
    if (!user) {
        return {
            status: 404,
            body: {
                error: 'userNotFound',
            },
        };
    }
    return {
        status: 200,
        body: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        },
    };
}
        