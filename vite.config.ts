import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: [
				// worktree root
				path.resolve(__dirname),
				// shared node_modules in the parent repo
				path.resolve(__dirname, '../../../node_modules')
			]
		}
	}
});
