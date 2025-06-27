import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default {
	plugins: [
	  tailwindcss(),
	  sveltekit(),
	],
	optimizeDeps: {
		force: true,
		include: ['deepmerge', 'intl-messageformat', 'clsx'],
		exclude: ['@auth/core']
	},
	server: {
		fs: {
			allow: ['..']
		}
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: undefined // Temporarily disable manual chunking to fix cache issues
			},
			onwarn(warning, warn) {
				// Suppress 'this' keyword warnings from @auth/core
				if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('@auth/core')) {
					return;
				}
				// Show other warnings
				warn(warning);
			}
		},
		chunkSizeWarningLimit: 600 // Slightly increase limit but still keep it reasonable
	}
};