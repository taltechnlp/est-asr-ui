import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/db/client';
import { redirect } from '@sveltejs/kit';
import google from 'svelte-awesome/icons/google';
import facebook from 'svelte-awesome/icons/facebook';
import github from 'svelte-awesome/icons/github';
import { auth } from '$lib/auth';

export const load = async (event) => {
	let session = await event.locals.auth();
	if (!session || !session.user || !session.user.id) {
		redirect(307, '/signin');
	}
	let accounts = {
		google: false,
		facebook: false,
		github: false
	};
	const user = await prisma.user.findUnique({
		where: {
			id: session.user.id
		},
		include: {
			accounts: {
				select: {
					provider: true
				}
			}
		}
	});
	if (!user) {
		return {
			accounts,
			user: {}
		};
	}
	if (user.accounts) {
		user.accounts.forEach((account) => {
			accounts[account.provider] = true;
		});
	}
	return {
		accounts,
		user: {
			passwordSet: user.password ? true : false,
			emailVerified: user.emailVerified,
			image: user.image
		}
	};
};

export const actions: Actions = {
	remove: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session || !session.user.id) {
			redirect(307, '/signin');
		}
		const accounts = await prisma.user.findUnique({
			where: {
				id: session.user.id
			},
			include: {
				accounts: {
					select: {
						provider: true,
						id: true
					}
				}
			}
		});
		const data = await request.formData();
		const provider = data.get('provider');
		// console.log(provider)
		const account = accounts.accounts.find((x) => x.provider === provider);
		if (account)
			await prisma.account.delete({
				where: {
					id: account.id
				}
			});
		return { success: true };
	},

	logout: async ({ cookies }) => {
		// 1. Force clear the custom password-based session cookie
		cookies.delete('session', { path: '/' });

		// 2. Force clear the Better Auth session cookie by its specific name
		cookies.delete('better-auth.session_token', { path: '/' });

		// 3. Attempt a graceful sign-out from the API as a fallback
		try {
			await auth.api.signOut({
				headers: new Headers({
					cookie: cookies.toString()
				} as HeadersInit)
			});
		} catch (error) {
			// It's normal for signOut to fail if cookies are already gone.
			if (error instanceof Error && !error.message.includes('No session found')) {
				console.error('Better Auth signout error (graceful fallback failed):', error);
			}
		}

		// 4. Redirect to the sign-in page to complete the logout
		redirect(302, '/signin');
	}
};
