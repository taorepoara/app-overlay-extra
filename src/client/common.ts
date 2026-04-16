
export function alertModal(message: string): Promise<void> {
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

export function confirmModal(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = document.createElement("dialog");
		const modalMessage = document.createElement("p");
		const footer = document.createElement("footer");
		const validateButton = document.createElement("button");
		const cancelButton = document.createElement("button");
		validateButton.textContent = "OK";
		cancelButton.textContent = "Cancel";
		modalMessage.textContent = message;
		cancelButton.addEventListener("click", () => {
			modal.close();
			modal.remove();
			resolve(false);
		});
		validateButton.addEventListener("click", () => {
			modal.close();
			modal.remove();
			resolve(true);
		});
		modal.appendChild(modalMessage);
		footer.appendChild(validateButton);
		footer.appendChild(cancelButton);
		modal.appendChild(footer);
		document.body.appendChild(modal);
		modal.showModal();
	});
}