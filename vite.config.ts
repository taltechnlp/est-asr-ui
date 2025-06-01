import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
	  tailwindcss(),
	  sveltekit(),
	],
	server: {
		fs: {
			allow: ['..']
		}
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Only chunk packages that are actually bundled (not external)
					if (id.includes('node_modules')) {
						// TipTap and ProseMirror related
						if (id.includes('@tiptap') || id.includes('prosemirror')) {
							return 'editor';
						}
						
						// Svelte TipTap
						if (id.includes('svelte-tiptap')) {
							return 'editor';
						}
						
						// UI libraries
						if (id.includes('svelte-awesome')) {
							return 'icons';
						}
						
						// Utilities
						if (id.includes('lodash') || id.includes('uuid')) {
							return 'utils';
						}
						
						// Auth (only if bundled)
						if (id.includes('@auth') && !id.includes('external')) {
							return 'auth';
						}
						
						// Large vendor libs
						if (id.includes('date-fns') || id.includes('moment')) {
							return 'date-utils';
						}
					}
				}
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
});