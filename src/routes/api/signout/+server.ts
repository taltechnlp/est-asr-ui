import { serialize } from 'cookie';
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
    event.cookies.delete("token", { path: "/"});
    return new Response ("", {
        status: 201,
        headers: {
            'Set-Cookie': serialize('token', '', {
                path: '/',
                expires: new Date(0),
            }),
        }
       })
}