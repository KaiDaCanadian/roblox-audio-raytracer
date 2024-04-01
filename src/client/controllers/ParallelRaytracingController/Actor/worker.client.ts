import { AudioRaytraceParams, AudioRaytraceResult, AudioSource, WorkerActorInstance } from "../types";
import { DISTANCE_FROM_CAMERA, RAYTRACE_LENGTH, RAYTRACE_MAX_BOUNCE_COUNT, RAYTRACE_SNAP_ANGLE } from "shared/config/AudioRaytraceConfig";
import { Workspace } from "@rbxts/services";
import { DecodeAudioRaytraceParamsBuffer, EncodeAudioRaytraceResultBuffer, u16_max } from "../bufferutil";

const ACTOR = <WorkerActorInstance> script.GetActor();

const ReflectVector3 = (vector: Vector3, normal: Vector3) => vector.sub(normal.mul(2 * vector.Dot(normal)));
const DirectionFromTo = (from: Vector3, to: Vector3) => to.sub(from).Unit;

const AreObstructionsBetween = (from: Vector3, to: Vector3, raycastParams?: RaycastParams): boolean =>
{
	const result = Workspace.Raycast(from, to.sub(from), raycastParams);

	if (result && result.Instance)
	{
		return true;
	}

	return false;
};

function Raytrace(options: AudioRaytraceParams, audioSources: AudioSource[], raycastParams: RaycastParams): AudioRaytraceResult
{
	const start = tick();

	const path = table.create<Vector3>(RAYTRACE_MAX_BOUNCE_COUNT + 1);

	let current_position = options.StartingPosition.add(options.StartingDirection.mul(DISTANCE_FROM_CAMERA));
	let current_direction = options.StartingDirection.Unit;

	path.push(current_position);

	for (let i = 0; i < RAYTRACE_MAX_BOUNCE_COUNT; ++i)
	{
		const result = Workspace.Raycast(current_position, current_direction.mul(RAYTRACE_LENGTH), raycastParams);
		const hit_position = result?.Position ?? current_position.add(current_direction.mul(RAYTRACE_LENGTH));

		// get audio sources, sort by distance
		const components = [...audioSources]
			.sort((a, b) => a[0].sub(current_position).Magnitude < b[0].sub(current_position).Magnitude);

		for (const component of components)
		{
			const component_position = component[0];

			// If the direction is within the snap angle, then we can hear the audio source
			const direction_to_source = DirectionFromTo(current_position, component_position);

			if (current_direction.Angle(direction_to_source) < RAYTRACE_SNAP_ANGLE)
			{
				path.push(component_position);

				const is_obstructed = AreObstructionsBetween(current_position, component_position, raycastParams);
				const dot_product = current_direction.Dot(direction_to_source);

				return {
					PathPoints: path,
					EmitterIndex: options.EmitterIndex,
					SelectedAudioSourceIndex: component[1],
					DotProduct: dot_product,
					Occluded: is_obstructed,
					TotalBounces: i,
					ElapsedTime: tick() - start,
				};
			}
		}

		if (!result)
		{
			path.push(hit_position);

			return {
				PathPoints: path,
				EmitterIndex: options.EmitterIndex,
				SelectedAudioSourceIndex: u16_max,
				DotProduct: 0,
				Occluded: false,
				TotalBounces: i,
				ElapsedTime: tick() - start,
			};
		}

		const reflection = ReflectVector3(current_direction, result.Normal).Unit;

		current_position = result.Position;
		current_direction = reflection;

		path.push(current_position);
	}

	return {
		PathPoints: path,
		EmitterIndex: options.EmitterIndex,
		SelectedAudioSourceIndex: u16_max,
		DotProduct: 0,
		Occluded: false,
		TotalBounces: RAYTRACE_MAX_BOUNCE_COUNT,
		ElapsedTime: tick() - start,
	};
}

ACTOR.OnWorkStarted.Event.ConnectParallel((buf: buffer, raycastParams: RaycastParams) =>
{
	const [audio_sources, params] = DecodeAudioRaytraceParamsBuffer(buf);

	const results = params.map(param => Raytrace(param, audio_sources, raycastParams));
	const results_buffer = EncodeAudioRaytraceResultBuffer(results);

	ACTOR.OnWorkComplete.Fire(results_buffer);
});
