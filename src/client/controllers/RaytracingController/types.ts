export type AudioEmitterInstance = Attachment & {
	AudioEqualizer: AudioEqualizer & {
		Wire: Wire;
	};
	AudioEcho: AudioEcho & {
		Wire: Wire;
	};
	AudioFader: AudioFader & {
		Wire: Wire;
	};
	AudioEmitter: AudioEmitter & {
		Wire: Wire;
	};
	Debug: SphereHandleAdornment;
};

export interface DirectionAndEmitter
{
	Direction: Vector3;
	Emitter: AudioEmitterInstance;
}
