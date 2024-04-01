import { Controller, Flamework, OnStart } from "@flamework/core";
import { AudioRaytraceParams, AudioRaytraceResult, WorkerActorInstance } from "./types";
import { RAYTRACE_THREAD_COUNT } from "shared/config/AudioRaytraceConfig";

const IsWorkerActorInstance = Flamework.createGuard<WorkerActorInstance>();

@Controller()
export class ParallelRaytracingController implements OnStart
{
	public static BASE_ACTOR = <WorkerActorInstance> script.FindFirstChild("Actor");

	public Workers: WorkerActorInstance[] = [];

	public async Raytrace(workerIndex: number, params: AudioRaytraceParams[]): Promise<AudioRaytraceResult[]>
	{
		return new Promise((resolve, reject, onCancel) =>
		{
			const connections: RBXScriptConnection[] = [];

			const worker = this.Workers[workerIndex];

			if (!worker)
			{
				throw `Worker at index ${workerIndex} does not exist!`;
			}

			const cleanup = () =>
			{
				connections.forEach(connection => connection.Disconnect());
			};

			connections.push(worker.OnWorkComplete.Event.Connect(result =>
			{
				cleanup();
				resolve(result);
			}));

			connections.push(worker.OnWorkErrored.Event.Connect(err =>
			{
				cleanup();
				reject(err);
			}));

			onCancel(() =>
			{
				cleanup();
			});

			worker.OnWorkStarted.Fire(params);
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
