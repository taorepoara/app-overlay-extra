import {
	ConnectionManager,
	type Scene,
	type StreamType,
} from "./ConnectionManager.js";
import "./admin.css";

console.log("Admin script loaded");

const streams: Map<StreamType, MediaStream> = new Map();

// Open websocket connection to server
const connectionManager = new ConnectionManager("admin", async (message) => {
	console.log("Received message in admin: ", message);
	switch (message.type) {
		case "setScene":
			(document.getElementById("scene") as HTMLSelectElement).value =
				message.scene;
			break;
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

updateMediaDevices();

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
	const type = "camera";
	const videoElement = document.getElementById(type) as HTMLVideoElement;
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

async function addUserCamera() {
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

function initAdminUI() {
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
		addCameraDialog.showModal();
	});

	addCameraDialog.addEventListener("close", () => {
		if (addCameraDialog.returnValue) {
			addUserCamera();
		}
	});

	const sceneSelect = document.getElementById("scene") as HTMLSelectElement;
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
}

initAdminUI();
