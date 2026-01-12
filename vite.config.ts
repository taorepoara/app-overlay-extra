import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [],
	server: {
		port: 3000,
		host: true,
		allowedHosts: true,
		proxy: {
			'/ws': {
				target: 'ws://localhost:3001',
				ws: true,
			},
		},
	},
});
