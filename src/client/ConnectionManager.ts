import type { AppMessage, ClientType, WSMessage } from "../types.ts";

export * from "../types.ts";

export class ConnectionManager {
	private type: ClientType;
	private webSocket: WebSocket | null = null;
	private rtcConnection: RTCPeerConnection;
	private onMessage: MessageCallback;

	constructor(
		type: ClientType,
		onMessage: MessageCallback,
		onTrack?: (ev: RTCTrackEvent) => void,
	) {
		this.type = type;
		this.onMessage = onMessage;
		this.rtcConnection = new RTCPeerConnection();
		this.rtcConnection.oniceconnectionstatechange = () => {
			console.log(
				"État de la connexion ICE :",
				this.rtcConnection.iceConnectionState,
			);
		};
		switch (this.type) {
			case "overlay":
				this.rtcConnection.ontrack = (event) => {
					console.log("Received track from admin: ", event.track);
					if (!onTrack) {
						console.warn("No onTrack handler provided.");
						return;
					}
					onTrack(event);
				};
				break;
			case "admin":
				this.rtcConnection.onnegotiationneeded = async () => {
					console.log("Negotiation needed event triggered.");
					await this.createOffer();
				};
				break;
		}
		this.initWebSocketConnection();
	}

	public sendMessage(message: WSMessage): boolean {
		if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
			console.error(
				"WebSocket is not connected. Cannot send message:",
				message,
			);
			return false;
		}
		this.webSocket.send(JSON.stringify(message));
		return true;
	}

	public addTrack(track: MediaStreamTrack, stream: MediaStream) {
		console.log("Adding track to peer connection:", track);
		this.rtcConnection.addTrack(track, stream);
	}

	public removeTrack(track: MediaStreamTrack) {
		const sender = this.rtcConnection
			.getSenders()
			.find((s) => s.track === track);
		if (sender) {
			this.rtcConnection.removeTrack(sender);
			console.log("Removed track from peer connection:", track);
		} else {
			console.warn("No sender found for track:", track);
		}
	}

	private async initWebSocketConnection(): Promise<WebSocket> {
		console.log("Initializing WebSocket connection to server...");
		return new Promise((resolve, reject) => {
			// Replace with your server URL
			const serverUrl = `ws${location.protocol.includes("https") ? "s" : ""}://${location.host}/ws`;
			this.webSocket = new WebSocket(serverUrl);

			this.webSocket.onopen = () => {
				console.log("WebSocket connection established.");
				// You can send messages to the server here if needed
				this.sendMessage({
					type: "connectClient",
					clientType: this.type,
				});

				switch (this.type) {
					case "admin":
						this.createPeerConnection();
						break;
					case "overlay":
						this.rtcConnection.onicecandidate = (event) => {
							console.log("Overlay ICE candidate generated: ", event.candidate);
							this.sendMessage({
								type: "iceCandidate",
								candidate: event.candidate,
							});
						};
						break;
				}

				if (this.webSocket === null) {
					reject("WebSocket connection failed.");
					return;
				}
				resolve(this.webSocket);
			};

			this.webSocket.onmessage = this.onWsMessage.bind(this);

			this.webSocket.onerror = (error) => {
				console.error("WebSocket error: ", error);
			};

			this.webSocket.onclose = () => {
				console.log("WebSocket connection closed.");
			};
		});
	}

	private async onWsMessage(event: MessageEvent) {
		console.log("Message from server: ", event.data);
		const message = JSON.parse(event.data) as WSMessage;
		switch (message.type) {
			case "iceCandidate": {
				if (!message.candidate) {
					console.warn("Received null ICE candidate.");
					return;
				}
				this.rtcConnection
					.addIceCandidate(new RTCIceCandidate(message.candidate))
					.then(() => {
						console.log("Added ICE candidate: ", message.candidate);
					})
					.catch((e) => {
						console.error("Error adding received ICE candidate", e);
					});
				return;
			}
		}
		switch (this.type) {
			case "overlay":
				// Handle overlay-specific messages if needed
				switch (message.type) {
					case "offer": {
						await this.rtcConnection.setRemoteDescription(
							new RTCSessionDescription(message),
						);
						const answer = await this.rtcConnection.createAnswer();
						await this.rtcConnection.setLocalDescription(answer);
						if (!answer.sdp) {
							console.error("Answer SDP is null or undefined.");
							return;
						}
						console.log(
							"Created and set local description with answer: ",
							answer,
						);
						this.sendMessage({ type: "answer", sdp: answer.sdp });
						return;
					}
				}
				break;
			case "admin":
				// Handle admin-specific messages if needed
				switch (message.type) {
					case "newOverlay": {
						this.createPeerConnection();
						return;
					}
					case "answer": {
						await this.rtcConnection.setRemoteDescription(
							new RTCSessionDescription(message),
						);
						console.log("Set remote description with answer from overlay.");
						return;
					}
				}
				break;
		}
		this.onMessage(message as AppMessage);
	}

	private createPeerConnection() {
		console.log("Creating RTCPeerConnection...");
		this.rtcConnection.onicecandidate = (event) => {
			if (!event.candidate) {
				console.warn("All ICE candidates have been sent.");
			}
			this.sendMessage({
				type: "iceCandidate",
				candidate: event.candidate,
			});
		};

		this.createOffer();
	}

	private async createOffer() {
		const offer = await this.rtcConnection.createOffer();
		await this.rtcConnection.setLocalDescription(offer);
		if (!offer.sdp) {
			console.error("Offer SDP is null or undefined.");
			return;
		}
		console.log("Created and set local description with offer: ", offer);

		this.sendMessage({ type: "offer", sdp: offer.sdp });
	}
}

export type MessageCallback = (message: AppMessage) => void;
