import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { 
    AUTH_SECRET, 
    FACEBOOK_CLIENT_ID, 
    FACEBOOK_CLIENT_SECRET, 
    GOOGLE_CLIENT_ID, 
    GOOGLE_CLIENT_SECRET 
} from "$env/static/private";

const prisma = new PrismaClient();

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    
    secret: AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5174",
    
    // Field mappings for account model - Better Auth expects different field names
    account: {
        fields: {
            accountId: "providerAccountId", // Map Better Auth's accountId to our providerAccountId
            providerId: "provider",         // Map Better Auth's providerId to our provider
        }
    },
    
    // Add callbacks to handle user data transformation
    callbacks: {
        user: {
            async beforeCreate(user) {
                // Transform emailVerified from boolean to DateTime/null
                if (typeof user.emailVerified === 'boolean') {
                    user.emailVerified = user.emailVerified ? new Date() : null;
                }
                return user;
            }
        }
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
    
    // Configure email and password authentication
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Set to true if you want email verification
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
        "http://localhost:5173", // SvelteKit dev server  
        "http://localhost:4173", // SvelteKit preview
        // Add your production domains here
    ],
}); 