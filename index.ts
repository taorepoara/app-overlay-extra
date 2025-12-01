import { serve, type ServerWebSocket } from "bun";

const admins:ServerWebSocket<any>[] = [];
const overlays:ServerWebSocket<any>[] = [];

const server = Bun.serve({
  port: 3000,
	async fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname === "/ws") {
			const upgraded = server.upgrade(req);
			if (upgraded) {
				// return;
			}
			return new Response("Upgrade Required", { status: 426 });
		}
		console.log(`Received request for ${url.pathname}`);
		const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
		const filePath = `./src${pathname}`;
		const file = Bun.file(filePath);
		if (await file.exists()) {
			const headers:any = {};
			switch (filePath.split(".").pop()) {
				case "html":
					headers["Content-Type"] = "text/html";
					break;
				case "js":
					headers["Content-Type"] = "application/javascript";
					break;
				case "css":
					headers["Content-Type"] = "text/css";
					break;
			}
			return new Response(file.stream(), { headers });
		}
		return new Response("Not Found", { status: 404 });
	},
	websocket: {
		open(ws) {
			console.log("WebSocket connection opened");
		},
		message(ws, message) {
			console.log("Admins connected:", admins.length);
			console.log("Overlays connected:", overlays.length);
			console.log("Received message:", message);
			if (typeof message === "string") {
				let list:ServerWebSocket<any>[] | undefined;
				switch (message) {
					case "admin":
						list = admins;
						break;
					case "overlay":
						list = overlays;
						break;
				}
				if (list !== undefined) {
					if (list.indexOf(ws) === -1) {
						list.push(ws);
						console.log("Registered new connection");
					}
					return;
				}
			}
			if (admins.indexOf(ws) !== -1) {
				// Forward the message to all overlays
				overlays.forEach(overlayWs => {
					if (overlayWs.readyState === WebSocket.OPEN) {
						overlayWs.send(message);
					}
				});
				console.log("Forwarded message to overlays");
			}
			else if (overlays.indexOf(ws) !== -1) {
				// Forward the message to all admins
				admins.forEach(adminWs => {
					if (adminWs.readyState === WebSocket.OPEN) {
						adminWs.send(message);
					}
				});
				console.log("Forwarded message to admins");
			}
			else {
				console.log("Unregistered connection sent a message");
			}
		},
		close(ws, code, reason) {
			console.log(`WebSocket connection closed: ${code} - ${reason}`);
			[admins, overlays].forEach(list => {
				const index = list.indexOf(ws);
				if (index !== -1) {
					list.splice(index, 1);
					console.log("Removed connection from list");
				}
			});
		},
	}
});

console.log(`Listening on ${server.url}`);
