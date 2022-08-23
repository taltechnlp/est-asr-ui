import { serialize } from 'cookie';

export async function post({ request }) {
    return {
        status: 201,
        headers: {
            'Set-Cookie': serialize('token', '', {
                path: '/',
                expires: new Date(0),
            }),
        },
        body: {
            message: 'success',
        },
       };
}