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
			const connections = new Set<RBXScriptConnection>();

			const worker = this.Workers[workerIndex];

			if (!worker)
			{
				throw `Worker at index ${workerIndex} does not exist!`;
			}

			const cleanup = () =>
			{
				connections.forEach(connection => connection.Disconnect());
			};

			connections.add(worker.OnWorkComplete.Event.Connect(result =>
			{
				cleanup();
				resolve(DecodeAudioRaytraceResultBuffer(result));
			}));

			connections.add(worker.OnWorkErrored.Event.Connect(err =>
			{
				cleanup();
				reject(err);
			}));

			onCancel(() =>
			{
				cleanup();
			});

			const buf = EncodeAudioRaytraceParamsBuffer(audioSources, params);

			worker.OnWorkStarted.Fire(buf, raycastParams);
		});
	}

	public InitializeWorkers(numWorkers: number): void
	{
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
