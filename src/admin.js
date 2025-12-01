console.log("Admin script loaded");

let webSocket = null;

// Get user camera and mic
initUserCameraAndMic()
	.then(() => initUserScreenShare())
	.then(() => {
		// Open websocket connection to server
		initWebSocketConnection("admin", async (message) => {
			console.log("Received message in admin: ", message);
			const data = JSON.parse(message);
			switch (data.type) {
				case "offer":
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
	});



async function initUserCameraAndMic() {
	console.log("Initializing user camera and mic...");

	const devices = await navigator.mediaDevices.enumerateDevices();
	console.log("Devices: ", devices);


	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { max: 1920 }, aspectRatio: { exact: 1920 / 1080 } }, audio: true });
		const videoElement = document.getElementById("camera");
		if (videoElement) {
			videoElement.srcObject = stream;
			console.log("User camera and mic stream set to video element.");
		} else {
			console.error("Video element for camera not found.");
		}
		addStream(stream);
	} catch (error) {
		console.error("Error accessing user camera and mic: ", error);
	}
}

async function initUserScreenShare() {
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
		addStream(stream);
	} catch (error) {
		console.error("Error accessing user screen share: ", error);
	}
}

function addStream(stream) {
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

	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);
	console.log("Created and set local description with offer: ", offer);

	webSocket.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
}
