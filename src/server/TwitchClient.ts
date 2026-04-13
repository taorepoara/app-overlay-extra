import { ApiClient } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient, type ChatMessage } from "@twurple/chat";
import type { TwitchChannelEvent } from "../types.ts";

// TWITCH_CLIENT_SECRET
export class TwitchClient {
	private static readonly channel = "lenra4devs";
	private static readonly scopes = [
		"channel:bot",
		"chat:read",
		"channel:read:subscriptions",
		"moderator:read:followers",
	];
	private static readonly clientId = Bun.env.TWITCH_CLIENT_ID || "";
	private static readonly clientSecret = Bun.env.TWITCH_CLIENT_SECRET || "";
	private static readonly authorizeParameters: Record<string, string> = {
		client_id: TwitchClient.clientId,
		response_type: "code",
		scope: TwitchClient.scopes.join(" "),
	};
	private user: string | null = null;
	private readonly authProvider = new RefreshingAuthProvider({
		clientId: TwitchClient.clientId,
		clientSecret: TwitchClient.clientSecret,
		redirectUri: "http://localhost:3000/redirect",
	});
	private readonly apiClient = new ApiClient({
		authProvider: this.authProvider,
	});
	private readonly chatClient = new ChatClient({
		authProvider: this.authProvider,
		channels: [TwitchClient.channel],
		readOnly: true,
	});
	private channelId: string | null = null;
	public onChatMessage: ((message: ChatMessage) => void) | null = null;
	public onChannelEvent: ((event: TwitchChannelEvent) => void) | null = null;

	constructor() {
		console.log("TwitchClient initialized");
	}

	// Authentication management

	get needsAuth() {
		if (this.user === null) return true;
		return !this.authProvider.hasUser(this.user);
	}

	createAuthUrlParameters(): Record<string, string> {
		return {
			...TwitchClient.authorizeParameters,
			// TODO: add state (random string to check the auth process)
		};
	}

	async finalizeAuth(params: URLSearchParams) {
		const code = params.get("code");
		if (!code) {
			throw new Error("No code parameter found in Twitch auth callback");
		}
		console.log("Finalizing Twitch auth with code: ", code);
		this.user = await this.authProvider.addUserForCode(code, ["chat"]);
		console.log("Twitch auth successful, access token obtained", this.user);
		await this.loadInitialChannelData();
		this.startListeningChat();
	}

	private async loadInitialChannelData() {
		const infos = await this.getChannelInfo();
		if (!infos) {
			throw new Error("Failed to get Twitch channel info after authentication");
		}
		this.channelId = infos.id;
		this.getFollowerNumber().then((followerCount) => {
			this.onChannelEvent?.({ type: "followerNumber", count: followerCount });
		});
		this.getSubscriberNumber().then((subscriberCount) => {
			this.onChannelEvent?.({
				type: "subscriptionNumber",
				count: subscriberCount,
			});
		});
		this.startViewerCountPolling();
	}

	private startViewerCountPolling() {
		let lastViewerCount = -1;
		const poll = async () => {
			const count = await this.getViewerCount();
			if (count === lastViewerCount) return;
			lastViewerCount = count;
			this.onChannelEvent?.({ type: "viewerCount", count });
		};
		poll();
		setInterval(poll, 60_000);
	}

	private async startListeningChat() {
		console.log("Starting Twitch chat client");
		this.chatClient.connect();
		this.chatClient.onMessage((channel, user, text, message) => {
			console.log(
				`Received Twitch chat message in channel ${channel} from ${user}: ${text}`,
			);
			this.onChatMessage?.(message);
		});
	}

	// Twitch API methods

	async getChannelInfo() {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		return this.apiClient.users.getUserByName(TwitchClient.channel);
	}

	async getFollowerNumber(): Promise<number> {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		return this.apiClient.channels.getChannelFollowerCount(
			this.channelId || TwitchClient.channel,
		);
	}

	async getViewerCount(): Promise<number> {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		const stream = await this.apiClient.streams.getStreamByUserId(
			this.channelId || TwitchClient.channel,
		);
		return stream?.viewers ?? 0;
	}

	async getSubscriberNumber(): Promise<number> {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		const subscriptionData =
			this.apiClient.subscriptions.getSubscriptionsPaginated(
				this.channelId || TwitchClient.channel,
			);
		return subscriptionData.getTotalCount();
	}
}
