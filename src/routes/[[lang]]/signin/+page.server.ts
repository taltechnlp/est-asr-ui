import type { PageServerLoad } from "./$types";
import { prisma } from "$lib/db/client";
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from "$lib/auth";

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    if (!email || !password) {
      return fail(400, {
        error: 'Email and password are required'
      });
    }

    try {
      const result = await auth.api.signInEmail({
        body: {
          email,
          password,
        },
        headers: request.headers
      });

      // Better Auth returns successful result with user data
      if (result.user) {
        return { success: true, user: result.user };
      } else {
        return fail(400, {
          error: 'Invalid email or password'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      return fail(500, {
        error: 'An error occurred during login'
      });
    }
  }
};

export const load: PageServerLoad = async (event) => {
  event.depends('data:session');
  let session = await event.locals.auth();
  if (session && session.user) return {
    name: session.user.name,
    email: session.user.email,
  };
  else return null;
};