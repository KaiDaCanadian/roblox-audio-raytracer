import { Players, Workspace } from "@rbxts/services";
import { AudioRaytraceParams, AudioRaytraceResult, AudioSourceUniqueType, RaytracePathPoint, RaytraceResult } from "client/controllers/RaytracingController/types";
import { RAYTRACE_MAX_BOUNCE_COUNT, RAYTRACE_LENGTH, RAYTRACE_SNAP_ANGLE, NUM_AUDIO_DIRECTIONS } from "shared/config/AudioRaytraceConfig";
import ParallelScheduler from "shared/parallel/ParallelScheduler";

const RAY_PARAMS = new RaycastParams();
RAY_PARAMS.FilterType = Enum.RaycastFilterType.Exclude;
if (Players.LocalPlayer.Character) {
    RAY_PARAMS.FilterDescendantsInstances = [Players.LocalPlayer.Character];
}
Players.LocalPlayer.CharacterAdded.Connect(character => RAY_PARAMS.FilterDescendantsInstances = [character]);

const ReflectVector3 = (vector: Vector3, normal: Vector3): Vector3 => vector.sub(normal.mul(2 * vector.Dot(normal)));
const DirectionFromTo = (from: Vector3, to: Vector3): Vector3 => to.sub(from).Unit

const AreObstructionsBetween = (from: Vector3, to: Vector3): boolean =>
{
    const result = Workspace.Raycast(from, to.sub(from), RAY_PARAMS);

    if (result && result.Instance)
    {
        return true;
    }

    return false;
}

const Raytrace = (options: AudioRaytraceParams): [RaytracePathPoint[], RaytraceResult | undefined ] =>
{ 
    const startingPosition = options.cameraCFrame.Position;
    const startingDirection = options.cameraCFrame.VectorToWorldSpace(options.direction)

    const path = table.create<RaytracePathPoint>(RAYTRACE_MAX_BOUNCE_COUNT + 1);

    path.push(startingPosition);

    let current_position = startingPosition;
    let current_direction = startingDirection.Unit;

    const components_mapped = ParallelScheduler.SharedTableToTable<AudioSourceUniqueType[]>(options.audioSources);

    for (let i = 0; i < RAYTRACE_MAX_BOUNCE_COUNT; ++i)
    {
        const result = Workspace.Raycast(current_position, current_direction.mul(RAYTRACE_LENGTH), RAY_PARAMS);
        const hit_position = result?.Position ?? current_position.add(current_direction.mul(RAYTRACE_LENGTH));

        // get audio sources, sort by distance
        const components = components_mapped
            .sort((a, b) => a.position.sub(current_position).Magnitude < b.position.sub(current_position).Magnitude);

        for (const component of components)
        {
            const component_position = component.position;

            // If the direction is within the snap angle, then we can hear the audio source
            const direction_to_source = DirectionFromTo(current_position, component_position);

            if (current_direction.Angle(direction_to_source) < RAYTRACE_SNAP_ANGLE)
            {
                path.push(component_position);

                return [
                    path,
                    {
                        AudioSource: component,
                        DotProduct: current_direction.Dot(direction_to_source),
                        TotalBounces: i,
                        Obstructed: AreObstructionsBetween(current_position, component_position)
                    }
                ];
            }
        }

        path.push(hit_position);

        if (!result)
        {
            return [path, undefined];
        }

        const reflection = ReflectVector3(current_direction, result.Normal).Unit;

        current_position = result.Position;
        current_direction = reflection;
    }

    return [path, undefined];
}

// const DebugLine = (position1: Vector3, position2: Vector3, color: Color3, transparency: number = 0): void =>
// {
//     task.synchronize();
//     const length = position1.sub(position2).Magnitude;

//     const line = new Instance("Part", Workspace.Debug);
//     line.Anchored = true;
//     line.CanCollide = false;
//     line.CanTouch = false;
//     line.CanQuery = false;
//     line.Size = new Vector3(0.05, 0.05, length);
//     line.CFrame = CFrame.lookAt(position1, position2).mul(new CFrame(0, 0, -length / 2));
//     line.Color = color;
//     line.Transparency = transparency;
//     task.desynchronize();
// }

export = (options: AudioRaytraceParams): AudioRaytraceResult => {
    const [points, info] = Raytrace(options);

    if (!info)
    {
        return {
            faderVolume: 0,
            emitter: options.emitter,
            audioSource: undefined
        };
    };

    const total_distance = points.reduce(
        (total, point, index) =>
        {
            if (index === 0) return total;

            return total + point.sub(points[index - 1]!).Magnitude;
        },
        0
    );

    const distance_factor = math.max((total_distance / 300) ** 2, 0.5);

    const data = {
        faderVolume: (info.DotProduct) * (0.75 ** info.TotalBounces) / distance_factor * (1 / NUM_AUDIO_DIRECTIONS),
        lowGain: -info.TotalBounces * 10,
        midGain: info.Obstructed ? -20 : -info.TotalBounces * 5,
        highGain: info.Obstructed ? -80 : 0,
        emitter: options.emitter,
        audioSource: info.AudioSource
    };

    // for (let i = 0; i < points.size() - 1; ++i)
    //     {
    //         const point1 = points[i]!;
    //         const point2 = points[i + 1]!;
    
    //         DebugLine(
    //             point1,
    //             point2,
    //             Color3.fromHSV(i / points.size(), 1, 1),
    //             0
    //         );
    //     }

    return data;
}