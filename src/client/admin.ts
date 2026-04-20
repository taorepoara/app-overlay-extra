import {
	ConnectionManager,
	type Scene,
	type StreamType,
	scenes,
} from "./ConnectionManager.js";
import "./admin.css";
import { confirmModal } from "./common.js";

console.log("Admin script loaded");

const streams: Map<StreamType, MediaStream> = new Map();

type MusicSyncState = {
	windowEndTime: number | null;
	pendingScene: string | null;
};
let musicSyncState: MusicSyncState = {
	windowEndTime: null,
	pendingScene: null,
};
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function updateMusicSyncDisplay() {
	const countdownEl = document.getElementById(
		"music-countdown",
	) as HTMLElement | null;
	const cancelBtn = document.getElementById(
		"cancel-transition",
	) as HTMLButtonElement | null;
	if (!countdownEl) return;

	const { windowEndTime, pendingScene } = musicSyncState;

	if (windowEndTime === null) {
		countdownEl.textContent = "Transition en cours…";
		countdownEl.dataset.state = "transition";
		if (cancelBtn) cancelBtn.hidden = true;
		return;
	}

	const remaining = Math.max(0, windowEndTime - Date.now());
	const seconds = (remaining / 1000).toFixed(1);

	if (pendingScene) {
		countdownEl.textContent = `→ ${pendingScene} dans ${seconds}s`;
		countdownEl.dataset.state = "pending";
		if (cancelBtn) cancelBtn.hidden = false;
	} else {
		countdownEl.textContent = `Fenêtre dans ${seconds}s`;
		countdownEl.dataset.state = "idle";
		if (cancelBtn) cancelBtn.hidden = true;
	}
}

const permissions = [
	"microphone",
	"camera",
	"captured-surface-control",
	"display-capture",
];
permissions
	.reduce(
		(previousPromise, permission) =>
			previousPromise.then((result) => {
				console.log(`Requesting permission for: ${permission}`);
				return navigator.permissions
					.query({ name: permission as PermissionName })
					.then((status) => {
						console.log(`Permission for ${permission}: ${status.state}`);
						return result && status.state === "granted";
					});
			}),
		Promise.resolve(true),
	)
	.then((_allGranted) => updateMediaDevices())
	.then(() => initAdminUI());

// Open websocket connection to server
const connectionManager = ConnectionManager.init("admin", async (message) => {
	console.log("Received message in admin: ", message);
	switch (message.type) {
		case "setScene":
			(document.getElementById("scene") as HTMLSelectElement).value =
				message.scene;
			break;
		case "hideInterface":
			(document.getElementById("hide-interface") as HTMLInputElement).checked =
				message.hidden;
			break;
		case "setSoundMuted":
			if (message.input === "microphone") {
				(document.getElementById("mute-mic") as HTMLInputElement).checked =
					message.muted;
			} else if (message.input === "music") {
				(document.getElementById("mute-music") as HTMLInputElement).checked =
					message.muted;
			}
			break;
		case "twitchAuthRequired":
			confirmModal("Twitch auth needed. Redirect to authorize page ?").then(
				(result) => {
					if (result) {
						console.log("Start Twitch auth flow");
						const authorizeParams = new URLSearchParams(message.params);
						authorizeParams.append(
							"redirect_uri",
							`${location.origin}/redirect`,
						);
						location.href = `https://id.twitch.tv/oauth2/authorize?${authorizeParams}`;
					}
				},
			);
			break;
		case "musicSyncUpdate":
			musicSyncState = {
				windowEndTime: message.windowEndTime,
				pendingScene: message.pendingScene,
			};
			updateMusicSyncDisplay();
			if (countdownInterval === null) {
				countdownInterval = setInterval(updateMusicSyncDisplay, 100);
			}
			break;
		case "twitchSchedule": {
			const upcomingStreamEl = document.getElementById(
				"upcoming-stream",
			) as HTMLDivElement;
			const streamInfoForm = document.getElementById(
				"stream-info-form",
			) as HTMLFormElement;
			const statusEl = document.getElementById(
				"stream-info-status",
			) as HTMLParagraphElement;
			if (message.upcomingStream) {
				const { title, startDate, endDate, categoryName, tags } =
					message.upcomingStream;
				// Title
				(
					document.getElementById("next-stream-title") as HTMLElement
				).textContent = title;
				// Dates
				(
					document.getElementById("next-stream-date") as HTMLElement
				).textContent =
					`${new Date(startDate).toLocaleString("fr-FR")} - ${new Date(endDate).toLocaleString("fr-FR")}`;
				// Category
				(
					document.getElementById("next-stream-category") as HTMLElement
				).textContent = categoryName;
				// Tags
				(
					document.getElementById("next-stream-tags") as HTMLElement
				).textContent = tags.join(", ");
				upcomingStreamEl.hidden = false;
				streamInfoForm.hidden = true;
				if (message.autoApplied) {
					statusEl.textContent =
						"✓ Informations de diffusion appliquées automatiquement.";
					statusEl.dataset.state = "success";
					statusEl.hidden = false;
				} else {
					statusEl.hidden = true;
				}
			} else {
				upcomingStreamEl.hidden = true;
				streamInfoForm.hidden = false;
				statusEl.hidden = true;
			}
			break;
		}
		case "updateStreamInfoResult": {
			const statusEl = document.getElementById(
				"stream-info-status",
			) as HTMLParagraphElement;
			const submitBtn = document.querySelector(
				"#stream-info-form button[type=submit]",
			) as HTMLButtonElement;
			if (message.success) {
				statusEl.textContent = message.applied
					? "✓ Live planifié et informations de diffusion appliquées."
					: "✓ Live planifié. Les informations seront appliquées moins d'une heure avant le live.";
				statusEl.dataset.state = "success";
			} else {
				statusEl.textContent = `Erreur : ${message.error ?? "inconnue"}`;
				statusEl.dataset.state = "error";
			}
			statusEl.hidden = false;
			submitBtn.disabled = false;
			break;
		}
		default:
			console.warn("Unknown message type received: ", message);
	}
});

