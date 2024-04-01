import { AudioSourceComponentInstance } from "client/components/AudioSourceComponent/types";
import { AudioEmitterInstance } from "../RaytracingController/types";

export type WorkerActorInstance = Actor & {
	worker: BaseScript;
	OnWorkStarted: BindableEvent<(params: AudioRaytraceParams[]) => void>;
	OnWorkErrored: BindableEvent<(err: unknown) => void>;
	OnWorkComplete: BindableEvent<(results: AudioRaytraceResult[]) => void>;
};

export interface AudioRaytracePathPoint
{
	Position: Vector3;
	Direction: Vector3;
}

export interface AudioRaytraceParams
{
	StartingCFrame: CFrame;
	StartingDirection: Vector3;
	Emitter: AudioEmitterInstance;
	AudioSources: AudioSourceComponentInstance[];
	RaycastParams: RaycastParams | undefined;
};

export type AudioRaytraceResult = {
	PathPoints: Vector3[];
	TotalBounces: number;
	DotProduct: number;
	Occluded: boolean;

	SelectedAudioSource: AudioSourceComponentInstance | undefined;
	Emitter: AudioEmitterInstance;

	ElapsedTime: number;
} | {
	SelectedAudioSource: undefined;
	Emitter: AudioEmitterInstance;
	ElapsedTime: number;
};
