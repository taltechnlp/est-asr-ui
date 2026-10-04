import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The Prisma CLI no longer reads .env on its own. Variables already set in the
// environment win over the file.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		// Not env('DATABASE_URL'): that throws when the variable is unset, which
		// would break `prisma generate` on a machine without a database.
		url: process.env.DATABASE_URL ?? ''
	}
});
