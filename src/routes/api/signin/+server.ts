import { prisma } from "$lib/db/client";
import { serialize } from 'cookie';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import {variables} from '$lib/variables'

export async function post({ request }) {
    const { email, password } = await request.json() 
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    })
    if (!user) {
        return {
            status: 401,
            body: {
                error: 'email',
            },
        };
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
     return {
         status: 401,
         body: {
             error: 'password',
         },
     };
    }

    const token = jwt.sign({ userId: user.id }, variables.secretKey);
    return {
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
        body: {
            message: 'success',
        },
       };
}