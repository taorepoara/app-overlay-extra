export type WSMessage =
	| ConnectClientMessage
	| RTCConnectionMessage
	| AppMessage;

export type AppMessage =
	| SetSceneMessage
	| HideInterfaceMessage
	| SetSoundMutedMessage
	| NewSourceMessage
	| TwitchAuthRequiredMessage
	| TwitchEvent
	| TwitchScheduleMessage
	| UpdateStreamInfoMessage
	| UpdateStreamInfoResultMessage
	| MusicSyncUpdateMessage
	| CancelTransitionMessage;

export type ClientType = "admin" | "overlay";
export type SoundInput = "microphone" | "music";

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

export type HideInterfaceMessage = {
	type: "hideInterface";
	hidden: boolean;
};

export type SetSoundMutedMessage = {
	type: "setSoundMuted";
	input: SoundInput;
	muted: boolean;
};

export type StreamSource = {
	type: StreamType;
	trackIds: string[];
};

export type NewSourceMessage = {
	type: "newSource";
	source: StreamSource;
};

export type TwitchAuthRequiredMessage = {
	type: "twitchAuthRequired";
	params: Record<string, string>;
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
	"pause",
	"transition",
	"camera",
	"screen",
	"camera & screen",
	"end",
] as const;
export type Scene = (typeof scenes)[number];

export type StreamType = "camera" | "screen";

export type TwitchEvent = TwitchChatMessageEvent | TwitchChannelEvent;

export type TwitchChatMessageEvent = {
	type: "chatMessage";
	// username: string;
	// message: string;
};

export type TwitchChannelEvent =
	| FollowerNumberEvent
	| SubscriptionNumberEvent
	| ViewerCountEvent
	| NewSubscriptionEvent;

export type FollowerNumberEvent = {
	type: "followerNumber";
	count: number;
};

export type SubscriptionNumberEvent = {
	type: "subscriptionNumber";
	count: number;
};

export type ViewerCountEvent = {
	type: "viewerCount";
	count: number;
};

export type NewSubscriptionEvent = {
	type: "newSubscription";
};

export type TwitchChannelEventType = TwitchChannelEvent["type"];

export type MusicSyncUpdateMessage = {
	type: "musicSyncUpdate";
	windowEndTime: number | null;
	pendingScene: Scene | null;
};

export type CancelTransitionMessage = {
	type: "cancelTransition";
};

export type UpcomingStream = {
	title: string;
	tags: string[];
	categoryName: string;
	startDate: string;
	endDate: string;
};

export type TwitchScheduleMessage = {
	type: "twitchSchedule";
	upcomingStream: UpcomingStream | null;
	autoApplied: boolean;
};

export type UpdateStreamInfoMessage = {
	type: "updateStreamInfo";
	title: string;
	categoryName: string;
	tags: string[];
	startDate: string;
	endDate: string;
};

export type UpdateStreamInfoResultMessage = {
	type: "updateStreamInfoResult";
	success: boolean;
	applied?: boolean;
	error?: string;
};
