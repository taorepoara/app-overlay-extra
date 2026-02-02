export type WSMessage =
	| ConnectClientMessage
	| RTCConnectionMessage
	| AppMessage;

export type AppMessage = SetSceneMessage | NewSourceMessage;

export type ClientType = "admin" | "overlay";

export type ConnectClientMessage = {
	type: "connectClient";
	clientType: ClientType;
};

export type NewOverlayMessage = {
	type: "newOverlay";
};

export type SetSceneMessage = {
	type: "setScene";
	scene: Scene;
};

export type NewSourceMessage = {
	type: "newSource";
	source: {
		type: StreamType;
		trackIds: string[];
	};
};

export type RTCConnectionMessage =
	| IceCandidateMessage
	| NewOverlayMessage
	| OfferMessage
	| AnswerMessage;

export type IceCandidateMessage = {
	type: "iceCandidate";
	candidate: RTCIceCandidate | null;
};

export type OfferMessage = {
	type: "offer";
	sdp: string;
};

export type AnswerMessage = {
	type: "answer";
	sdp: string;
};

export const scenes = [
	"start",
	"camera",
	"screen",
	"camera & screen",
	"end",
] as const;
export type Scene = (typeof scenes)[number];

export type StreamType = "camera" | "screen";
