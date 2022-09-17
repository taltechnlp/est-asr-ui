import { prisma } from "$lib/db/client";

export async function PUT({ request, url }) {
    const id = url.searchParams.get('id');
    if (id) {
        const file = prisma.file.findFirst({
            where: {
                externalId: id
            }
        })      
        if (file) {

        }
    }
    return new Response(undefined);
}