async function updateMediaDevices() {
	const devices = await navigator.mediaDevices.enumerateDevices();
	console.log("Available media devices: ", devices);
	const videoDevices = devices.filter((device) => device.kind === "videoinput");
	const cameraSelect = document.getElementById(
		"camera-select",
	) as HTMLSelectElement;
	cameraSelect.innerHTML = '<option value="">Sélectionner une caméra</option>';
	for (const device of videoDevices) {
		if (!device.deviceId) {
			console.warn("Device with empty deviceId found, skipping:", device);
			return;
		}
		const option = document.createElement("option");
		option.value = device.deviceId;
		option.text = device.label || `Camera ${cameraSelect.length + 1}`;
		cameraSelect.appendChild(option);
	}
	const audioDevices = devices.filter((device) => device.kind === "audioinput");
	const micSelect = document.getElementById("mic-select") as HTMLSelectElement;
	micSelect.innerHTML = '<option value="">Sélectionner un micro</option>';
	for (const device of audioDevices) {
		const option = document.createElement("option");
		option.value = device.deviceId;
		option.text = device.label || `Microphone ${micSelect.length + 1}`;
		micSelect.appendChild(option);
	}
}

navigator.mediaDevices.ondevicechange = () => {
	console.log("Media devices changed, updating device lists...");
	updateMediaDevices();
};

async function previewUserCamera() {
	console.log("Initializing user camera and mic...");

	const cameraSelect = document.getElementById(
		"camera-select",
	) as HTMLSelectElement;
	const micSelect = document.getElementById("mic-select") as HTMLSelectElement;
	const cameraDeviceId = cameraSelect.value;
	const micDeviceId = micSelect.value;
	const videoElement = document.getElementById(
		"camera-selected",
	) as HTMLVideoElement;
	videoElement.srcObject = null;

	const userMediaOptions: MediaStreamConstraints = {};
	if (cameraDeviceId) {
		userMediaOptions.video = {
			deviceId: { exact: cameraDeviceId },
			width: { max: 1920, ideal: 1920 },
			aspectRatio: { exact: 16 / 9 },
		};
	}
	if (micDeviceId) {
		userMediaOptions.audio = {
			deviceId: { exact: micDeviceId },
			noiseSuppression: true,
		};
	}

	try {
		const stream = await navigator.mediaDevices.getUserMedia(userMediaOptions);
		videoElement.srcObject = stream;
		console.log("User camera and mic stream set to video element.");
	} catch (error) {
		console.error("Error accessing user camera and mic: ", error);
	}
}

