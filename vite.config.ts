import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: ['..']
		}
	},
	ssr: {
		external: [
			'better-auth',
			'better-auth/minimal',
			'better-auth/adapters/prisma',
			'@better-auth/core',
			'@better-auth/core/api',
			'@better-auth/telemetry',
			'kysely',
			'zod'
		]
	},
	worker: {
		format: 'es'
	},
	build: {
		sourcemap: false,
		cssMinify: 'lightningcss',
		chunkSizeWarningLimit: 1200,
		rolldownOptions: {
			checks: {
				// The adapter runs inside closeBundle, so every build trips this check
				pluginTimings: false
			}
		}
	}
});
