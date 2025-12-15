console.log("Admin script loaded");

let socket;
// Open websocket connection to server
initWebSocketConnection("overlay", async (message) => {
	console.log("Received message in overlay: ", message);
	const data = JSON.parse(message);
	switch (data.type) {
		case "offer":
			await pc.setRemoteDescription(new RTCSessionDescription(data));
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			console.log("Created and set local description with answer: ", answer);
			socket.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
			break;
		case "ice-candidate":
			try {
				await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
				console.log("Added ICE candidate: ", data.candidate);
			} catch (e) {
				console.error("Error adding received ICE candidate", e);
			}
			break;
		case "new-source":
			console.log("New source: ", data.source);
			addSource(data.source);
			break;
		case "set-scene":
			setScene(data.scene);
			break;
		case "refresh":
			location.reload();
			break;
		case "refresh-css":
			refreshCss();
			break;
		default:
			console.warn("Unknown message type received: ", data);
	}
}).then((ws) => {
	socket = ws;

	pc.onicecandidate = (event) => {
		ws.send(JSON.stringify({
			type: "ice-candidate",
			candidate: event.candidate,
		}));
	};
	return alertModal("Overlay connected to server.");
}).then(() => {
	socket.send(JSON.stringify({ type: "new-overlay" }));
});

const streams = {};
/**
 * @type {{[key: string]: MediaStreamTrack}}
 */
const tracks = {};
/**
 * @type {{type: "camera" | "screen", trackIds: string[], stream?: MediaStream}[]}
 */
const sources = [];
pc.ontrack = (ev) => {
	console.log("Track received: ", ev);
	const trackId = ev.track.id;
	tracks[trackId] = ev.track;
	const source = sources.find((s) => s.trackIds.includes(trackId));
	if (source) {
		console.log("Initializing source stream for received track: ", source);
		initSourceStream(source);
	} else {
		console.warn("No source found for received track ID: ", trackId);
	}
};

function alertModal(message) {
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

/**
 * @param {string} scene 
 */
function setScene(scene) {
	const main = document.querySelector("main");
	if (main) {
		main.dataset.previousScene = main.dataset.scene;
		main.dataset.scene = scene;
		document.getElementById("camera").muted = scene === "start";
		document.getElementById("screen").muted = !scene.includes("screen");
		console.log("Scene set to: ", scene);
	} else {
		console.error("Main element not found to set scene.");
	}
}

function refreshCss() {
	const links = document.getElementsByTagName("link");
	for (let i = 0; i < links.length; i++) {
		const link = links[i];
		if (link.rel === "stylesheet") {
			const href = link.href.split("?")[0];
			link.href = href + "?v=" + new Date().getTime();
			console.log("Refreshed CSS: ", link.href);
		}
	}
}

function addSource(source) {
	sources.push(source);
	initSourceStream(source);
}

function initSourceStream(source) {
	if (source.stream) return;
	const { type, trackIds } = source;
	const tracksToAdd = trackIds
		.map((id) => tracks[id]);
	if (tracksToAdd.some((t) => !t)) {
		console.error("Some tracks to add were not found: ", trackIds, tracksToAdd);
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
		const video = document.getElementById(type);
		console.log("Setting stream to video element: ", type, video);
		video.onloadedmetadata = function (e) {
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
