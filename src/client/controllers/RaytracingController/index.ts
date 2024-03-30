import { Components } from "@flamework/components";
import { Controller, Flamework, OnRender, OnStart } from "@flamework/core";

import { HttpService, Workspace } from "@rbxts/services";
import { AudioSourceComponent } from "client/components/AudioSourceComponent";
import * as constants from "shared/config/AudioRaytraceConfig";
import { AudioEmitterInstance, AudioRaytraceParams, AudioRaytraceResult, DirectionAndEmitter } from "client/controllers/RaytracingController/types";

import ParallelScheduler from "shared/parallel/ParallelScheduler";

const IsAudioEmitterInstance = Flamework.createGuard<AudioEmitterInstance>();

const WORKER_MODULE = script.WaitForChild("RayCalculationModule");
if (!WORKER_MODULE || !WORKER_MODULE.IsA("ModuleScript"))
{
	throw "Failed to find RayCalculationModule";
}

@Controller()
export class RaytracingController implements OnStart, OnRender
{
	public AudioSources = new Map<string, AudioSourceComponent>();
	public CurrentCamera = Workspace.CurrentCamera;

	public AudioEmitterPool: Map<string, DirectionAndEmitter> = new Map();

	public Directions = this.GetDirections(constants.NUM_AUDIO_DIRECTIONS);

	public CameraAttachmentPart = new Instance("Part");

	private scheduler = ParallelScheduler.LoadModule(WORKER_MODULE as ModuleScript)

	public constructor(
		private components: Components
	) { }

	public AddAudioSource(component: AudioSourceComponent): void
	{
		this.AudioSources.set(component.emitter_id, component);
	}

	public RemoveAudioSource(component: AudioSourceComponent): void
	{
		this.AudioSources.delete(component.emitter_id);
	}

	public GetAudioSources(): AudioSourceComponent[]
	{
		const sources: AudioSourceComponent[] = [];
		this.AudioSources.forEach(source => sources.push(source));
		return sources;
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
		this.Directions.forEach(direction =>
		{
			const emitter = this.CreateAudioEmitter();

			emitter.CFrame = new CFrame(direction.mul(5));
			emitter.Parent = this.CameraAttachmentPart;
			// emitter.Parent = Workspace.WaitForChild("Test", math.huge) as Part;

			this.AudioEmitterPool.set(HttpService.GenerateGUID(false), {
				Direction: direction,
				Emitter: emitter
			});
		});

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
	}

	public onRender(): void
	{
		if (this.scheduler.GetStatus().IsWorking) return;

		Workspace.Debug.ClearAllChildren();

		const camera = this.CurrentCamera;
		if (!camera) return;

		// const camera_part = Workspace.WaitForChild("Test", math.huge) as Part;
		const camera_part = this.CameraAttachmentPart;

		camera_part.CFrame = new CFrame(camera.CFrame.Position);

		const sources = this.GetAudioSources()
			.filter(component => component.attributes.RaytracingEnabled);

		this.AudioEmitterPool.forEach(({ Direction: direction }, index) =>
		{
			this.scheduler.ScheduleWork({
				cameraCFrame: camera_part.CFrame.mul(new CFrame(direction.mul(5))),
				direction: direction,
				emitter: index,

				audioSources: sources.map(source => ({
					emitter_id: source.emitter_id,
					position: source.instance.Position
				}))
			} satisfies AudioRaytraceParams);
		});

		const results = this.scheduler.Work() as AudioRaytraceResult[];
		results.forEach(result => 
		{
			const emitter = this.AudioEmitterPool.get(result.emitter)!.Emitter;

			if (result.audioSource) {
				const audio_source = this.AudioSources.get(result.audioSource.emitter_id)!.instance.AudioFader;

				emitter.AudioFader.Volume = result.faderVolume;

				emitter.AudioEqualizer.LowGain = result.lowGain;
				emitter.AudioEqualizer.MidGain = result.midGain;
				emitter.AudioEqualizer.HighGain = result.highGain;

				emitter.AudioEqualizer.Wire.SourceInstance = audio_source;

				emitter.Visible = true;

				return;
			}

			emitter.AudioFader.Volume = 0;
			emitter.AudioEqualizer.Wire.SourceInstance = undefined;

			emitter.Visible = false;
		})
	}
}
