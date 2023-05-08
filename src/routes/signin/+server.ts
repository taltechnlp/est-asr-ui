import { prisma } from "$lib/db/client";
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken'
import { SECRET_KEY } from '$env/static/private';
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
    const session = await locals.getSession();
    if (session.user && session.user.email) {
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email
            }
        })
        if (!user) {
            return new Response("", {status: 401})
        }
        const token = jwt.sign({ userId: user.id }, SECRET_KEY);
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
    else return new Response("", {status: 401})

}