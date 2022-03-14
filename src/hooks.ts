import { parse } from 'cookie';

export async function handle({ event, resolve }) {
    event.locals.cookie = parse(event.request.headers.get('cookie') || '');
    console.log(event.locals)
    return resolve(event);
}