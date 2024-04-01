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
