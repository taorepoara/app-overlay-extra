console.log("Admin script loaded");

let webSocket = null;
const streams = {};

// Open websocket connection to server
initWebSocketConnection("admin", async (message) => {
	console.log("Received message in admin: ", message);
	const data = JSON.parse(message);
	switch (data.type) {
		case "answer":
			await pc.setRemoteDescription(new RTCSessionDescription(data));
			break;
		case "ice-candidate":
			try {
				await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
				console.log("Added ICE candidate: ", data.candidate);
			} catch (e) {
				console.error("Error adding received ICE candidate", e);
			}
			break;
		case "new-overlay":
			createPeerConnection();
			break;
		default:
			console.warn("Unknown message type received: ", data);
	}
}).then((ws) => {
	webSocket = ws;
	createPeerConnection();
});


async function updateUserDevices() {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const videoDevices = devices.filter(device => device.kind === 'videoinput');
	const cameraSelect = document.getElementById('cameraSelect');
	cameraSelect.innerHTML = '<option value="">Select Camera</option>';
	videoDevices.forEach(device => {
		const option = document.createElement('option');
		option.value = device.deviceId;
		option.text = device.label || `Camera ${cameraSelect.length + 1}`;
		cameraSelect.appendChild(option);
	});
	const audioDevices = devices.filter(device => device.kind === 'audioinput');
	const micSelect = document.getElementById('micSelect');
	micSelect.innerHTML = '<option value="">Select Camera</option>';
	audioDevices.forEach(device => {
		const option = document.createElement('option');
		option.value = device.deviceId;
		option.text = device.label || `Microphone ${micSelect.length + 1}`;
		micSelect.appendChild(option);
	});
}

updateUserDevices();

navigator.mediaDevices.ondevicechange = () => {
	console.log("Media devices changed, updating device lists...");
	updateUserDevices();
};

async function addUserCamera() {
	console.log("Initializing user camera and mic...");

	const cameraSelect = document.getElementById('cameraSelect');
	const micSelect = document.getElementById('micSelect');
	const cameraDeviceId = cameraSelect.value;
	const micDeviceId = micSelect.value;
	const type = "camera";
	removeStream(type);
	const videoElement = document.getElementById(type);
	videoElement.srcObject = null;

	const userMediaOptions = {};
	if (cameraDeviceId) {
		userMediaOptions.video = { deviceId: { exact: cameraDeviceId }, width: { max: 1920, ideal: 1920 }, aspectRatio: { exact: 16 / 9 } };
	}
	if (micDeviceId) {
		userMediaOptions.audio = { deviceId: { exact: micDeviceId } };
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
				cursor: "always"
			}, audio: true
		});
		const screenElement = document.getElementById("screen");
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

function removeStream(type) {
	if (type in streams) {
		// Remove existing tracks from peer connection
		streams[type].getTracks().forEach((track) => {
			const sender = pc.getSenders().find((s) => s.track === track);
			if (sender) {
				pc.removeTrack(sender);
				console.log(`Removed existing ${type} track from peer connection:`, track);
			}
			track.stop();
		});
		delete streams[type];
	}
}

function addStream(type, stream) {
	removeStream(type);
	streams[type] = stream;
	console.log("Adding stream to peer connection: ", stream);
	stream.getTracks()
		.forEach((track) => {
			console.log("Adding screen track to peer connection: ", track);
			pc.addTrack(track, stream)
		});
}

async function createPeerConnection() {
	console.log("Creating RTCPeerConnection...", webSocket);

	pc.onicecandidate = (event) => {
		webSocket.send(JSON.stringify({
			type: "ice-candidate",
			candidate: event.candidate,
		}));
	};
	await createOffer();
}

async function createOffer() {
	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);
	console.log("Created and set local description with offer: ", offer);

	webSocket.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
}

pc.onnegotiationneeded = async () => {
	console.log("Negotiation needed event triggered.");
	await createOffer();
}

