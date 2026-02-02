import type { ServerWebSocket } from "bun";
import type { ClientType, Scene, WSMessage } from "../types.ts";

export class WebSocketManager {
	private readonly admins: ServerWebSocket<undefined>[] = [];
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
		this.admins.push(ws);
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
		ws.send(JSON.stringify({ type: "setScene", scene: this.currentScene }));
		for (const admin of this.admins) {
			admin.send(JSON.stringify({ type: "newOverlay" }));
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
		if (this.overlay === ws) {
			// Forward the message to all admins
			for (const admin of this.admins) {
				if (admin.readyState === WebSocket.OPEN) {
					admin.send(messageData);
				}
			}
			console.log("Forwarded message to admins");
		} else if (this.admins.includes(ws)) {
			if (message.type === "setScene") {
				this.currentScene = message.scene;
				console.log("Updated current scene to", this.currentScene);
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
		const pos = this.admins.indexOf(ws);
		if (pos === -1) {
			console.warn("WebSocket not found in admins list on close.");
			return;
		}
		this.admins.splice(pos, 1);
	}
}
