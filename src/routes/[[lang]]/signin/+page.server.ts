import type { PageServerLoad } from "./$types";
import { prisma } from "$lib/db/client";
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { signIn } from "../../../auth";
import { CredentialsSignin, type AuthError } from '@auth/core/errors'

// export const actions = { default: signIn } satisfies Actions
export const actions: Actions = {
  default: async (event) => {
    let error = null;
    try {
      await signIn(event);
      console.log("signin ended")
    } catch (error: unknown) { 
      console.log("handling signin error")
      if ( error instanceof CredentialsSignin) {
        error = { email: error.message, message: 'Invalid email or password.' }
      }
      else {
        error = { message: 'An unexpected error occurred.' };
        // return fail(501, { message: 'An unexpected error occurred.' });
      }
    }
    console.log("returning")
    if (error) return fail(400, error);
    else return { success: true, message: 'Login successful' };
  }
};


export const load: PageServerLoad = async (event) => {
  let session = await event.locals.auth();
  if (!session && event.locals.userId) {
    const user = await prisma.user.findUnique({
      where: {
        id: event.locals.userId
      }
    })
    if (user) {
      session = {
        user: {
          id: user.id,
          email: user.email,
          image: user.image,
          name: user.name 
        }, 
        expires: new Date("2099").toISOString()    }
    } 
  }
  return {session}; 
};