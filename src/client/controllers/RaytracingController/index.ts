import { Components } from "@flamework/components";
import { Controller, Flamework, OnRender, OnStart } from "@flamework/core";
import { Players, Workspace } from "@rbxts/services";
import { DiegeticAudioEmitter } from "client/components/DiegeticAudioEmitter";
import { DISTANCE_FROM_CAMERA, NUM_AUDIO_DIRECTIONS, RAYTRACE_COUNT_PER_WORKER, RAYTRACE_MAX_BOUNCE_COUNT, RAYTRACE_THREAD_COUNT } from "shared/config/AudioRaytraceConfig";
import { CreateWireInstance, split_arr } from "shared/util";
import { ParallelRaytracingController } from "../ParallelRaytracingController";
import { AudioRaytraceResult } from "../ParallelRaytracingController/types";
import { AudioEmitterInstance, DirectionAndEmitter } from "./types";

@Controller()
export class RaytracingController implements OnStart, OnRender
{
	public static BASE_AUDIO_EMITTER: AudioEmitterInstance;

	static {
		/* Create a base AudioEmitterInstance to clone from */
		
		const IsAudioEmitterInstance = Flamework.createGuard<AudioEmitterInstance>();

		const attachment = new Instance("Attachment");
		const audio_emitter = new Instance("AudioEmitter", attachment);
		const audio_fader = new Instance("AudioFader", attachment);
		const audio_equalizer = new Instance("AudioEqualizer", attachment);
		const audio_echo = new Instance("AudioEcho", attachment);
		const debug_sphere = new Instance("SphereHandleAdornment", attachment);
		debug_sphere.Name = "Debug";
		debug_sphere.Radius = 0.1;
		debug_sphere.Transparency = 0.75;

		/* source -> AudioEqualizer -> AudioEcho -> AudioFader -> AudioEmitter */

		// source -> AudioEqualizer
		CreateWireInstance(undefined, audio_equalizer, audio_equalizer);
		// AudioEqualizer -> AudioEcho
		CreateWireInstance(audio_equalizer, audio_echo, audio_echo);
		// AudioEcho -> AudioFader
		CreateWireInstance(audio_echo, audio_fader, audio_fader);
		// AudioFader -> AudioEmitter
		CreateWireInstance(audio_fader, audio_emitter, audio_emitter);

		audio_echo.DryLevel = -80;
		audio_echo.WetLevel = 0;
		audio_echo.Feedback = 0;
		audio_echo.DelayTime = 0;
		// TODO: Get rid of this hack once the typedefs are updated
		(audio_echo as AudioEcho & { RampTime: number; }).RampTime = 0.1;

		assert(IsAudioEmitterInstance(attachment), "Failed to validate AudioEmitterInstance; check your code");

		this.BASE_AUDIO_EMITTER = attachment;
	}

	public AudioSources: DiegeticAudioEmitter[] = [];
	public CurrentCamera = Workspace.CurrentCamera;

	public Directions: Vector3[] = [];

	public IndexEmitterMap = new Map<number, DirectionAndEmitter>();
	public EmitterIndexMap = new Map<DirectionAndEmitter, number>();

	public AudioSourceIndexMap = new Map<number, DiegeticAudioEmitter>();

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

	public AddAudioSource(component: DiegeticAudioEmitter): void
	{
		if (this.AudioSources.includes(component)) return;

		const len = this.AudioSources.push(component);
		this.AudioSourceIndexMap.set(len - 1, component);
	}

	public RemoveAudioSource(component: DiegeticAudioEmitter): void
	{
		this.AudioSources.filter(source => source !== component);

		// rebuild AudioSourceIndexMap... this is inefficient, but it's not a big deal, hopefully
		this.AudioSourceIndexMap.clear();
		this.AudioSources.forEach((source, index) => this.AudioSourceIndexMap.set(index, source));
	}

	public GetAudioSourcesMutableCopy(): DiegeticAudioEmitter[]
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
		return RaytracingController.BASE_AUDIO_EMITTER.Clone();
	}

	public onStart(): void
	{
		this.InitializeDirections(NUM_AUDIO_DIRECTIONS);

		this.Directions.forEach((direction, index) =>
		{
			const emitter = this.CreateAudioEmitter();

			emitter.CFrame = new CFrame(direction.mul(DISTANCE_FROM_CAMERA));
			emitter.Parent = this.CameraAttachmentPart;
			emitter.Debug.Adornee = this.CameraAttachmentPart;
			emitter.Debug.CFrame = emitter.CFrame;

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

		this.components.onComponentAdded<DiegeticAudioEmitter>(component => this.AddAudioSource(component));
		this.components.onComponentRemoved<DiegeticAudioEmitter>(component => this.RemoveAudioSource(component));
		this.components.getAllComponents<DiegeticAudioEmitter>().forEach(component => this.AddAudioSource(component));

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

			assert(emitter, "Emitter not found!");

			if (result.SelectedAudioSourceIndex === undefined)
			{
				emitter.AudioFader.Volume = 0;
				emitter.AudioEqualizer.Wire.SourceInstance = undefined;
				emitter.Debug.Visible = false;

				continue;
			}

			const audio_source = this.AudioSourceIndexMap.get(result.SelectedAudioSourceIndex);

			assert(audio_source, "Audio source not found!");

			const total_distance = result.PathPoints.reduce(
				(total, point, index) =>
				{
					if (index === 0) return total;

					return total + point.sub(result.PathPoints[index - 1]!).Magnitude;
				},
				0
			);

			emitter.AudioEcho.DelayTime = total_distance / 2000;

			const distance_factor = math.max((total_distance / 150) ** 2, 0.5);

			emitter.AudioFader.Volume = (result.DotProduct) * (0.75 ** result.TotalBounces) / (distance_factor) / (NUM_AUDIO_DIRECTIONS);

			emitter.AudioEqualizer.LowGain = -result.TotalBounces * 10;
			emitter.AudioEqualizer.MidGain = result.Occluded ? -20 : -result.TotalBounces * 5;
			emitter.AudioEqualizer.HighGain = result.Occluded ? -80 : 0;

			emitter.AudioEqualizer.Wire.SourceInstance = audio_source.instance.AudioFader;

			emitter.Debug.Color3 = Color3.fromHSV(result.TotalBounces / RAYTRACE_MAX_BOUNCE_COUNT, 1, 1);
			emitter.Debug.Radius = emitter.AudioFader.Volume * 100 * (result.Occluded ? 0.25 : 1);
			emitter.Debug.Visible = true;
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