async function addUserCamera(selected = true) {
	console.log("Initializing user camera and mic...");

	const cameraSelect = document.getElementById(
		"camera-select",
	) as HTMLSelectElement;
	const micSelect = document.getElementById("mic-select") as HTMLSelectElement;
	const cameraDeviceId = cameraSelect.value;
	const micDeviceId = micSelect.value;
	const type = "camera";
	removeStream(type);
	const videoElement = document.getElementById(type) as HTMLVideoElement;
	videoElement.srcObject = null;

	const userMediaOptions: MediaStreamConstraints = {};
	if (selected) {
		if (cameraDeviceId) {
			userMediaOptions.video = {
				deviceId: { exact: cameraDeviceId },
				width: { max: 1920, ideal: 1920 },
				aspectRatio: { exact: 16 / 9 },
				// backgroundBlur: true,
			};
		}
		if (micDeviceId) {
			userMediaOptions.audio = {
				deviceId: { exact: micDeviceId },
				noiseSuppression: true,
			};
		}
	} else {
		userMediaOptions.video = {
			width: { max: 1920, ideal: 1920 },
			aspectRatio: { exact: 16 / 9 },
			// backgroundBlur: true,
		};
		userMediaOptions.audio = {
			noiseSuppression: true,
		};
	}

	try {
		const stream = await navigator.mediaDevices.getUserMedia(userMediaOptions);
		videoElement.srcObject = stream;
		console.log("User camera and mic stream set to video element.");
		addStream(type, stream);
	} catch (error) {
		console.error("Error accessing user camera and mic: ", error);
	}
}

