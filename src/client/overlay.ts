import { ConnectionManager, type StreamType } from "./ConnectionManager.ts";
import "./overlay.css";
import "./css/header.css";
import "./css/footer.css";

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
			document.body.removeChild(modal);
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
	const connectionManager = new ConnectionManager(
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

	function setScene(scene: string) {
		const main = document.querySelector("main");
		if (main) {
			main.dataset.previousScene = main.dataset.scene;
			main.dataset.scene = scene;
			(document.getElementById("camera") as HTMLVideoElement).muted =
				scene === "start";
			(document.getElementById("screen") as HTMLVideoElement).muted =
				!scene.includes("screen");
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
