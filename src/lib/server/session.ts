import { createHmac, timingSafeEqual } from 'node:crypto';
import { AUTH_SECRET } from '$env/static/private';

// Password sign-ins get this cookie. Social sign-ins use better-auth's own session.
export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

const signature = (payload: string) =>
	createHmac('sha256', AUTH_SECRET).update(`${SESSION_COOKIE}:${payload}`).digest('base64url');

// `<base64url of {userId, exp}>.<signature>`. The expiry is part of what is signed,
// so it holds whatever the browser does with the cookie.
export function createSessionToken(userId: string): string {
	const payload = Buffer.from(
		JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })
	).toString('base64url');
	return `${payload}.${signature(payload)}`;
}

export function readSessionToken(token: string | undefined): { userId: string; expires: Date } | null {
	if (!token) return null;
	const [payload, given, ...rest] = token.split('.');
	if (!payload || !given || rest.length) return null;
	const expected = Buffer.from(signature(payload));
	const actual = Buffer.from(given);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
	try {
		const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
		if (typeof userId !== 'string' || typeof exp !== 'number' || exp * 1000 <= Date.now()) return null;
		return { userId, expires: new Date(exp * 1000) };
	} catch {
		return null;
	}
}
