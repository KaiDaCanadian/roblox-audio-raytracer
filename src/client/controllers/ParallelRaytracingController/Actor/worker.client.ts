import { AudioRaytraceParams, AudioRaytraceResult, WorkerActorInstance } from "../types";
import { DISTANCE_FROM_CAMERA, RAYTRACE_LENGTH, RAYTRACE_MAX_BOUNCE_COUNT, RAYTRACE_SNAP_ANGLE } from "shared/config/AudioRaytraceConfig";
import { Workspace } from "@rbxts/services";

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

function Raytrace(options: AudioRaytraceParams): AudioRaytraceResult
{
	const start = tick();

	const result = Workspace.Raycast(
		options.StartingCFrame.Position,
		options.StartingDirection.mul(DISTANCE_FROM_CAMERA),
		options.RaycastParams
	);

	const emitter_position = result?.Position.add(result.Normal.mul(0.1))
		?? options.StartingCFrame.mul(new CFrame(options.StartingDirection.mul(DISTANCE_FROM_CAMERA))).Position;

	// const startingPosition = options.StartingCFrame.mul(new CFrame(options.StartingDirection.mul(DISTANCE_FROM_CAMERA))).Position;
	const startingPosition = emitter_position;
	const startingDirection = options.StartingCFrame.VectorToWorldSpace(options.StartingDirection);

	const path = table.create<Vector3>(RAYTRACE_MAX_BOUNCE_COUNT + 1);

	path.push(startingPosition);

	let current_position = startingPosition;
	let current_direction = startingDirection.Unit;

	for (let i = 0; i < RAYTRACE_MAX_BOUNCE_COUNT; ++i)
	{
		const result = Workspace.Raycast(current_position, current_direction.mul(RAYTRACE_LENGTH), options.RaycastParams);
		const hit_position = result?.Position ?? current_position.add(current_direction.mul(RAYTRACE_LENGTH));

		// get audio sources, sort by distance
		const components = options.AudioSources
			.sort((a, b) => a.Position.sub(current_position).Magnitude < b.Position.sub(current_position).Magnitude);

		for (const component of components)
		{
			const component_position = component.Position;

			// If the direction is within the snap angle, then we can hear the audio source
			const direction_to_source = DirectionFromTo(current_position, component_position);

			if (current_direction.Angle(direction_to_source) < RAYTRACE_SNAP_ANGLE)
			{
				path.push(component_position);

				const is_obstructed = AreObstructionsBetween(current_position, component_position, options.RaycastParams);
				const dot_product = current_direction.Dot(direction_to_source);

				return {
					PathPoints: path,
					Emitter: options.Emitter,
					SelectedAudioSource: component,
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
				Emitter: options.Emitter,
				SelectedAudioSource: undefined,
				ElapsedTime: tick() - start,
			};
		}

		const reflection = ReflectVector3(current_direction, result.Normal).Unit;

		current_position = result.Position;
		current_direction = reflection;

		path.push(current_position);
	}

	return {
		Emitter: options.Emitter,
		SelectedAudioSource: undefined,
		ElapsedTime: tick() - start,
	};
}

// ACTOR.BindToMessageParallel("OnWorkStarted", (params: AudioRaytraceParams[]) =>
// {
// 	const results = params.map(params => Raytrace(params));

// 	ACTOR.OnWorkComplete.Fire(results);
// });

ACTOR.OnWorkStarted.Event.ConnectParallel((params: AudioRaytraceParams[]) =>
{
	const results = params.map(params => Raytrace(params));

	ACTOR.OnWorkComplete.Fire(results);
});