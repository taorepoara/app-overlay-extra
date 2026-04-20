import { ApiClient } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient, type ChatMessage } from "@twurple/chat";
import type { TwitchChannelEvent } from "../types.ts";

const alwaysTags = ["Français", "chatting", "Lenra", "Rediffusion"];
const defaultGameName = "Just Chatting";
const titleTagsSeparator = " | ";

export type TwitchLive = {
	title: string;
	tags: string[];
	startDate: Date;
	endDate: Date;
} & TwitchCategoryInfo;

type TwitchCategoryInfo =
	| WithCategoryId
	| WithCategoryName
	| (WithCategoryId & WithCategoryName);

type WithCategoryId = {
	categoryId: string;
};

type WithCategoryName = {
	categoryName: string;
};

// TWITCH_CLIENT_SECRET
export class TwitchClient {
	private static readonly channel = "lenra4devs";
	private static readonly scopes = [
		"channel:bot",
		"chat:read",
		"channel:read:subscriptions",
		"moderator:read:followers",
		"channel:manage:schedule",
		"channel:manage:broadcast",
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
	public onNewSubscription: (() => void) | null = null;
	public onAuthComplete: (() => void) | null = null;

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
		this.onAuthComplete?.();
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
		// onMessage only fires for messages that passed AutoMod (held messages never reach IRC)
		this.chatClient.onMessage((channel, user, text, message) => {
			console.log(
				`Received Twitch chat message in channel ${channel} from ${user}: ${text}`,
			);
			this.onChatMessage?.(message);
		});
		this.chatClient.onSub((channel, user) => {
			console.log(`New subscription in ${channel} from ${user}`);
			this.onNewSubscription?.();
		});
		this.chatClient.onResub((channel, user) => {
			console.log(`New resubscription in ${channel} from ${user}`);
			this.onNewSubscription?.();
		});
		this.chatClient.onSubGift((channel, user) => {
			console.log(`New gifted subscription in ${channel} from ${user}`);
			this.onNewSubscription?.();
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

	async getUpcomingStream(): Promise<(TwitchLive & WithCategoryName) | null> {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		const schedule = await this.apiClient.schedule.getSchedule(
			this.channelId || TwitchClient.channel,
		);
		const now = new Date();
		const next = schedule.data.segments
			?.filter((s) => s.startDate > now && s.cancelEndDate === null)
			.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
		if (!next) return null;
		const tagsSplitPos = next.title.lastIndexOf(titleTagsSeparator);
		const [title, tagsStr] =
			tagsSplitPos !== -1
				? [
						next.title.slice(0, tagsSplitPos).trim(),
						next.title.slice(tagsSplitPos + titleTagsSeparator.length).trim(),
					]
				: [next.title, ""];
		const tags = tagsStr
			.split(" ")
			.map((t) => t.trim().replace(/^#/, ""))
			.filter((t) => t.length > 0);

		let categoryInfo: TwitchCategoryInfo;
		if (next.categoryId) {
			categoryInfo = next.categoryName
				? { categoryId: next.categoryId, categoryName: next.categoryName }
				: { categoryId: next.categoryId, categoryName: await this.getGameNameById(next.categoryId) ?? defaultGameName };
		} else if (next.categoryName) {
			categoryInfo = { categoryName: next.categoryName };
		} else {
			const defaultGame =
				await this.apiClient.games.getGameByName(defaultGameName);
			if (!defaultGame) {
				throw new Error("Failed to get default game info from Twitch API");
			}
			categoryInfo = {
				categoryId: defaultGame.id,
				categoryName: defaultGame.name,
			};
		}

		return {
			title: title,
			tags: tags,
			startDate: next.startDate,
			endDate: next.endDate,
			...categoryInfo,
		};
	}

	async getGameNameById(id: string): Promise<string | null> {
		const game = await this.apiClient.games.getGameById(id);
		return game?.name ?? null;
	}

	async getGameIdByName(name: string): Promise<string | null> {
		const game = await this.apiClient.games.getGameByName(name);
		return game?.id ?? null;
	}

	async getGameId(data: TwitchLive): Promise<string> {
		if ("categoryId" in data) return data.categoryId;
		const categoryName =
			"categoryName" in data ? data.categoryName : defaultGameName;
		return this.getGameIdByName(categoryName).then((id) => {
			if (!id) {
				throw new Error(
					`Failed to get game ID for category name: ${categoryName}`,
				);
			}
			return id;
		});
	}

	async createScheduleSegment(data: TwitchLive): Promise<void> {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		const categoryId =
			"categoryId" in data
				? data.categoryId
				: await this.getGameIdByName(defaultGameName);
		const titleWithTags = `${data.title} | ${data.tags.map(tag => `#${tag}`).join(" ")}`;
		await this.apiClient.schedule.createScheduleSegment(
			this.channelId || TwitchClient.channel,
			{
				title: titleWithTags,
				categoryId: await this.getGameId(data),
				timezone: "Europe/Paris",
				startDate: data.startDate.toISOString(),
				// In minutes
				duration: (data.endDate.getTime() - data.startDate.getTime()) / 60_000,
				isRecurring: false,
			},
		);
	}

	async updateChannelInfo(data: TwitchLive): Promise<void> {
		if (this.needsAuth) {
			throw new Error("Not authenticated with Twitch");
		}
		await this.apiClient.channels.updateChannelInfo(
			this.channelId || TwitchClient.channel,
			{
				title: data.title,
				gameId: await this.getGameId(data),
				tags: [...new Set([...alwaysTags, ...data.tags])],
			},
		);
	}
}
