export interface DiegeticAudioEmitterAttributes
{
	AssetId: string;
	RaytracingEnabled: boolean;
}

export type DiegeticAudioEmitterInstance = BasePart & {
	AudioEmitter: AudioEmitter;
	AudioEqualizer: AudioEqualizer & {
		Wire: Wire;
	};
	AudioFader: AudioFader & {
		Wire: Wire;
	};
	AudioPlayer: AudioPlayer & {
		Wire: Wire;
	};
};
