/// <reference types="node" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-friendly __dirname for tools that use it in config files
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		host: true,
		hmr: {
			overlay: false
		}
	},
	define: {
		global: 'globalThis'
	},
	optimizeDeps: {
		include: ['agora-rtc-sdk-ng']
	}
	,
	resolve: {
			alias: {
				'$lib': path.resolve(__dirname, 'src/lib'),
				'$components': path.resolve(__dirname, 'src/components'),
				'$stores': path.resolve(__dirname, 'src/stores'),
				'$utils': path.resolve(__dirname, 'src/utils'),
				'$types': path.resolve(__dirname, 'src/types')
			}
	}
});
