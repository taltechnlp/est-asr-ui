import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db/client";
import { 
    AUTH_SECRET, 
    FACEBOOK_CLIENT_ID, 
    FACEBOOK_CLIENT_SECRET, 
    GOOGLE_CLIENT_ID, 
    GOOGLE_CLIENT_SECRET 
} from "$env/static/private";
import { generateShortId } from "./utils/generateId";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    
    secret: AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
    
    // Field mappings for account model - Better Auth expects different field names
    account: {
        fields: {
            accountId: "providerAccountId", // Map Better Auth's accountId to our providerAccountId
            providerId: "provider",         // Map Better Auth's providerId to our provider
        }
    },
    
    // User field configuration to handle emailVerified properly
    user: {
        fields: {
            emailVerified: "emailVerified"
        },
        additionalFields: {
            // When the address was confirmed. Set by the hooks below, never by clients.
            emailVerifiedAt: {
                type: "date",
                required: false,
                input: false,
                returned: false
            }
        }
    },
    
    // Database hooks to handle data transformation
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    // Social sign-ups arrive with a confirmed address
                    if (user.emailVerified) {
                        return {
                            data: { ...user, emailVerifiedAt: new Date() },
                        };
                    }
                },
            },
            update: {
                before: async (user) => {
                    // Keep emailVerifiedAt in step when better-auth changes emailVerified
                    if (typeof user.emailVerified === 'boolean') {
                        return {
                            data: { ...user, emailVerifiedAt: user.emailVerified ? new Date() : null },
                        };
                    }
                },
            },
        },
    },
    
    // Configure email verification handling
    emailVerification: {
        sendOnSignUp: false, // Don't send verification emails automatically
        autoSignInAfterVerification: true,
    },
    
    socialProviders: {
        facebook: {
            clientId: FACEBOOK_CLIENT_ID,
            clientSecret: FACEBOOK_CLIENT_SECRET,
        },
        google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
        },
    },
    
    // Passwords go through the app's own /signup and /signin (bcrypt in user.password,
    // behind the email confirmation gate). better-auth's password endpoints would hand
    // out sessions without that gate, so they stay off.
    emailAndPassword: {
        enabled: false,
    },
    
    // Custom pages configuration
    // pages: {
    //     signIn: "/signin",
    //     signUp: "/signup",
    //     resetPassword: "/reset-password",
    //     verifyEmail: "/verify-email",
    // },
    
    trustedOrigins: [
        "http://localhost:5174", // Current dev server port
        "http://localhost:5173", // Alternative port
        "http://localhost:4173", // SvelteKit preview
        // Add your production domains here
    ],

    // Cookie configuration for proper logout in development
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5 // 5 minutes
        }
    },
    
    // Configure ID generation to use shorter IDs
    advanced: {
        database: {
            generateId: generateShortId
        }
    },
}); 
