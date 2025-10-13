import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],

	test: {
		// Test environment
		environment: 'node',

		// Global test setup
		globals: true,

		// Include test files
		include: ['tests/**/*.{test,spec}.{js,ts}'],

		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: [
				'src/lib/agents/**/*.ts',
				'src/lib/utils/textAlignment.ts',
				'src/lib/utils/applyAlignedCorrections.ts'
			],
			exclude: [
				'**/*.d.ts',
				'**/*.spec.ts',
				'**/*.test.ts',
				'**/node_modules/**'
			]
		},

		// Test timeout (longer for integration tests)
		testTimeout: 10000,

		// Hooks timeout
		hookTimeout: 10000,

		// Mock settings
		mockReset: true,
		clearMocks: true,
		restoreMocks: true,

		// Reporter
		reporters: ['verbose']
	},

	// Resolve aliases (same as SvelteKit)
	resolve: {
		alias: {
			$lib: '/home/aivo/dev2/est-asr-ui/src/lib',
			$app: '/home/aivo/dev2/est-asr-ui/node_modules/@sveltejs/kit/src/runtime/app'
		}
	}
});
