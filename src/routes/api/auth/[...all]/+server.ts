import { auth } from "$lib/auth";

export async function GET({ request }: { request: Request }) {
    return auth.handler(request);
}

export async function POST({ request }: { request: Request }) {
    return auth.handler(request);
} 