import type { StreamType } from "../types.ts";

type TrackName = "music" | StreamType;

export class AudioManager {
	public static readonly instance: AudioManager = new AudioManager();
	public readonly audioContext: AudioContext = new AudioContext();
	public readonly tracks: { [key: string]: SoundTrack } = {};

	addTrack(name: TrackName, track: SoundTrack) {
		if (this.tracks[name]) {
			console.warn(
				`Track with name ${name} already exists. It will be replaced.`,
			);
		}
		this.tracks[name] = track;
	}

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

	setTrackGain(name: TrackName, gain: number) {
		const track = this.tracks[name];
		if (!track) {
			console.warn(`Track with name ${name} not found.`);
			return;
		}
		const start = track.gainNode.gain.value;
		const diff = gain - start;
		const duration = 0.3;
		track.gainNode.gain.setValueCurveAtTime(
			[
				start,
				start + (diff * 10) / 100,
				start + (diff * 50) / 100,
				start + (diff * 90) / 100,
				gain,
			],
			this.audioContext.currentTime,
			duration,
		);
	}
}

abstract class SoundTrack {
	public readonly gainNode: GainNode;
	constructor(name: TrackName) {
		AudioManager.instance.addTrack(name, this);
		this.gainNode = AudioManager.instance.audioContext.createGain();
		this.gainNode.connect(AudioManager.instance.audioContext.destination);
	}
}

export class AudioStreamTrack extends SoundTrack {
	constructor(name: StreamType, stream: MediaStream) {
		super(name);
		const source =
			AudioManager.instance.audioContext.createMediaStreamSource(stream);
		source.connect(this.gainNode);
	}
}

export class Music extends SoundTrack {
	readonly tracks: MusicTrack[] = [];

	constructor() {
		super("music");
	}
}

export class MusicTrack {
	public readonly gainNode: GainNode;
	private readonly parts: MusicTrackPart[] = [];
	public nextStartTime = 0;

	constructor(readonly music: Music) {
		this.music.tracks.push(this);
		this.gainNode = AudioManager.instance.audioContext.createGain();
		this.gainNode.connect(music.gainNode);
	}

	async addPart(
		url: string,
		repeat: number,
		offset?: number,
		duration?: number,
	): Promise<MusicTrackPart> {
		const buffer = await AudioManager.instance.loadSound(url);
		const part = new MusicTrackPart(this, buffer, repeat, offset, duration);
		this.parts.push(part);
		return part;
	}
}

export interface IMusicTrackPart {
	playing: boolean;
	duration: number;
	start(): Date;
	onended: (() => void) | null;
}

export class MusicTrackPart implements IMusicTrackPart {
	private readonly track: MusicTrack;
	public readonly buffer: AudioBuffer;
	public readonly repeat: number;
	public readonly offset?: number;
	private readonly _duration?: number;
	public onended: (() => void) | null = null;
	private _playing = false;
	private source: AudioBufferSourceNode | null = null;

	constructor(
		track: MusicTrack,
		buffer: AudioBuffer,
		repeat: number,
		offset?: number,
		duration?: number,
	) {
		this.track = track;
		this.buffer = buffer;
		this.repeat = repeat;
		this.offset = offset;
		this._duration = duration;
	}

	get playing(): boolean {
		return this._playing;
	}

	get duration(): number {
		return (this._duration ?? this.buffer.duration) * this.repeat;
	}

	start(): Date {
		if (this._playing) throw new Error("SoundTrackPart is already playing");
		this._playing = true;
		const startTime = this.track.nextStartTime;
		const diff =
			(startTime - AudioManager.instance.audioContext.currentTime) * 1000;
		const endDate = new Date(
			Date.now() + diff + this.buffer.duration * 1000 * this.repeat,
		);
		if (this.source == null) {
			console.debug("SoundTrackPart play", this);
			this.source = AudioManager.instance.createBufferSource(this.buffer);
			this.source.loop = true;
			if (this.offset !== undefined) {
				this.source.loopStart = this.offset;
			}
			if (this.duration !== undefined) {
				this.source.loopEnd = (this.offset ?? 0) + this.duration;
			}
			this.source.connect(this.track.gainNode);
			this.source.start(startTime, this.offset);
		} else {
			console.debug("SoundTrackPart continue", this);
			this.source.loop = true;
		}
		this.track.nextStartTime = startTime + this.buffer.duration * this.repeat;

		setTimeout(
			() => {
				console.debug("SoundTrackPart ended", this);
				this._playing = false;
				if (this.source != null) {
					this.source.loop = false;
					// if (this.duration !== undefined) {
					// 	this.source.stop(startTime + this.duration);
					// }
				}
				this.onended?.();
				if (!this._playing) {
					console.debug("SoundTrackPart stop", this);
					this.source?.disconnect();
					this.source = null;
				}
			},
			endDate.getTime() - Date.now() - 10,
		);
		return endDate;
	}
}

export class MusicPartGroup implements IMusicTrackPart {
	private currentPartIndex = -1;
	public onended: (() => void) | null = null;

	constructor(readonly parts: MusicTrackPart[]) {}

	get playing(): boolean {
		return this.parts.some((part) => part.playing);
	}
	get duration(): number {
		return this.parts.reduce((sum, part) => sum + part.duration, 0);
	}
	start(): Date {
		if (this.currentPartIndex >= 0)
			throw new Error("MusicPartGroup is already playing");
		this.currentPartIndex = 0;
		const firstPartEnd = this.playNextPart().getTime();
		const endDate = new Date(
			this.parts
				.slice(1)
				.reduce((sum, part) => sum + part.duration, firstPartEnd),
		);

		return endDate;
	}

	private playNextPart(): Date {
		const nextPart = this.parts[this.currentPartIndex];
		nextPart.onended = () => {
			this.currentPartIndex++;
			if (this.currentPartIndex < this.parts.length) {
				this.playNextPart();
			} else {
				this.currentPartIndex = -1;
				this.onended?.();
			}
		};
		return nextPart.start();
	}
}
