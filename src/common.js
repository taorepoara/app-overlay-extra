const pc = new RTCPeerConnection({
	iceServers: [
		// { urls: 'stun:stun.l.google.com:19302' },
		// {
		// 	urls: "stun:stun.stunprotocol.org",
		// },
	]
});
pc.oniceconnectionstatechange = () => {
	console.log("État de la connexion ICE :", pc.iceConnectionState);
};

/**
 * 
 * @param {string} type 
 * @param {function} onMessage
 */
async function initWebSocketConnection(type, onMessage) {
	console.log("Initializing WebSocket connection to server...");
	return new Promise((resolve, reject) => {

		// Replace with your server URL
		const serverUrl = `ws://${location.host}/ws`;
		const socket = new WebSocket(serverUrl);

		socket.onopen = () => {
			console.log("WebSocket connection established.");
			// You can send messages to the server here if needed
			socket.send(type);

			resolve(socket);
		};

		socket.onmessage = (event) => {
			console.log("Message from server: ", event.data);
			onMessage(event.data);
		};

		socket.onerror = (error) => {
			console.error("WebSocket error: ", error);
		};

		socket.onclose = () => {
			console.log("WebSocket connection closed.");
		};
	});
}
