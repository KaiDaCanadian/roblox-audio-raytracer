import n from "shared/modules/NumberConstants";
import { AudioRaytraceParams, AudioRaytraceResult, AudioSource } from "./types";

export function EncodeAudioRaytraceParamsBuffer(audioSources: AudioSource[], params: AudioRaytraceParams[]): buffer
{
	debug.profilebegin("EncodeAudioRaytraceParamsBuffer");

	const buffer_length =
		n.u16_size_b + // audioSources.length
		(n.vector3_size_b + n.u16_size_b) * audioSources.size() + // AudioSource[]
		n.u16_size_b + // params.length
		(n.vector3_size_b * 2 + n.u16_size_b) * params.size(); // AudioRaytraceParams[]

	const buf = buffer.create(buffer_length);
	let offset = 0;

	// audioSources.length
	buffer.writeu16(buf, offset, audioSources.size());
	offset += n.u16_size_b;

	// AudioSource[]
	for (const [position, internal_index] of audioSources)
	{
		// Vector3
		buffer.writef64(buf, offset, position.X);
		offset += n.f64_size_b;
		buffer.writef64(buf, offset, position.Y);
		offset += n.f64_size_b;
		buffer.writef64(buf, offset, position.Z);
		offset += n.f64_size_b;

		// index
		buffer.writeu16(buf, offset, internal_index);
		offset += n.u16_size_b;
	}

	// params.length
	buffer.writeu16(buf, offset, params.size());
	offset += n.u16_size_b;

	for (const { StartingPosition, StartingDirection, EmitterIndex } of params)
	{
		// StartingPosition
		buffer.writef64(buf, offset, StartingPosition.X);
		offset += n.f64_size_b;
		buffer.writef64(buf, offset, StartingPosition.Y);
		offset += n.f64_size_b;
		buffer.writef64(buf, offset, StartingPosition.Z);
		offset += n.f64_size_b;

		// StartingDirection
		buffer.writef64(buf, offset, StartingDirection.X);
		offset += n.f64_size_b;
		buffer.writef64(buf, offset, StartingDirection.Y);
		offset += n.f64_size_b;
		buffer.writef64(buf, offset, StartingDirection.Z);
		offset += n.f64_size_b;

		// Emitter
		buffer.writeu16(buf, offset, EmitterIndex);
		offset += n.u16_size_b;
	}

	debug.profileend();

	return buf;
}

export function DecodeAudioRaytraceParamsBuffer(buf: buffer): LuaTuple<[AudioSource[], AudioRaytraceParams[]]>
{
	debug.profilebegin("DecodeAudioRaytraceParamsBuffer");

	let offset = 0;

	// audioSources.length
	const audio_sources_length = buffer.readu16(buf, offset);
	offset += n.u16_size_b;

	const audio_sources = table.create<AudioSource>(audio_sources_length);

	// AudioSource[]
	for (let i = 0; i < audio_sources_length; ++i)
	{
		// Vector3
		const x = buffer.readf64(buf, offset);
		offset += n.f64_size_b;
		const y = buffer.readf64(buf, offset);
		offset += n.f64_size_b;
		const z = buffer.readf64(buf, offset);
		offset += n.f64_size_b;

		// index
		const index = buffer.readu16(buf, offset);
		offset += n.u16_size_b;

		audio_sources.push([new Vector3(x, y, z), index]);
	}

	// params.length
	const audio_params_length = buffer.readu16(buf, offset);
	offset += n.u16_size_b;

	const params = table.create<AudioRaytraceParams>(audio_params_length);

	// AudioRaytraceParams[]
	for (let i = 0; i < audio_params_length; ++i)
	{
		// StartingPosition
		const x1 = buffer.readf64(buf, offset);
		offset += n.f64_size_b;
		const y1 = buffer.readf64(buf, offset);
		offset += n.f64_size_b;
		const z1 = buffer.readf64(buf, offset);
		offset += n.f64_size_b;

		// StartingDirection
		const x2 = buffer.readf64(buf, offset);
		offset += n.f64_size_b;
		const y2 = buffer.readf64(buf, offset);
		offset += n.f64_size_b;
		const z2 = buffer.readf64(buf, offset);
		offset += n.f64_size_b;

		// Emitter
		const emitter = buffer.readu16(buf, offset);
		offset += n.u16_size_b;

		params.push({
			StartingPosition: new Vector3(x1, y1, z1),
			StartingDirection: new Vector3(x2, y2, z2),
			EmitterIndex: emitter,
		});
	}

	debug.profileend();

	return $tuple(audio_sources, params);
}

