import type { ChatMessage } from "@twurple/chat";
import type { ServerWebSocket } from "bun";
import type {
	ClientType,
	Scene,
	StreamSource,
	TwitchChannelEvent,
	TwitchChannelEventType,
	TwitchEvent,
	UpcomingStream,
	WSMessage,
} from "../types.ts";
import type { TwitchClient, TwitchLive } from "./TwitchClient.ts";

type State = {
	scene: Scene;
	interfaceHidden: boolean;
	microphoneMuted: boolean;
	musicMuted: boolean;
};

export class WebSocketManager {
	private readonly admins: AdminClient[] = [];
	private overlay: WsClient | null = null;
	private state: State = {
		scene: "start",
		interfaceHidden: false,
		microphoneMuted: false,
		musicMuted: false,
	};
	private readonly lastEvents: Map<TwitchChannelEventType, TwitchChannelEvent> =
		new Map();

	constructor(private readonly twitchClient: TwitchClient) {
		twitchClient.onChatMessage = (message: ChatMessage) => {
			console.log(
				"Received Twitch chat message in WebSocketManager: ",
				message.text,
			);
			// TODO: First user message: message.isFirst
			if (this.overlay?.isOpen) {
				this.overlay.send({
					type: "chatMessage",
					// username: message.userInfo.displayName,
					// message: message.text,
				});
			}
		};
		twitchClient.onChannelEvent = this.onTwitchEvent.bind(this);
		twitchClient.onNewSubscription = () => {
			this.onTwitchEvent({ type: "newSubscription" });
		};
		twitchClient.onAuthComplete = () => {
			for (const admin of this.admins) {
				this.sendScheduleToAdmin(admin);
			}
		};
	}

