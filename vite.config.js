import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit'

/** @type {import('vite').UserConfig} */
const config = {
        plugins: [
                sveltekit(),
                SvelteKitPWA()
        ],
        server: {
                fs: {
                        allow: ['..']
                }
        },
        build: {
                rollupOptions: {
                        // overwrite default .html entry
                        input: '/build/index.js',
                      },
        }
};

export default config;