async function addDeviceShare() {
	console.log("Initializing user screen share...");

	try {
		const stream = await navigator.mediaDevices.getDisplayMedia({
			video: {
				cursor: "always",
			},
			audio: { restrictOwnAudio: false },
			systemAudio: "include",
			surfaceSwitching: "exclude",
			windowAudio: "window",
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);
		const screenElement = document.getElementById("screen") as HTMLVideoElement;
		if (screenElement) {
			screenElement.srcObject = stream;
			console.log("User screen share stream set to video element.");
		} else {
			console.error("Video element for screen share not found.");
		}
		addStream("screen", stream);
	} catch (error) {
		console.error("Error accessing user screen share: ", error);
	}
}

function removeStream(type: StreamType) {
	if (type in streams) {
		// Remove existing tracks from peer connection
		streams
			.get(type)
			?.getTracks()
			.forEach((track) => {
				connectionManager.removeTrack(track);
				track.stop();
			});
		streams.delete(type);
	}
}

function addStream(type: StreamType, stream: MediaStream) {
	removeStream(type);
	streams.set(type, stream);
	console.log("Adding stream to peer connection: ", stream);
	const ids = stream.getTracks().map((track) => {
		console.log(`Adding ${type} track to peer connection`, track);
		connectionManager.addTrack(track, stream);
		return track.id;
	});
	connectionManager.sendMessage({
		type: "newSource",
		source: { type, trackIds: ids },
	});
	console.log(
		"Sent newSource message to overlay for type ",
		type,
		" with track IDs: ",
		ids,
	);
}

function setScene(scene: Scene) {
	if (connectionManager.sendMessage({ type: "setScene", scene: scene })) {
		console.log("Sent setScene message to overlay: ", scene);
	}
}

// function refreshCss() {
// 	if (webSocket) {
// 		webSocket.send(JSON.stringify({ type: "refresh-css" }));
// 		console.log("Sent refresh-css message to overlay.");
// 	} else {
// 		console.error("WebSocket is not connected. Cannot refresh CSS.");
// 	}
// }

// function refresh() {
// 	if (webSocket) {
// 		if (confirm("Êtes-vous sûr de vouloir rafraîchir l'overlay ?")) {
// 			webSocket.send(JSON.stringify({ type: "refresh" }));
// 			console.log("Sent refresh message to overlay.");
// 		}
// 	} else {
// 		console.error("WebSocket is not connected. Cannot refresh.");
// 	}
// }

async function initAdminUI() {
	// const refreshCssButtons = document.getElementsByClassName("refresh-css");
	// for (let i = 0; i < refreshCssButtons.length; i++) {
	// 	const button = refreshCssButtons[i];
	// 	button.addEventListener("click", () => {
	// 		refreshCss();
	// 	});
	// }

	// const refreshButtons = document.getElementsByClassName("refresh");
	// for (let i = 0; i < refreshButtons.length; i++) {
	// 	const button = refreshButtons[i];
	// 	button.addEventListener("click", () => {
	// 		refresh();
	// 	});
	// }

	const addCameraDialog = document.getElementById(
		"add-camera",
	) as HTMLDialogElement;
	const openAddCameraButton = document.getElementById(
		"open-add-camera",
	) as HTMLButtonElement;

	openAddCameraButton.addEventListener("click", () => {
		// addCameraDialog.showModal();
		addUserCamera(false);
	});

	addCameraDialog.addEventListener("close", () => {
		if (addCameraDialog.returnValue) {
			addUserCamera();
		}
	});

	const sceneSelect = document.getElementById("scene") as HTMLSelectElement;
	scenes.forEach((scene) => {
		const option = document.createElement("option");
		option.value = scene;
		option.text = scene;
		sceneSelect.appendChild(option);
	});
	sceneSelect.value = scenes[0];
	sceneSelect.addEventListener("change", () => {
		setScene(sceneSelect.value as Scene);
	});

	const cameraSelect = document.getElementById(
		"camera-select",
	) as HTMLSelectElement;
	cameraSelect.addEventListener("change", () => {
		previewUserCamera();
	});

	const micSelect = document.getElementById("mic-select") as HTMLSelectElement;
	micSelect.addEventListener("change", () => {
		previewUserCamera();
	});

	const shareScreenButton = document.getElementById(
		"share-screen",
	) as HTMLButtonElement;
	shareScreenButton.addEventListener("click", () => {
		addDeviceShare();
	});

	const cancelTransitionBtn = document.getElementById(
		"cancel-transition",
	) as HTMLButtonElement;
	cancelTransitionBtn.addEventListener("click", () => {
		connectionManager.sendMessage({ type: "cancelTransition" });
	});

	const hideInterfaceCheckbox = document.getElementById(
		"hide-interface",
	) as HTMLInputElement;
	hideInterfaceCheckbox.addEventListener("change", () => {
		// mute on overlay side
		connectionManager.sendMessage({
			type: "hideInterface",
			hidden: hideInterfaceCheckbox.checked,
		});
	});

	const muteMicCheckbox = document.getElementById(
		"mute-mic",
	) as HTMLInputElement;
	muteMicCheckbox.addEventListener("change", () => {
		// mute on overlay side
		connectionManager.sendMessage({
			type: "setSoundMuted",
			input: "microphone",
			muted: muteMicCheckbox.checked,
		});
	});

	const muteMusicCheckbox = document.getElementById(
		"mute-music",
	) as HTMLInputElement;
	muteMusicCheckbox.addEventListener("change", () => {
		// mute on overlay side
		connectionManager.sendMessage({
			type: "setSoundMuted",
			input: "music",
			muted: muteMusicCheckbox.checked,
		});
	});

	const streamInfoForm = document.getElementById(
		"stream-info-form",
	) as HTMLFormElement;
	streamInfoForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const title = (
			document.getElementById("stream-title") as HTMLInputElement
		).value.trim();
		const gameName = (
			document.getElementById("stream-game") as HTMLInputElement
		).value.trim();
		const tagsRaw = (document.getElementById("stream-tags") as HTMLInputElement)
			.value;
		const tags = tagsRaw
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		const startDate = (
			document.getElementById("stream-start-date") as HTMLInputElement
		).value;
		const endDate = (
			document.getElementById("stream-end-date") as HTMLInputElement
		).value;
		const statusEl = document.getElementById(
			"stream-info-status",
		) as HTMLParagraphElement;
		const submitBtn = streamInfoForm.querySelector(
			"button[type=submit]",
		) as HTMLButtonElement;
		statusEl.textContent = "Envoi en cours…";
		statusEl.dataset.state = "pending";
		statusEl.hidden = false;
		submitBtn.disabled = true;
		connectionManager.sendMessage({
			type: "updateStreamInfo",
			title,
			categoryName: gameName,
			tags,
			startDate: new Date(startDate).toISOString(),
			endDate: new Date(endDate).toISOString(),
		});
	});
}
