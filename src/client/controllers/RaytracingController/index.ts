import { Controller, Flamework, OnRender, OnStart } from "@flamework/core";
import { AudioEmitterInstance, DirectionAndEmitter } from "./types";
import { AudioSourceComponent } from "client/components/AudioSourceComponent";
import { Players, Workspace } from "@rbxts/services";
import { DISTANCE_FROM_CAMERA, NUM_AUDIO_DIRECTIONS, RAYTRACE_COUNT_PER_WORKER, RAYTRACE_THREAD_COUNT } from "shared/config/AudioRaytraceConfig";
import { Components } from "@flamework/components";
import { ParallelRaytracingController } from "../ParallelRaytracingController";
import { AudioRaytraceResult } from "../ParallelRaytracingController/types";
import { split_arr } from "shared/util";

const IsAudioEmitterInstance = Flamework.createGuard<AudioEmitterInstance>();

@Controller()
export class RaytracingController implements OnStart, OnRender
{
	public AudioSources: AudioSourceComponent[] = [];
	public CurrentCamera = Workspace.CurrentCamera;

	public Directions: Vector3[] = [];

	public IndexEmitterMap = new Map<number, DirectionAndEmitter>();
	public EmitterIndexMap = new Map<DirectionAndEmitter, number>();

	public AudioSourceIndexMap = new Map<number, AudioSourceComponent>();

	public AudioEmitterPool: DirectionAndEmitter[] = [];

	/**
	 * `DirectionAndEmitter[ITERATION][NUM_THREADS][NUM_RAYCASTS_PER_THREAD]`
	 */
	public SplitAudioEmitterPool: DirectionAndEmitter[][][] = [];

	public CameraAttachmentPart = new Instance("Part");
	public RaycastParams = new RaycastParams();

	public constructor(
		private components: Components,
		private parallelRaytracingController: ParallelRaytracingController
	) { }

	public AddAudioSource(component: AudioSourceComponent): void
	{
		if (this.AudioSources.includes(component)) return;

		const len = this.AudioSources.push(component);
		this.AudioSourceIndexMap.set(len - 1, component);
	}

	public RemoveAudioSource(component: AudioSourceComponent): void
	{
		this.AudioSources.filter(source => source !== component);

		// rebuild AudioSourceIndexMap... this is inefficient, but it's not a big deal, hopefully
		this.AudioSourceIndexMap.clear();
		this.AudioSources.forEach((source, index) => this.AudioSourceIndexMap.set(index, source));
	}

	public GetAudioSourcesImmutableCopy(): AudioSourceComponent[]
	{
		return [...this.AudioSources];
	}

	public GetDirections(numPoints: number): Vector3[]
	{
		const golden_ratio = (1 + math.sqrt(5)) / 2;
		const angle_increment = math.pi * 2 * golden_ratio;
		const directions = table.create<Vector3>(numPoints);

		for (let i = 0; i < numPoints; ++i)
		{
			const t = i / numPoints;
			const inclination = math.acos(1 - 2 * t);
			const azimuth = angle_increment * i;

			const x = math.sin(inclination) * math.cos(azimuth);
			const y = math.sin(inclination) * math.sin(azimuth);
			const z = math.cos(inclination);

			directions.push(new Vector3(-x, -y, -z));
		}

		return directions;
	}

	public InitializeDirections(numPoints: number): void
	{
		this.Directions = this.GetDirections(numPoints);
	}

	public DebugLine(position1: Vector3, position2: Vector3, color: Color3, transparency: number = 0): void
	{
		const length = position1.sub(position2).Magnitude;

		const line = new Instance("Part", Workspace.Debug);
		line.Anchored = true;
		line.CanCollide = false;
		line.CanTouch = false;
		line.CanQuery = false;
		line.Size = new Vector3(0.05, 0.05, length);
		line.CFrame = CFrame.lookAt(position1, position2).mul(new CFrame(0, 0, -length / 2));
		line.Color = color;
		line.Transparency = transparency;
	}

	public CreateAudioEmitter(): AudioEmitterInstance
	{
		const attachment = new Instance("Attachment");

		const audio_emitter = new Instance("AudioEmitter", attachment);
		const audio_fader = new Instance("AudioFader", attachment);
		const audio_equalizer = new Instance("AudioEqualizer", attachment);

		// source -> AudioEqualizer -> AudioEcho -> AudioFader -> AudioEmitter

		const audio_equalizer_wire = new Instance("Wire", audio_equalizer);
		audio_equalizer_wire.SourceInstance = undefined;
		audio_equalizer_wire.TargetInstance = audio_equalizer;

		// const audio_echo_wire = new Instance("Wire", audio_echo);
		// audio_echo_wire.SourceInstance = audio_equalizer;
		// audio_echo_wire.TargetInstance = audio_echo;

		const audio_fader_wire = new Instance("Wire", audio_fader);
		audio_fader_wire.SourceInstance = audio_equalizer;
		audio_fader_wire.TargetInstance = audio_fader;

		const audio_emitter_wire = new Instance("Wire", audio_emitter);
		audio_emitter_wire.SourceInstance = audio_fader;
		audio_emitter_wire.TargetInstance = audio_emitter;

		// audio_echo.DelayTime = 0;
		// audio_echo.DryLevel = 0;
		// audio_echo.Feedback = 0;
		// audio_echo.WetLevel = -80;

		if (!IsAudioEmitterInstance(attachment))
		{
			throw "Failed to create AudioEmitter";
		}

		return attachment;
	}

