import type { PageServerLoad, Actions } from "./$types";
import { prisma } from "$lib/db/client";
import { fail, redirect } from '@sveltejs/kit';
import { signIn } from "../../../auth";
import { AuthError, CredentialsSignin, OAuthAccountNotLinked } from '@auth/core/errors';
import { defaultLang } from "$lib/i18n";

export const actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const email = formData.get('email') as string | null;
    const password = formData.get('password') as string | null;
    const lang = event.params.lang || event.cookies.get('lang') || defaultLang;

    if (!email || !password) {
      return fail(400, { error: 'MissingCredentials', email });
    }

    try {
      console.log(`[Signin Action] Attempting server-side signIn for: ${email}`);
      await signIn(event, 'credentials', {
        email,
        password,
        redirect: false
      });

      console.log(`[Signin Action] Credentials Signin successful for ${email}. Redirecting...`);
      throw redirect(303, `/${lang}/files`);
    } catch (error) {
      console.error("[Signin Action] Caught error during signIn:", error);

      if (error instanceof CredentialsSignin || (error instanceof AuthError && error.type === CredentialsSignin.type)) {
        console.log("[Signin Action] Returning CredentialsSignin failure.");
        return fail(401, { error: CredentialsSignin.type, email });
      }

      if (error instanceof AuthError) {
        console.log(`[Signin Action] Returning AuthError failure: ${error.type}`);
        return fail(500, { error: error.type, email });
      }

      if (error instanceof Response && error.status >= 300 && error.status < 400) {
        console.log("[Signin Action] Caught redirect, re-throwing.");
        throw error;
      }

      console.log("[Signin Action] Returning UnknownError failure.");
      return fail(500, { error: 'UnknownError', email });
    }
  }
} satisfies Actions;

export const load: PageServerLoad = async (event) => {
  event.depends('data:session');
  const session = await event.locals.auth();
  const lang = event.params.lang || event.cookies.get('lang') || defaultLang;

  if (session?.user) {
    throw redirect(303, `/${lang}/files`);
  }

  const urlError = event.url.searchParams.get("error");
  let errorData = null;

  if (urlError) {
    console.log(`[Signin Load] Detected URL error: ${urlError}`);
    errorData = {
      code: urlError,
    };
  }

  return { urlError: errorData, language: lang };
};