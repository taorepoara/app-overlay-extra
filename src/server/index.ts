import { argv } from "bun";
import { WebSocketManager } from "./WebSocketManager.ts";

const sockerManager = new WebSocketManager();

const server = Bun.serve({
	port: argv[2] ? Number.parseInt(argv[2]) : 3000,
	async fetch(req, server) {
		const url = new URL(req.url);
		let path = url.pathname;
		if (path === "/ws") {
			const upgraded = server.upgrade(req);
			if (upgraded) {
				// return;
			}
			return new Response("Upgrade Required", { status: 426 });
		}
		if (path === "/" || path === "") {
			path = "/index.html";
		}
		console.log("Search file for path", path);
		let file = Bun.file(`./dist${path}`);
		if (!(await file.exists())) {
			file = Bun.file(`./public${path}`);
		}
		if (!(await file.exists()) && path.startsWith("/data/")) {
			file = Bun.file(`.${path}`);
		}
		if (await file.exists()) {
			console.log("Serving file", file);
			const ext = path.split(".").pop();
			let contentType = "application/octet-stream";
			switch (ext) {
				case "html":
					contentType = "text/html";
					break;
				case "css":
					contentType = "text/css";
					break;
				case "js":
					contentType = "application/javascript";
					break;
				case "json":
					contentType = "application/json";
					break;
				case "png":
					contentType = "image/png";
					break;
				case "jpg":
				case "jpeg":
					contentType = "image/jpeg";
					break;
				case "svg":
					contentType = "image/svg+xml";
					break;
			}
			return new Response(file.stream(), {
				headers: {
					"Content-Type": contentType,
				},
			});
		}
		return new Response("Not Found", { status: 404 });
	},
	websocket: {
		open(_ws) {
			console.log("WebSocket connection opened");
		},
		message(ws, message) {
			sockerManager.onMessage(ws, message);
		},
		close(ws, code, reason) {
			console.log(`WebSocket connection closed: ${code} - ${reason}`);
			sockerManager.onClose(ws);
		},
	},
});

console.log(`Listening on ${server.url}`);
