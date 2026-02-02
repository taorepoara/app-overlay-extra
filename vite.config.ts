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
			"/ws": {
				target: "ws://localhost:3001",
				ws: true,
			},
			"/data/": {
				target: "http://localhost:3001"
			},
		},
	},
});
