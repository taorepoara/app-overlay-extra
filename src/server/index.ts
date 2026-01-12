import { argv, type ServerWebSocket } from "bun";
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
	}
});

console.log(`Listening on ${server.url}`);
