import { prisma } from "$lib/db/client";


export async function PUT({ url }) {
    const id = url.searchParams.get('id');

    return new Response(undefined);
}