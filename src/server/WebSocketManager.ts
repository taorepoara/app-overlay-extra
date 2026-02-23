import type { ServerWebSocket } from "bun";
import type { ClientType, Scene, StreamSource, WSMessage } from "../types.ts";

export class WebSocketManager {
	private readonly admins: AdminClient[] = [];
	private overlay: ServerWebSocket<undefined> | null = null;
	private currentScene: Scene = "start";

	public register(ws: ServerWebSocket<undefined>, type: ClientType): boolean {
		switch (type) {
			case "admin":
				this.registerAdmin(ws);
				return true;
			case "overlay":
				this.registerOverlay(ws);
				return true;
		}
		return false;
	}

	public registerAdmin(ws: ServerWebSocket<undefined>) {
		this.admins.push(new AdminClient(ws));
		ws.send(JSON.stringify({ type: "setScene", scene: this.currentScene }));
	}

	public registerOverlay(ws: ServerWebSocket<undefined>) {
		if (this.overlay) {
			console.log(
				"An overlay is already connected. Closing the new connection.",
			);
			ws.close(1000, "An overlay is already connected.");
			return;
		}
		this.overlay = ws;
		this.admins
			.flatMap((admin) => admin.sources)
			.forEach((source) => {
				ws.send(JSON.stringify({ type: "newSource", source }));
			});
		ws.send(JSON.stringify({ type: "setScene", scene: this.currentScene }));
		for (const admin of this.admins) {
			admin.socket.send(JSON.stringify({ type: "newOverlay" }));
		}
	}

	public onMessage(
		ws: ServerWebSocket<undefined>,
		messageData: string | Buffer<ArrayBuffer>,
	) {
		console.log("Received message:", messageData, typeof messageData);
		const message = JSON.parse(messageData.toString()) as WSMessage;
		if (message.type === "connectClient") {
			if (this.register(ws, message.clientType)) return;
		}
		console.log("Forwarding message", message);
		const adminIndex = this.adminIndex(ws);
		if (this.overlay === ws) {
			// Forward the message to all admins
			for (const admin of this.admins) {
				if (admin.socket.readyState === WebSocket.OPEN) {
					admin.socket.send(messageData);
				}
			}
			console.log("Forwarded message to admins");
		} else if (adminIndex >= 0) {
			const admin = this.admins[adminIndex];
			switch (message.type) {
				case "setScene":
					this.currentScene = message.scene;
					console.log("Updated current scene to", this.currentScene);
					break;
				case "newSource":
					console.log(
						"Received new source from admin",
						admin.socket,
						message.source,
					);
					admin.sources.push(message.source);
					break;
			}
			// Forward the message to all overlays
			if (this.overlay?.readyState === WebSocket.OPEN) {
				this.overlay?.send(messageData);
			}
			console.log("Forwarded message to overlays");
		} else {
			console.log("Unregistered connection sent a message");
		}
	}

	public onClose(ws: ServerWebSocket<undefined>) {
		if (this.overlay === ws) {
			this.overlay = null;
			return;
		}
		const pos = this.adminIndex(ws);
		if (pos === -1) {
			console.warn("WebSocket not found in admins list on close.");
			return;
		}
		this.admins.splice(pos, 1);
	}

	adminIndex(ws: ServerWebSocket<undefined>) {
		return this.admins.findIndex((admin) => admin.socket === ws);
	}
}

class AdminClient {
	public readonly socket: ServerWebSocket<undefined>;
	public readonly sources: StreamSource[] = [];
	constructor(socket: ServerWebSocket<undefined>) {
		this.socket = socket;
	}
}
