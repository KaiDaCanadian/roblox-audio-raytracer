import { Controller, Flamework, OnStart } from "@flamework/core";
import { AudioRaytraceParams, AudioRaytraceResult, AudioSource, WorkerActorInstance } from "./types";
import { RAYTRACE_THREAD_COUNT } from "shared/config/AudioRaytraceConfig";
import { DecodeAudioRaytraceResultBuffer, EncodeAudioRaytraceParamsBuffer } from "./bufferutil";

const IsWorkerActorInstance = Flamework.createGuard<WorkerActorInstance>();

@Controller()
export class ParallelRaytracingController implements OnStart
{
	public static BASE_ACTOR = <WorkerActorInstance> script.FindFirstChild("Actor");

	public Workers: WorkerActorInstance[] = [];

	public async Raytrace(workerIndex: number, audioSources: AudioSource[], raycastParams: RaycastParams, params: AudioRaytraceParams[]): Promise<AudioRaytraceResult[]>
	{
		return new Promise<AudioRaytraceResult[]>((resolve, reject, onCancel) =>
		{
			const connections: RBXScriptConnection[] = [];
			const cleanup = () => connections.forEach(connection => connection.Disconnect());

			const worker = this.Workers[workerIndex];

			if (!worker)
			{
				throw `Worker at index ${workerIndex} does not exist!`;
			}

			connections.push(worker.OnWorkComplete.Event.Connect(result =>
			{
				cleanup();
				resolve(DecodeAudioRaytraceResultBuffer(result));
			}));

			connections.push(worker.OnWorkErrored.Event.Connect(err =>
			{
				cleanup();
				reject(err);
			}));

			onCancel(cleanup);

			worker.OnWorkStarted.Fire(EncodeAudioRaytraceParamsBuffer(audioSources, params), raycastParams);
		});
	}

	public InitializeWorkers(numWorkers: number): void
	{
		this.Workers.forEach(worker => worker.Destroy());
		this.Workers = table.create(numWorkers);

		for (let i = 0; i < numWorkers; ++i)
		{
			const worker = ParallelRaytracingController.BASE_ACTOR.Clone();
			worker.worker.Disabled = false;
			worker.Parent = script;

			this.Workers.push(worker);
		}
	}

	public onStart(): void
	{
		if (!IsWorkerActorInstance(ParallelRaytracingController.BASE_ACTOR))
		{
			throw "ParallelRaytracingController.BASE_ACTOR failed the type guard!";
		}

		this.InitializeWorkers(RAYTRACE_THREAD_COUNT);
	}
}
