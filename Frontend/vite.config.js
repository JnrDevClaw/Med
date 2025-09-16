import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson()
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.js']
				}
			},
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
	,
	resolve: {
		alias: {
			'$lib': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/lib'),
			'$components': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/components'),
			'$stores': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/stores'),
			'$utils': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/utils'),
			'$types': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/types')
		}
	}
});