export function EncodeAudioRaytraceResultBuffer(results: AudioRaytraceResult[]): buffer
{
	debug.profilebegin("EncodeAudioRaytraceResultBuffer");

	let buffer_length = n.u16_size_b; // result.length

	// AudioRaytraceResult[]
	for (const { PathPoints } of results)
	{
		buffer_length +=
			n.u8_size_b + // PathPoints.length
			n.vector3_size_b * PathPoints.size() + // PathPoints[]
			n.u8_size_b + // TotalBounces
			n.f64_size_b + // DotProduct
			n.u8_size_b + // Occluded
			n.u16_size_b + // SelectedAudioSourceIndex
			n.u16_size_b + // EmitterIndex
			n.f64_size_b; // ElapsedTime
	}

	const buf = buffer.create(buffer_length);
	let offset = 0;

	// result.length
	buffer.writeu16(buf, offset, results.size());
	offset += n.u16_size_b;

	// AudioRaytraceResult[]
	for (const result of results)
	{
		// PathPoints.length
		buffer.writeu8(buf, offset, result.PathPoints.size());
		offset += n.u8_size_b;

		// PathPoints[]
		for (const point of result.PathPoints)
		{
			// Vector3
			buffer.writef64(buf, offset, point.X);
			offset += n.f64_size_b;
			buffer.writef64(buf, offset, point.Y);
			offset += n.f64_size_b;
			buffer.writef64(buf, offset, point.Z);
			offset += n.f64_size_b;
		}

		// TotalBounces
		buffer.writeu8(buf, offset, result.TotalBounces);
		offset += n.u8_size_b;

		// DotProduct
		buffer.writef64(buf, offset, result.DotProduct);
		offset += n.f64_size_b;

		// Occluded
		buffer.writeu8(buf, offset, result.Occluded ? 1 : 0);
		offset += n.u8_size_b;

		// SelectedAudioSourceIndex
		buffer.writeu16(buf, offset, result.SelectedAudioSourceIndex ?? n.u16_max_n);
		offset += n.u16_size_b;

		// EmitterIndex
		buffer.writeu16(buf, offset, result.EmitterIndex);
		offset += n.u16_size_b;

		// ElapsedTime
		buffer.writef64(buf, offset, result.ElapsedTime);
		offset += n.f64_size_b;
	}

	debug.profileend();

	return buf;
}

export function DecodeAudioRaytraceResultBuffer(buf: buffer): AudioRaytraceResult[]
{
	debug.profilebegin("DecodeAudioRaytraceResultBuffer");

	let offset = 0;

	// result.length
	const result_length = buffer.readu16(buf, offset);
	offset += n.u16_size_b;

	const results = table.create<AudioRaytraceResult>(result_length);

	// AudioRaytraceResult[]
	for (let i = 0; i < result_length; ++i)
	{
		// PathPoints.length
		const path_length = buffer.readu8(buf, offset);
		offset += n.u8_size_b;

		const path = table.create<Vector3>(path_length);

		// PathPoints[]
		for (let j = 0; j < path_length; ++j)
		{
			// Vector3
			const x = buffer.readf64(buf, offset);
			offset += n.f64_size_b;
			const y = buffer.readf64(buf, offset);
			offset += n.f64_size_b;
			const z = buffer.readf64(buf, offset);
			offset += n.f64_size_b;

			path.push(new Vector3(x, y, z));
		}

		// TotalBounces
		const total_bounces = buffer.readu8(buf, offset);
		offset += n.u8_size_b;

		// DotProduct
		const dot_product = buffer.readf64(buf, offset);
		offset += n.f64_size_b;

		// Occluded
		const occluded = buffer.readu8(buf, offset);
		offset += n.u8_size_b;

		// SelectedAudioSourceIndex
		const selected_audio_source_index = buffer.readu16(buf, offset);
		offset += n.u16_size_b;

		// EmitterIndex
		const emitter_index = buffer.readu16(buf, offset);
		offset += n.u16_size_b;

		// ElapsedTime
		const elapsed_time = buffer.readf64(buf, offset);
		offset += n.f64_size_b;

		results.push({
			PathPoints: path,
			TotalBounces: total_bounces,
			DotProduct: dot_product,
			Occluded: occluded === 1,
			SelectedAudioSourceIndex: selected_audio_source_index !== n.u16_max_n ? selected_audio_source_index : undefined,
			EmitterIndex: emitter_index,
			ElapsedTime: elapsed_time,
		});
	}

	debug.profileend();

	return results;
}
