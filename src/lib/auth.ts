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
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    
    // Map existing AuthJS database schema to Better Auth
    session: {
        fields: {
            expiresAt: "expires", // Map AuthJS 'expires' field to Better Auth's 'expiresAt'
            token: "sessionToken" // Map AuthJS 'sessionToken' field to Better Auth's 'token'
        }
    },
    
    account: {
        fields: {
            accountId: "providerAccountId", // Map AuthJS 'providerAccountId' to Better Auth's 'accountId'
            refreshToken: "refresh_token", // Map AuthJS 'refresh_token' to Better Auth's 'refreshToken'
            accessToken: "access_token", // Map AuthJS 'access_token' to Better Auth's 'accessToken'
            accessTokenExpiresAt: "expires_at", // Map AuthJS 'expires_at' to Better Auth's 'accessTokenExpiresAt'
            idToken: "id_token", // Map AuthJS 'id_token' to Better Auth's 'idToken'
        }
    },
    
    secret: AUTH_SECRET,
    
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
    
    // Configure credentials authentication
    emailAndPassword: {
        enabled: true,
        async sendResetPassword({ user, token, url }) {
            // Handle password reset email sending
            console.log("Password reset requested for:", user.email);
            // You can implement your email sending logic here
        },
    },
    
    callbacks: {
        async signIn({ user, account }) {
            // Custom sign-in logic if needed
            return true;
        },
    },
    
    // Custom pages configuration
    pages: {
        signIn: "/signin",
        signUp: "/signup",
        resetPassword: "/reset-password",
        verifyEmail: "/verify-email",
    },
    
    trustedOrigins: [
        "http://localhost:5173", // SvelteKit dev server
        "http://localhost:4173", // SvelteKit preview
        // Add your production domains here
    ],
}); 