import { argv } from "bun";
import { WebSocketManager } from "./WebSocketManager.ts";

const sockerManager = new WebSocketManager();

const server = Bun.serve({
	port: argv[2] ? Number.parseInt(argv[2]) : 3000,
	async fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname === "/ws") {
			const upgraded = server.upgrade(req);
			if (upgraded) {
				// return;
			}
			return new Response("Upgrade Required", { status: 426 });
		}
		const file = Bun.file(`./dist${url.pathname}`);
		console.log("Serving file:", file);
		if (await file.exists()) {
			return new Response(file.stream(), {
				headers: {
					"Content-Type": url.pathname.endsWith(".html")
						? "text/html"
						: url.pathname.endsWith(".css")
							? "text/css"
							: url.pathname.endsWith(".js")
								? "application/javascript"
								: "application/octet-stream",
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
