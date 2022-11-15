import type { RequestHandler } from './$types';
import { prisma } from '$lib/db/client';
import { error } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
    const { password } = await request.json()

    const valid = password.length > 0;
    if (!valid) {
        throw error(401, 'password')
    }
    const secretKey = SECRET_KEY;
    const token = jwt.sign({ userId: user.id }, secretKey);
    return new Response(JSON.stringify({
        name: user.name,
        email: user.email,
        id: user.id
    }), {
        status: 201,
        headers: {
            'Set-Cookie': serialize('token', token, {
                path: '/',
                httpOnly: true,
                sameSite: 'strict',
                /* secure: process.env.NODE_ENV === 'production', */
                maxAge: 1000 * 60 * 60 * 24 * 365, // one year
            }),
        },
    })
}