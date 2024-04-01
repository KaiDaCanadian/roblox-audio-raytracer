export type WorkerActorInstance = Actor & {
	worker: BaseScript;
	OnWorkStarted: BindableEvent<(buf: buffer, params: RaycastParams) => void>;
	OnWorkErrored: BindableEvent<(err: unknown) => void>;
	OnWorkComplete: BindableEvent<(buf: buffer) => void>;
};

export interface AudioRaytracePathPoint
{
	Position: Vector3;
	Direction: Vector3;
}

export type AudioSource = readonly [Vector3, number];

export interface AudioRaytraceParams
{
	StartingPosition: Vector3;
	StartingDirection: Vector3;
	EmitterIndex: number;
};

export type AudioRaytraceResult = {
	PathPoints: Vector3[];
	TotalBounces: number;
	DotProduct: number;
	Occluded: boolean;

	SelectedAudioSourceIndex: number | undefined;
	EmitterIndex: number;

	ElapsedTime: number;
};
