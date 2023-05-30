import type { Actions } from './$types'
import { prisma } from "$lib/db/client";
import { hash } from 'bcrypt'
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken'
import { sendMail, createEmail } from '$lib/email';
import { fail } from '@sveltejs/kit';
import { SECRET_KEY } from '$env/static/private';

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

export async function load({ params, url }) {
    return { 
        name: url.searchParams.get("name"),
        email: url.searchParams.get("email")
    }
}

export const actions: Actions = {
    register: async ({ cookies, request }) => {
        const data = await request.formData();
        const email = data.get('email') as string;
        const password = data.get('password') as string;
        const name = data.get('name') as string;
        const random = data.get('random')

        if (!validateEmail(email)) {
            return fail(400, { email, incorrect: true });
        }
        const userCount = await prisma.user.count({
            where: {
                email
            }
        })
        if (userCount > 0) {
            return fail(400, { email, exists: true });
        }
        const hashedPassword = await hash(password, 10);
        let id = uuidv4()
        id = id.replace(/[-]/gi, '').substr(0, 30) // 30 char limit & no hyphens
        const user = await prisma.user.create({
            data: {
                id,
                email,
                password: hashedPassword,
                name
            }
        });
        const signupMailRes = await sendMail({
            to: user.email,
            subject: "Konto loodud",
            html: createEmail(`Konto e-posti aadressiga ${user.email} edukalt loodud! Peaksid olema ka kohe automaatselt sisse logitud.
            \n\n
            `)
        });

        // Create JWT token for the users
        const token = jwt.sign({ userId: user.id }, SECRET_KEY);
        cookies.set("token", token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
            path: '/',
            sameSite: 'strict',
          });

        return { success: true, user: {
            id: user.id,
            email: user.email,
            name: user.name
        } };
    }
};