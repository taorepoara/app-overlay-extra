import type { ServerWebSocket } from "bun";
import type { Scene, AppMessage, WSMessage } from "../types.ts";

export class WebSocketManager {
	private admins: ServerWebSocket<undefined>[] = [];
	private overlay: ServerWebSocket<undefined> | null = null;
	private currentScene: Scene = "start";

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
			let registration = false;
			switch (message.clientType) {
				case "admin":
					this.registerAdmin(ws);
					registration = true;
					break;
				case "overlay":
					this.registerOverlay(ws);
					registration = true;
					break;
			}
			if (registration) return;
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
		} else if (this.admins.indexOf(ws) !== -1) {
			if (message.type === "setScene") {
				this.currentScene = message.scene;
				console.log("Updated current scene to", this.currentScene);
			}
			// Forward the message to all overlays
			this.overlay;
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
