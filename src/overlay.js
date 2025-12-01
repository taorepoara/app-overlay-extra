console.log("Admin script loaded");

let socket;
// Open websocket connection to server
initWebSocketConnection("overlay", async (message) => {
	console.log("Received message in overlay: ", message);
	const data = JSON.parse(message);
	if (data.type === "offer") {
		await pc.setRemoteDescription(new RTCSessionDescription(data));
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		console.log("Created and set local description with answer: ", answer);
		socket.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
	}
	else if (data.type === "ice-candidate") {
		try {
			await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
			console.log("Added ICE candidate: ", data.candidate);
		} catch (e) {
			console.error("Error adding received ICE candidate", e);
		}
	}
	else {
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

	// alert("Overlay connected to server");
	// socket.send(JSON.stringify({ type: "new-overlay" }));
});

const streams = {};
let addedTracks = [];
pc.ontrack = (ev) => {
	console.log("Track received: ", ev);
	const id = addedTracks < 2 ? "camera" : "screen";
	const video = document.getElementById(id);
	console.log("Setting stream to video element: ", id, video);
	video.onloadedmetadata = function (e) {
		console.log("Metadata loaded, playing video...", e);
		video.play();
	};
	video.onerror = (e) => {
		console.error("Erreur lors de la lecture de la vidéo :", e);
	};
	if (ev.streams && ev.streams[0]) {
		video.srcObject = ev.streams[0];
	} else {
		console.log("Creating new inbound stream");
		if (!(id in streams)) {
			streams[id] = new MediaStream();
			video.srcObject = streams[id];
		}
		streams[id].addTrack(ev.track);
	}
	addedTracks.push(ev.track);
};
