import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import { readFileSync } from 'fs';

const tsConfig = JSON.parse(readFileSync('./tsconfig.json', 'utf8'));

export default [
	js.configs.recommended,
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'*.cjs',
			'node_modules/',
			'**/*.d.ts',
			'eslint.config.js',
			'svelte.config.js',
			'tailwind.config.ts',
			'scripts/**/*.js',
			'server.js'
		]
	},
	{
		files: ['src/**/*.{js,ts}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte']
			},
			globals: {
				console: 'readonly',
				setImmediate: 'readonly',
				global: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': ts
		},
		rules: {
			...ts.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'no-console': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/ban-ts-comment': 'warn'
		}
	},
	...svelte.configs['flat/recommended'],
	{
		files: ['src/**/*.svelte'],
		languageOptions: {
			parser: svelte.parser,
			parserOptions: {
				parser: tsParser,
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte']
			},
			globals: {
				console: 'readonly',
				setImmediate: 'readonly',
				global: 'readonly'
			}
		}
	},
	prettier
];
