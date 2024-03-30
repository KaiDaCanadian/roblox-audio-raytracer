export type AudioSourceUniqueType = {
	emitter_id: string,
	position: Vector3
};

export type AudioRaytraceParams = {
    cameraCFrame: CFrame;
    direction: Vector3;

    emitter: string;

	audioSources: AudioSourceUniqueType[];
}

export type AudioRaytraceResult = {
    faderVolume: number;

    lowGain: number;
    midGain: number;
    highGain: number;

    emitter: string;
    audioSource: AudioSourceUniqueType;
} | {
    faderVolume: 0;
    emitter: string;
    audioSource: undefined;
};

export type AudioEmitterInstance = Attachment & {
	AudioEqualizer: AudioEqualizer & {
		Wire: Wire;
	};
	// AudioEcho: AudioEcho & {
	// 	Wire: Wire;
	// };
	AudioFader: AudioFader & {
		Wire: Wire;
	};
	AudioEmitter: AudioEmitter & {
		Wire: Wire;
	};
};

export interface DirectionAndEmitter
{
	Direction: Vector3;
	Emitter: AudioEmitterInstance;
}

export type RaytracePathPoint = Vector3;

export interface RaytraceResult
{
	AudioSource: AudioSourceUniqueType;
	DotProduct: number;
	TotalBounces: number;
	Obstructed: boolean;
}