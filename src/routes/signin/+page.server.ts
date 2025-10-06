import type { PageServerLoad } from "./$types";
import { prisma } from "$lib/db/client";
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from "$lib/auth";
import { compare } from 'bcrypt';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    console.log('[SIGNIN] Starting signin process...');
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    console.log('[SIGNIN] Form data:', { email, passwordLength: password?.length });

    if (!email || !password) {
      console.log('[SIGNIN] Missing email or password');
      return fail(400, {
        error: 'Email and password are required'
      });
    }

    try {
      console.log('[SIGNIN] Looking up user in database...');
      // Find user in database
      const user = await prisma.user.findUnique({
        where: {
          email: email
        }
      });

      if (!user) {
        console.log('[SIGNIN] User not found for email:', email);
        return fail(400, {
          error: 'Invalid email or password'
        });
      }

      console.log('[SIGNIN] User found, comparing passwords...');
      // Compare password with stored hash
      const isValidPassword = await compare(password, user.password || '');

      if (!isValidPassword) {
        console.log('[SIGNIN] Invalid password for user:', email);
        return fail(400, {
          error: 'Invalid email or password'
        });
      }

      console.log('[SIGNIN] Password valid, creating session...');
      
      // Create a simple session by setting cookies
      cookies.set('session', JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.name,
        loggedIn: true
      }), {
        path: '/',
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
      
      console.log('[SIGNIN] Session created, user authenticated successfully');

      // On success, just return a success status. The client will handle the redirect.
      return { success: true };

    } catch (error) {
      console.error('[SIGNIN] Login error:', error);
      return fail(500, {
        error: 'An error occurred during login'
      });
    }
  }
};

export const load: PageServerLoad = async (event) => {
  event.depends('data:session');
  const session = await event.locals.auth();
  if (session?.user) {
    redirect(302, '/files');
  }
};