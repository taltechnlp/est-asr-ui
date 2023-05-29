import type { RequestHandler } from './$types';
import { prisma } from '$lib/db/client';
import { error } from "@sveltejs/kit";
import { hash } from 'bcrypt'

export const POST: RequestHandler = async ({ request }) => {
    const { password, resetToken } = await request.json()
    const hashedPassword = await hash(password, 10);
    const valid = password && password.length > 0;
    if (!valid) {
        throw error(401, 'password')
    }
    // Find user ID
    const user = await prisma.user.findFirst({
        where: {
            resetToken: {
                equals: resetToken
            }
        }
    })
    if (!user) {
        throw error(401, 'userNotFound')
    }
    const result = await prisma.user.update({
        where: {
            id: user.id
        },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: Date.UTC(1970, 1, 1)
        }
    })
    return new Response("ok")
}