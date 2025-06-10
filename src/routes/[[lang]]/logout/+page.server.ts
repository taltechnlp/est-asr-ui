import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth';

export const load: PageServerLoad = async ({ locals, cookies }) => {
    // Clear session cookies immediately
    cookies.delete('session', { path: '/' });
    
    // Try to sign out from Better Auth if there's a session
    try {
        const session = await locals.auth();
        if (session) {
            // This will clear Better Auth session
            await auth.api.signOut({
                headers: new Headers({
                    cookie: cookies.toString()
                })
            });
        }
    } catch (error) {
        // Only log if it's not the expected "session not found" error
        if (!error.message?.includes('Failed to get session')) {
            console.log('Better Auth signout error:', error);
        }
        // Silently ignore "Failed to get session" errors as they're expected during logout
    }
    
    // Redirect to home page
    throw redirect(302, '/');
}; 