	public onStart(): void
	{
		this.InitializeDirections(NUM_AUDIO_DIRECTIONS);

		this.Directions.forEach((direction, index) =>
		{
			const emitter = this.CreateAudioEmitter();

			emitter.CFrame = new CFrame(direction.mul(DISTANCE_FROM_CAMERA));
			emitter.Parent = this.CameraAttachmentPart;

			const direction_and_emitter: DirectionAndEmitter = {
				Direction: direction,
				Emitter: emitter
			};

			this.AudioEmitterPool.push(direction_and_emitter);

			this.IndexEmitterMap.set(index, direction_and_emitter);
			this.EmitterIndexMap.set(direction_and_emitter, index);
		});

		this.SplitAudioEmitterPool = split_arr(split_arr(this.AudioEmitterPool, RAYTRACE_COUNT_PER_WORKER), RAYTRACE_THREAD_COUNT);

		this.CameraAttachmentPart.Transparency = 1;
		this.CameraAttachmentPart.CanCollide = false;
		this.CameraAttachmentPart.CanTouch = false;
		this.CameraAttachmentPart.CanQuery = false;
		this.CameraAttachmentPart.Anchored = true;
		this.CameraAttachmentPart.Parent = this.CurrentCamera;

		this.components.onComponentAdded<AudioSourceComponent>(component => this.AddAudioSource(component));
		this.components.onComponentRemoved<AudioSourceComponent>(component => this.RemoveAudioSource(component));
		this.components.getAllComponents<AudioSourceComponent>().forEach(component => this.AddAudioSource(component));

		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() =>
		{
			this.CurrentCamera = Workspace.CurrentCamera;
			this.CameraAttachmentPart.Parent = this.CurrentCamera;
		});

		this.RaycastParams.FilterType = Enum.RaycastFilterType.Exclude;

		if (Players.LocalPlayer.Character)
		{
			this.RaycastParams.FilterDescendantsInstances = [Players.LocalPlayer.Character];
		}

		Players.LocalPlayer.CharacterAdded.Connect(character => this.RaycastParams.FilterDescendantsInstances = [character]);
	}

	public Busy = false;

	public async onRender(): Promise<void>
	{
		const camera = this.CurrentCamera;
		if (!camera) return;

		const camera_part = this.CameraAttachmentPart;
		camera_part.CFrame = new CFrame(camera.CFrame.Position);
		const camera_part_position = camera_part.Position;

		if (this.Busy)
		{
			return;
		}

		this.Busy = true;

		// print("updated");

		Workspace.Debug.ClearAllChildren();

		const sources = this.AudioSources
			.map((component, index) => [component, index] as const)
			.filter(([component]) => component.attributes.RaytracingEnabled)
			.map(([component, index]) => [component.instance.Position, index] as const);

		const all_results: AudioRaytraceResult[] = table.create(NUM_AUDIO_DIRECTIONS);

		for (const iteration of this.SplitAudioEmitterPool)
		{
			const split_jobs = iteration.map(
				(directions, index) => this.parallelRaytracingController.Raytrace(
					index,
					sources,
					this.RaycastParams,
					directions.map(direction_and_emitter =>
					({
						StartingPosition: camera_part_position,
						StartingDirection: direction_and_emitter.Direction,
						EmitterIndex: this.EmitterIndexMap.get(direction_and_emitter)!,
					}))
				)
					.then(results => results.forEach(result => all_results.push(result)))
			);

			await Promise.all(split_jobs);
		}

		for (const result of all_results)
		{
			const emitter = this.IndexEmitterMap.get(result.EmitterIndex)?.Emitter;

			if (!emitter)
			{
				throw "Emitter not found!";
			}

			if (result.SelectedAudioSourceIndex === undefined)
			{
				emitter.AudioFader.Volume = 0;
				emitter.AudioEqualizer.Wire.SourceInstance = undefined;
				// emitter.Visible = false;

				continue;
			}

			const audio_source = this.AudioSourceIndexMap.get(result.SelectedAudioSourceIndex);

			if (!audio_source)
			{
				throw "Audio source not found!";
			}

			const total_distance = result.PathPoints.reduce(
				(total, point, index) =>
				{
					if (index === 0) return total;

					return total + point.sub(result.PathPoints[index - 1]!).Magnitude;
				},
				0
			);

			const distance_factor = math.max((total_distance / 150) ** 2, 0.5);

			emitter.AudioFader.Volume = (result.DotProduct) * (0.75 ** result.TotalBounces) / (distance_factor) / (NUM_AUDIO_DIRECTIONS);

			emitter.AudioEqualizer.LowGain = -result.TotalBounces * 10;
			emitter.AudioEqualizer.MidGain = result.Occluded ? -20 : -result.TotalBounces * 5;
			emitter.AudioEqualizer.HighGain = result.Occluded ? -80 : 0;

			emitter.AudioEqualizer.Wire.SourceInstance = audio_source.instance.AudioFader;

			// emitter.Visible = true;
		}

		this.Busy = false;

		// const times = all_results.map(result => result.ElapsedTime);

		// print(
		// 	[
		// 		"-----",
		// 		`Average time: ${times.reduce((total, time) => total + time, 0) / times.size()}s`,
		// 		`Max time: ${math.max(...times)}s`,
		// 		`Min time: ${math.min(...times)}s`,
		// 		`Total time: ${times.reduce((total, time) => total + time, 0)}s`,
		// 		"-----"
		// 	]
		// 		.join("\n")
		// );
	}
}
