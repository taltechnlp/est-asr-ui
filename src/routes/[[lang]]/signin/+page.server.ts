import type { PageServerLoad } from "./$types";
import { prisma } from "$lib/db/client";
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { signIn } from "../../../auth";

export const actions = { default: signIn } satisfies Actions

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