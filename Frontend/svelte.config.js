import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			runtime: 'nodejs20.x'
		}),
		alias: {
			$lib: 'src/lib',
			$components: 'src/components',
			$stores: 'src/stores',
			$utils: 'src/utils',
			$types: 'src/types/index.ts',
			$assets: 'src/assets'
		}
	}
};

export default config;
