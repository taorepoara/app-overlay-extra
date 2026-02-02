export class AudioManager {
	public static readonly instance: AudioManager = new AudioManager();
	public readonly audioContext: AudioContext = new AudioContext();
	// private readonly tracks: Track[] = [];

	async loadSound(url: string): Promise<AudioBuffer> {
		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
		return audioBuffer;
	}

	async composeBuffers(
		repetitions: { buffer: AudioBuffer; count?: number }[],
	): Promise<AudioBuffer> {
		const totalLength = repetitions.reduce(
			(sum, rep) => sum + rep.buffer.length * (rep.count ?? 1),
			0,
		);
		const numberOfChannels = Math.max(
			...repetitions.map((rep) => rep.buffer.numberOfChannels),
		);
		const sampleRate = repetitions[0].buffer.sampleRate;

		const composedBuffer = this.audioContext.createBuffer(
			numberOfChannels,
			totalLength,
			sampleRate,
		);

		let offset = 0;
		for (const { buffer, count } of repetitions) {
			for (let i = 0; i < (count ?? 1); i++) {
				for (let channel = 0; channel < numberOfChannels; channel++) {
					const sourceData = buffer.getChannelData(
						channel % buffer.numberOfChannels,
					);
					const targetData = composedBuffer.getChannelData(channel);
					targetData.set(sourceData, offset);
				}
				offset += buffer.length;
			}
		}

		return composedBuffer;
	}

	createBufferSource(audioBuffer: AudioBuffer): AudioBufferSourceNode {
		const source = this.audioContext.createBufferSource();
		source.buffer = audioBuffer;
		return source;
	}
}

export class SoundTrack {
	readonly manager: AudioManager;
	private readonly parts: SoundTrackPart[] = [];
	public readonly gainNode: GainNode;
	public nextStartTime = 0;
	constructor(manager: AudioManager) {
		this.manager = manager;
		this.gainNode = this.manager.audioContext.createGain();
		this.gainNode.connect(this.manager.audioContext.destination);
	}

	async addPart(url: string, repeat: number): Promise<SoundTrackPart> {
		const buffer = await this.manager.loadSound(url);
		const part = new SoundTrackPart(this, buffer, repeat);
		this.parts.push(part);
		return part;
	}
}

export class SoundTrackPart {
	private readonly track: SoundTrack;
	public readonly buffer: AudioBuffer;
	public readonly repeat: number;
	public onended: (() => void) | null = null;
	private _playing = false;
	private source: AudioBufferSourceNode | null = null;

	constructor(track: SoundTrack, buffer: AudioBuffer, repeat: number) {
		this.track = track;
		this.buffer = buffer;
		this.repeat = repeat;
	}

	get playing() {
		return this._playing;
	}

	start(): Date {
		if (this._playing) throw new Error("SoundTrackPart is already playing");
		this._playing = true;
		const startTime = this.track.nextStartTime;
		const diff = (startTime - this.track.manager.audioContext.currentTime) * 1000;
		const endDate = new Date(
			Date.now() + diff + this.buffer.duration * 1000 * this.repeat,
		);
		if (this.source == null) {
			console.debug("SoundTrackPart play", this);
			this.source = this.track.manager.createBufferSource(this.buffer);
			this.source.loop = true;
			this.source.connect(this.track.gainNode);
			this.source.start(startTime);
		} else {
			console.debug("SoundTrackPart continue", this);
			this.source.loop = true;
		}
		this.track.nextStartTime = startTime + this.buffer.duration * this.repeat;

		setTimeout(() => {
			console.debug("SoundTrackPart ended", this);
			this._playing = false;
			if (this.source != null) {
				this.source.loop = false;
			}
			this.onended?.();
			if (!this._playing) {
				console.debug("SoundTrackPart stop", this);
				this.source?.disconnect();
				this.source = null;
			}
		}, endDate.getTime() - Date.now() - 10);
		return endDate;
	}
}