	private onTwitchEvent(event: TwitchChannelEvent) {
		if (this.overlay?.isOpen) {
			this.overlay.send(event);
		}
		this.lastEvents.set(event.type as TwitchChannelEventType, event);
	}

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
		const client = new AdminClient(ws);
		this.admins.push(client);
		client.send({ type: "setScene", scene: this.state.scene });
		client.send({ type: "hideInterface", hidden: this.state.interfaceHidden });
		client.send({
			type: "setSoundMuted",
			input: "microphone",
			muted: this.state.microphoneMuted,
		});
		client.send({
			type: "setSoundMuted",
			input: "music",
			muted: this.state.musicMuted,
		});
		if (this.twitchClient.needsAuth) {
			client.send({
				type: "twitchAuthRequired",
				params: this.twitchClient.createAuthUrlParameters(),
			});
		} else {
			this.sendScheduleToAdmin(client);
		}
	}

	private sendScheduleToAdmin(client: AdminClient) {
		this.twitchClient
			.getUpcomingStream()
			.then(async (upcomingStream) => {
				const payload: UpcomingStream | null = upcomingStream
					? {
							title: upcomingStream.title,
							categoryName: upcomingStream.categoryName,
							tags: upcomingStream.tags,
							startDate: upcomingStream.startDate.toISOString(),
							endDate: upcomingStream.endDate.toISOString(),
						}
					: null;
				let autoApplied = false;
				if (
					upcomingStream &&
					WebSocketManager.isWithinOneHour(upcomingStream.startDate)
				) {
					await this.twitchClient
						.updateChannelInfo(upcomingStream)
						.then(() => {
							autoApplied = true;
						})
						.catch((err) => {
							console.error(
								"Failed to auto-apply stream info from schedule:",
								err,
							);
						});
				}
				client.send({
					type: "twitchSchedule",
					upcomingStream: payload,
					autoApplied,
				});
			})
			.catch((err) => {
				console.error("Failed to fetch Twitch schedule:", err);
			});
	}

	private static isWithinOneHour(date: Date): boolean {
		return date.getTime() - Date.now() < 60 * 60 * 1000;
	}

	public registerOverlay(ws: ServerWebSocket<undefined>) {
		if (this.overlay) {
			console.log(
				"An overlay is already connected. Closing the new connection.",
			);
			ws.close(1000, "An overlay is already connected.");
			return;
		}
		this.overlay = new WsClient(ws);
		this.admins
			.flatMap((admin) => admin.sources)
			.forEach((source) => {
				this.overlay?.send({ type: "newSource", source });
			});
		this.overlay.send({ type: "setScene", scene: this.state.scene });
		this.overlay.send({
			type: "hideInterface",
			hidden: this.state.interfaceHidden,
		});
		this.overlay.send({
			type: "setSoundMuted",
			input: "microphone",
			muted: this.state.microphoneMuted,
		});
		this.overlay.send({
			type: "setSoundMuted",
			input: "music",
			muted: this.state.musicMuted,
		});
		this.lastEvents.forEach((event) => {
			this.overlay?.send(event);
		});
		for (const admin of this.admins) {
			admin.send({ type: "newOverlay" });
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
		if (this.overlay?.socket === ws) {
			if (message.type === "setScene") {
				this.state.scene = message.scene;
				console.log("Updated scene from overlay to", this.state.scene);
			}
			// Forward the message to all admins
			for (const admin of this.admins) {
				if (admin.socket.readyState === WebSocket.OPEN) {
					admin.socket.send(messageData);
				}
			}
			console.log("Forwarded message to admins");
		} else if (adminIndex >= 0) {
			const currentAdmin = this.admins[adminIndex];
			let dispatchToAdmins = false;
			switch (message.type) {
				case "setScene":
					this.state.scene = message.scene;
					dispatchToAdmins = true;
					console.log("Updated current scene to", this.state.scene);
					break;
				case "hideInterface":
					this.state.interfaceHidden = message.hidden;
					dispatchToAdmins = true;
					console.log(
						"Updated interface hidden state to",
						this.state.interfaceHidden,
					);
					break;
				case "setSoundMuted":
					if (message.input === "microphone") {
						this.state.microphoneMuted = message.muted;
						console.log(
							"Updated microphone muted state to",
							this.state.microphoneMuted,
						);
					} else if (message.input === "music") {
						this.state.musicMuted = message.muted;
						console.log("Updated music muted state to", this.state.musicMuted);
					}
					dispatchToAdmins = true;
					break;
				case "newSource":
					console.log(
						"Received new source from admin",
						currentAdmin.socket,
						message.source,
					);
					currentAdmin.sources.push(message.source);
					break;
				case "updateStreamInfo": {
					const { title, categoryName, tags, startDate, endDate } = message;
					const startDateObj = new Date(startDate);
					const endDateObj = new Date(endDate);
					const twitchLive:TwitchLive = {
								title,
								categoryName: categoryName,
								tags,
								startDate: startDateObj,
								endDate: endDateObj,
							};
					this.twitchClient.createScheduleSegment(twitchLive)
						.then(async () => {
							if (WebSocketManager.isWithinOneHour(startDateObj)) {
								await this.twitchClient.updateChannelInfo(twitchLive);
							}
							currentAdmin.send({
								type: "updateStreamInfoResult",
								success: true,
								applied: WebSocketManager.isWithinOneHour(startDateObj),
							});
						})
						.catch((err) => {
							console.error("Failed to update stream info:", err);
							currentAdmin.send({
								type: "updateStreamInfoResult",
								success: false,
								error: err instanceof Error ? err.message : String(err),
							});
							throw err;
						});
					return;
				}
			}
			// Forward the message to the overlay
			if (this.overlay?.isOpen) {
				this.overlay?.send(message);
			}
			console.log("Forwarded message to overlay");
			if (dispatchToAdmins) {
				for (const admin of this.admins) {
					if (
						admin !== currentAdmin &&
						admin.socket.readyState === WebSocket.OPEN
					) {
						admin.send(message);
					}
				}
				console.log("Forwarded message to other admins");
			}
		} else {
			console.log("Unregistered connection sent a message");
		}
	}

	public onClose(ws: ServerWebSocket<undefined>) {
		if (this.overlay?.socket === ws) {
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

class WsClient {
	public readonly socket: ServerWebSocket<undefined>;
	constructor(socket: ServerWebSocket<undefined>) {
		this.socket = socket;
	}

	get isOpen() {
		return this.socket.readyState === WebSocket.OPEN;
	}

	send(message: WSMessage) {
		if (this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(message));
		}
	}
}

class AdminClient extends WsClient {
	public readonly sources: StreamSource[] = [];
}
