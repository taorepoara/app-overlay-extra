import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [],
	build: {
		rollupOptions: {
			input: {
				main: "index.html",
				overlay: "overlay.html",
				admin: "admin.html",
			},
		},
	},
	server: {
		port: 3002,
		host: true,
		allowedHosts: true,
		proxy: {
			"/data/": {
				target: "http://localhost:3001"
			},
			"/redirect": {
				target: "http://localhost:3001"
			}
		},
	},
});
