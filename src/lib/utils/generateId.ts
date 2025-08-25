/**
 * Generates a short ID that fits within the VARCHAR(30) constraint
 * Used by both Better Auth and manual user creation
 */
export function generateShortId(): string {
	// Generate a 30-character ID that fits our VARCHAR(30) constraint
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 17);
}
