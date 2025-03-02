import type { PageServerLoad } from "./$types";
import { prisma } from "$lib/db/client";
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { signIn } from "../../../auth";
import { CredentialsSignin, type AuthError } from '@auth/core/errors'

export const actions = { default: signIn } satisfies Actions

export const load: PageServerLoad = async (event) => {
  event.depends('data:session');
  let session = await event.locals.auth();
  if (session && session.user) return {
    name: session.user.name,
    email: session.user.email,
  };
  else return null;
};