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
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext'
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
		chunkSizeWarningLimit: 1100,
		rollupOptions: {
			onwarn(warning, warn) {
				// Known third-party warnings from transitive dependencies.
				if (
					warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
					warning.message.includes('node_modules/better-auth/')
				) {
					return;
				}
				if (
					warning.code === 'UNRESOLVED_IMPORT' &&
					warning.message.includes('".prisma/client/index-browser"')
				) {
					return;
				}
				if (
					warning.code === 'CIRCULAR_DEPENDENCY' &&
					warning.message.includes('node_modules/')
				) {
					return;
				}
				warn(warning);
			}
		}
	}
});
