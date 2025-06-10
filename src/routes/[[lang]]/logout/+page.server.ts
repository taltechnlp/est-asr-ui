import type { PageServerLoad } from './$types';
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
        if (error instanceof Error && !error.message.includes('Failed to get session')) {
            console.log('Better Auth signout error (unexpected):', error);
        }
        // For "Failed to get session" errors, we silently continue
        // as this is expected when signing out with an expired/invalid session
    }
    
    // Redirect to home page after logout
    throw redirect(302, '/');
}; 