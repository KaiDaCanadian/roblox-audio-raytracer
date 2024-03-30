import { Components } from "@flamework/components";
import { Controller, Flamework, OnRender, OnStart } from "@flamework/core";
import { Players, Workspace } from "@rbxts/services";
import { AudioSourceComponent } from "client/components/AudioSourceComponent";

type AudioEmitterInstance = Attachment & {
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

interface DirectionAndEmitter
{
	Direction: Vector3;
	Emitter: AudioEmitterInstance;
}

type RaytracePathPoint = Vector3;

interface RaytraceResult
{
	AudioSource: AudioSourceComponent;
	DotProduct: number;
	TotalBounces: number;
	Obstructed: boolean;
}

const IsAudioEmitterInstance = Flamework.createGuard<AudioEmitterInstance>();

const RAYTRACE_LENGTH = 1000;
const RAYTRACE_MAX_BOUNCE_COUNT = 3;
const NUM_DIRECTIONS = 500;
const RAYTRACE_SNAP_ANGLE = math.rad(30);

@Controller()
export class RaytracingController implements OnStart, OnRender
{
	public RaycastParams = new RaycastParams();

	public AudioSources = new Set<AudioSourceComponent>();
	public CurrentCamera = Workspace.CurrentCamera;

	public AudioEmitterPool: DirectionAndEmitter[] = [];

	public Directions = this.GetDirections(NUM_DIRECTIONS);

	public CameraAttachmentPart = new Instance("Part");

	public constructor(
		private components: Components
	) { }

	public AddAudioSource(component: AudioSourceComponent): void
	{
		this.AudioSources.add(component);
	}

	public RemoveAudioSource(component: AudioSourceComponent): void
	{
		this.AudioSources.delete(component);
	}

	public GetAudioSources(): AudioSourceComponent[]
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

	public AreObstructionsBetween(origin: Vector3, target: Vector3): boolean
	{
		const result = Workspace.Raycast(origin, target.sub(origin), this.RaycastParams);

		if (result && result.Instance)
		{
			return true;
		}

		return false;
	}

	public ReflectVector3(vector: Vector3, normal: Vector3): Vector3
	{
		return vector.sub(normal.mul(2 * vector.Dot(normal)));
	}

	public DirectionFromTo(from: Vector3, to: Vector3): Vector3
	{
		return to.sub(from).Unit;
	}

	public Raytrace(startingPosition: Vector3, startingDirection: Vector3): [RaytracePathPoint[], RaytraceResult | undefined] 
	{
		const path = table.create<RaytracePathPoint>(RAYTRACE_MAX_BOUNCE_COUNT + 1);

		path.push(startingPosition);

		let current_position = startingPosition;
		let current_direction = startingDirection.Unit;

		for (let i = 0; i < RAYTRACE_MAX_BOUNCE_COUNT; ++i)
		{
			const result = Workspace.Raycast(current_position, current_direction.mul(RAYTRACE_LENGTH), this.RaycastParams);
			const hit_position = result?.Position ?? current_position.add(current_direction.mul(RAYTRACE_LENGTH));

			// get audio sources, sort by distance
			const components = this.GetAudioSources()
				.filter(component => component.attributes.RaytracingEnabled)
				.sort((a, b) => a.instance.Position.sub(current_position).Magnitude < b.instance.Position.sub(current_position).Magnitude);

			for (const component of components)
			{
				const component_position = component.instance.Position;

				// If the direction is within the snap angle, then we can hear the audio source
				const direction_to_source = this.DirectionFromTo(current_position, component_position);

				if (current_direction.Angle(direction_to_source) < RAYTRACE_SNAP_ANGLE)
				{
					path.push(component_position);

					return [
						path,
						{
							AudioSource: component,
							DotProduct: current_direction.Dot(direction_to_source),
							TotalBounces: i,
							Obstructed: this.AreObstructionsBetween(current_position, component_position)
						}
					];
				}
			}

			path.push(hit_position);

			if (!result)
			{
				return [path, undefined];
			}

			const reflection = this.ReflectVector3(current_direction, result.Normal).Unit;

			current_position = result.Position;
			current_direction = reflection;
		}

		return [path, undefined];
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
		this.RaycastParams.FilterType = Enum.RaycastFilterType.Exclude;

		if (Players.LocalPlayer.Character)
		{
			this.RaycastParams.FilterDescendantsInstances = [Players.LocalPlayer.Character];
		}

		this.Directions.forEach(direction =>
		{
			const emitter = this.CreateAudioEmitter();

			emitter.CFrame = new CFrame(direction.mul(5));
			emitter.Parent = this.CameraAttachmentPart;
			// emitter.Parent = Workspace.WaitForChild("Test", math.huge) as Part;

			this.AudioEmitterPool.push({
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

		Players.LocalPlayer.CharacterAdded.Connect(character => this.RaycastParams.FilterDescendantsInstances = [character]);
	}

	public onRender(): void
	{
		Workspace.Debug.ClearAllChildren();

		const camera = this.CurrentCamera;
		if (!camera) return;

		// const camera_part = Workspace.WaitForChild("Test", math.huge) as Part;
		const camera_part = this.CameraAttachmentPart;

		camera_part.CFrame = new CFrame(camera.CFrame.Position);

		for (const { Direction: direction, Emitter: emitter } of this.AudioEmitterPool)
		{
			const [points, info] = this.Raytrace(camera_part.CFrame.Position, camera_part.CFrame.VectorToWorldSpace(direction));

			if (!info)
			{
				emitter.AudioFader.Volume = 0;
				emitter.AudioEqualizer.Wire.SourceInstance = undefined;
				// emitter.Visible = false;
				continue;
			};

			// for (let i = 0; i < points.size() - 1; ++i)
			// {
			// 	const point1 = points[i]!;
			// 	const point2 = points[i + 1]!;

			// 	this.DebugLine(
			// 		point1,
			// 		point2,
			// 		Color3.fromHSV(i / points.size(), 1, 1),
			// 		0
			// 	);
			// }

			const total_distance = points.reduce(
				(total, point, index) =>
				{
					if (index === 0) return total;

					return total + point.sub(points[index - 1]!).Magnitude;
				},
				0
			);

			const distance_factor = math.max((total_distance / 300) ** 2, 0.5);

			emitter.AudioFader.Volume = (info.DotProduct) * (0.75 ** info.TotalBounces) / distance_factor * (1 / NUM_DIRECTIONS);
			// emitter.AudioEcho.DelayTime = total_distance / 4000;
			emitter.AudioEqualizer.LowGain = -info.TotalBounces * 10;
			emitter.AudioEqualizer.MidGain = info.Obstructed ? -20 : 0;
			emitter.AudioEqualizer.HighGain = info.Obstructed ? -80 : -info.TotalBounces * 10;
			emitter.AudioEqualizer.Wire.SourceInstance = info.AudioSource.instance.AudioFader;
			// emitter.Visible = true;
		}
	}
}
