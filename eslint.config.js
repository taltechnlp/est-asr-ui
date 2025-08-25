// Simple ESLint config for now - complex configs cause compatibility issues
export default [
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', '*.cjs', 'node_modules/', '**/*.d.ts']
	},
	{
		files: ['**/*.{js,ts,svelte}'],
		rules: {
			'no-unused-vars': 'warn',
			'no-console': 'off'
		}
	}
];
