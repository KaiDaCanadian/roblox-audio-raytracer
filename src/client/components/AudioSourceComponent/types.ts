export interface AudioSourceComponentAttributes
{
	AssetId: string;
	RaytracingEnabled: boolean;
}

export type AudioSourceComponentInstance = BasePart & {
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
