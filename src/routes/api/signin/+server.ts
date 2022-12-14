import { prisma } from "$lib/db/client";
import { serialize } from 'cookie';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { SECRET_KEY } from '$env/static/private';
import type { RequestHandler } from "./$types";
import { error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    const { email, password } = await request.json()
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    })
    if (!user) {
        throw error(401, 'email')
    }

    const valid = await bcrypt.compare(password, user.password);
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