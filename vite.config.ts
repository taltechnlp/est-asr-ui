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
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext'
		}
	},
	worker: {
		format: 'es'
	},
	build: {
		sourcemap: false
	}
});