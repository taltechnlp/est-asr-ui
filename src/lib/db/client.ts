import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '$env/dynamic/private';
import { DATABASE_URL } from '$env/static/private';
import { PrismaClient } from '$lib/generated/prisma/client';

// Prisma no longer reads .env itself. The runtime environment wins (bun loads
// .env on start, so a changed password only needs a restart); the value baked in
// at build time covers runtimes that do not load .env.
const adapter = new PrismaPg({
	connectionString: env.DATABASE_URL || DATABASE_URL,
	// pg waits forever for a connection by default; fail fast when the database is down
	connectionTimeoutMillis: 5000
});

export const prisma = new PrismaClient({ adapter });
