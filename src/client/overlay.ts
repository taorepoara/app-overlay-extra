import {
	AudioManager,
	AudioStreamTrack,
	type IMusicTrackPart,
	Music,
	MusicPartGroup,
	MusicTrack,
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
const offScenes = ["start", "end"] as Scene[];

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
	initBassLoop();
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
	const sources: Source[] = [];

	function setScene(scene: Scene) {
		const main = document.querySelector("main");
		if (!main) {
			console.error("Main element not found to set scene.");
			return;
		}
		if (main.dataset.scene === undefined) applyScene(scene);
		if (main.dataset.scene === scene) return;
		const fromOffScene = offScenes.includes(main.dataset.scene as Scene);
		const toOffScene = offScenes.includes(scene);
		goToTransition =
			main.dataset.scene !== "transition" && fromOffScene !== toOffScene;
		nextScene = scene;
		console.log("Scene set to: ", scene);
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
		const stream = new MediaStream([]);
		tracksToAdd.forEach((track) => {
			console.log(`Adding track to source stream (${type}): `, track);
			stream.addTrack(track);
		});
		const audioTrack = new AudioStreamTrack(type, stream);
		console.log(`Adding audio track to source stream (${type}): `, audioTrack);
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
			video.muted = true;
			applyScene();
		} else {
			console.error(`Video element for ${type} source not found.`);
		}
	}
});

const audioManager = AudioManager.instance;

// let currentPart: PartName = "bass-base";
// let nextPart: PartName = currentPart;
let goToTransition = false;
let nextScene: Scene | null = null;
const chorusStartMargin = 0.173349057; // am(Ardour mesure)=1920; start=1773; bpm=106; val=((am−start)÷am) * 4 * (60 / bpm)
const chorusEndMargin = 0.009433962; // am(Ardour mesure)=1920; start=8; bpm=106; val=(start÷am) * 4 * (60 / bpm)
const chorusDuration = (2 * 4 * 60) / 106; // deux mesures de 4 temps
const partNames = [
	"bass-base",
	"bass-base-2",
	"bass-chorus",
	"bass-chorus-end",
] as const;

export type PartName = (typeof partNames)[number];

async function initBassLoop() {
	const music = new Music();
	const bassSoundTrack = new MusicTrack(music);

	const base = await bassSoundTrack.addPart("/data/sound/bass-base.mp3", 2);
	const base2 = await bassSoundTrack.addPart("/data/sound/bass-base2.mp3", 2);
	const chorus = new MusicPartGroup([
		await bassSoundTrack.addPart("/data/sound/bass-chorus.wav", 3),
		await bassSoundTrack.addPart("/data/sound/bass-chorus_end.mp3", 1),
	]);

	base.onended = () => {
		let nextPart: IMusicTrackPart;
		if (goToTransition) {
			goToTransition = false;
			applyScene("transition");
			nextPart = chorus;
		} else {
			applyNextSceneIfNeeded();
			nextPart = Math.random() < 0.2 ? base2 : base;
		}
		nextPart.start();
	};

	base2.onended = () => {
		let nextPart: IMusicTrackPart;
		if (goToTransition) {
			goToTransition = false;
			applyScene("transition");
			nextPart = chorus;
		} else {
			applyNextSceneIfNeeded();
			nextPart = base;
		}
		nextPart.start();
	};

	chorus.onended = () => {
		applyNextSceneIfNeeded();
		base.start();
	};

	base.start();
}

function applyNextSceneIfNeeded() {
	const main = document.querySelector("main");
	if (!main) {
		console.error("Main element not found to set scene.");
		return;
	}
	const currentScene = main.dataset.scene as Scene;
	if (nextScene && currentScene !== nextScene) {
		applyScene(nextScene);
		nextScene = null;
	}
}

function applyScene(expectedScene?: Scene) {
	const main = document.querySelector("main");
	if (!main) {
		console.error("Main element not found to set scene.");
		return;
	}
	const scene = expectedScene ?? (main.dataset.scene as Scene);
	console.log("Scene set to: ", scene);
	const musicOnly = scene === "transition" || offScenes.includes(scene);
	main.dataset.previousScene = main.dataset.scene;
	main.dataset.scene = scene;
	audioManager.setTrackGain("camera", musicOnly ? 0 : 1);
	audioManager.setTrackGain("screen", scene.includes("screen") ? 1 : 0);
	audioManager.setTrackGain("music", musicOnly ? 1 : 0.2);
}
