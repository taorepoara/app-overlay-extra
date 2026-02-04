import {
	AudioManager,
	SoundTrack,
	type SoundTrackPart,
} from "./AudioManager.ts";
import {
	ConnectionManager,
	type Scene,
	type StreamType,
} from "./ConnectionManager.ts";
import "./css/footer.css";
import "./css/header.css";
import "./overlay.css";

console.log("Admin script loaded");

function alertModal(message: string): Promise<void> {
	return new Promise((resolve) => {
		const modal = document.createElement("dialog");
		const modalMessage = document.createElement("p");
		const closeButton = document.createElement("button");
		closeButton.textContent = "Close";
		modalMessage.textContent = message;
		closeButton.addEventListener("click", () => {
			modal.close();
			modal.remove();
			resolve();
		});
		modal.appendChild(modalMessage);
		modal.appendChild(closeButton);
		document.body.appendChild(modal);
		modal.showModal();
	});
}

alertModal("Overlay connected to server.").then(() => {
	// Open websocket connection to server
	ConnectionManager.init(
		"overlay",
		async (message) => {
			console.log("Received message in overlay", message);
			switch (message.type) {
				case "newSource":
					console.log("New source", message.source);
					addSource(message.source);
					break;
				case "setScene":
					setScene(message.scene);
					break;
				// case "refresh":
				// 	location.reload();
				// 	break;
				// case "refresh-css":
				// 	refreshCss();
				// 	break;
				default:
					console.warn("Unknown message type received", message);
			}
		},
		(event) => {
			console.log("Track received", event);
			const trackId = event.track.id;
			tracks[trackId] = event.track;
			const source = sources.find((s) => s.trackIds.includes(trackId));
			if (source) {
				console.log("Initializing source stream for received track", source);
				initSourceStream(source);
			} else {
				console.warn("No source found for received track ID", trackId);
			}
		},
	);

	const streams = {};
	const tracks: { [key: string]: MediaStreamTrack } = {};
	const sources: {
		type: "camera" | "screen";
		trackIds: string[];
		stream?: MediaStream;
	}[] = [];

	function setScene(scene: Scene) {
		const main = document.querySelector("main");
		if (main) {
			sceneChanged =
				main.dataset.scene !== scene &&
				[main.dataset.scene as Scene, scene].findIndex(
					(s) => s === "start" || s === "end",
				) !== -1;
			nextScene = scene;
			setTimeout(
				() => {
					if (scene !== nextScene) return;
					console.log("Audio scene set to: ", scene);
					main.dataset.previousScene = main.dataset.scene;
					main.dataset.scene = scene;
					(document.getElementById("camera") as HTMLVideoElement).muted =
						scene === "start";
					(document.getElementById("screen") as HTMLVideoElement).muted =
						!scene.includes("screen");
				},
				nextTransitionDate !== null
					? nextTransitionDate?.getTime() - Date.now()
					: 0,
			);
			console.log("Scene set to: ", scene);
		} else {
			console.error("Main element not found to set scene.");
		}
	}

	// function refreshCss() {
	// 	const links = document.getElementsByTagName("link");
	// 	for (let i = 0; i < links.length; i++) {
	// 		const link = links[i];
	// 		if (link.rel === "stylesheet") {
	// 			const href = link.href.split("?")[0];
	// 			link.href = href + "?v=" + new Date().getTime();
	// 			console.log("Refreshed CSS: ", link.href);
	// 		}
	// 	}
	// }

	type Source = {
		type: StreamType;
		trackIds: string[];
		stream?: MediaStream;
	};

	function addSource(source: Source) {
		sources.push(source);
		initSourceStream(source);
	}

	function initSourceStream(source: Source) {
		if (source.stream) {
			console.warn("Source stream already initialized: ", source);
			return;
		}
		const { type, trackIds } = source;
		const tracksToAdd = trackIds.map((id) => tracks[id]);
		if (tracksToAdd.some((t) => !t)) {
			console.warn(
				"Some tracks to add were not found: ",
				trackIds,
				tracksToAdd,
			);
			return;
		}
		const stream = new MediaStream(tracksToAdd);
		tracksToAdd.forEach((track) => {
			console.log(`Adding track to source stream (${type}): `, track);
			stream.addTrack(track);
		});
		source.stream = stream;
		const videoElement = document.getElementById(type);
		if (videoElement) {
			const video = document.getElementById(type) as HTMLVideoElement;
			console.log("Setting stream to video element: ", type, video);
			video.onloadedmetadata = (e) => {
				console.log("Metadata loaded, playing video...", e);
				video.play();
			};
			video.onerror = (e) => {
				console.error("Erreur lors de la lecture de la vidéo :", e);
			};
			video.srcObject = stream;
		} else {
			console.error(`Video element for ${type} source not found.`);
		}
	}
});

const audioManager = AudioManager.instance;

// let currentPart: PartName = "bass-base";
// let nextPart: PartName = currentPart;
let nextTransitionDate: Date | null = null;
let sceneChanged = false;
let nextScene: Scene | null = null;
const partNames = [
	"bass-base",
	"bass-base-2",
	"bass-chorus",
	"bass-chorus-end",
] as const;

export type PartName = (typeof partNames)[number];

async function initBassLoop() {
	const bassSoundTrack = new SoundTrack(audioManager);
	bassSoundTrack.gainNode.gain.value = 0.2;

	const base = await bassSoundTrack.addPart("/data/sound/bass-base.mp3", 2);
	const base2 = await bassSoundTrack.addPart("/data/sound/bass-base2.mp3", 2);
	const chorus = await bassSoundTrack.addPart("/data/sound/bass-chorus.mp3", 3);
	const chorusEnd = await bassSoundTrack.addPart("/data/sound/bass-chorus_end.mp3", 1);

	base.onended = () => {
		let nextPart: SoundTrackPart;
		if (sceneChanged) {
			sceneChanged = false;
			nextPart = chorus;
		} else {
			nextPart = Math.random() < 0.2 ? base2 : base;
		}
		nextTransitionDate = nextPart.start();
	};

	base2.onended = () => {
		let nextPart: SoundTrackPart;
		if (sceneChanged) {
			sceneChanged = false;
			nextPart = chorus;
		} else {
			nextPart = base;
		}
		nextTransitionDate = nextPart.start();
	};

	chorus.onended = () => {
		nextTransitionDate = chorusEnd.start();
	};

	chorusEnd.onended = () => {
		nextTransitionDate = base.start();
	};

	nextTransitionDate = base.start();
}
initBassLoop();
