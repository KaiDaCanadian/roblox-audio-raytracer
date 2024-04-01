import { AudioRaytraceParams, AudioRaytraceResult, AudioSource } from "./types";

export const f64_size = 8;
export const u16_size = 2;
export const u8_size = 1;

export const u16_max = 2 ** (u16_size * 8) - 1;

export const vector3_size = f64_size * 3;
export const audio_source_size = vector3_size + u16_size;
export const audio_params_size = vector3_size + vector3_size + u16_size;

export function EncodeAudioRaytraceParamsBuffer(audioSources: AudioSource[], params: AudioRaytraceParams[]): buffer
{
	debug.profilebegin("EncodeAudioRaytraceParamsBuffer");

	const buffer_length =
		u16_size + // audioSources.length
		audio_source_size * audioSources.size() + // AudioSource[]
		u16_size + // params.length
		audio_params_size * params.size(); // AudioRaytraceParams[]

	const buf = buffer.create(buffer_length);
	let offset = 0;

	// audioSources.length
	buffer.writeu16(buf, offset, audioSources.size());
	offset += u16_size;

	// AudioSource[]
	for (let i = 0; i < audioSources.size(); ++i)
	{
		const source = audioSources[i]!;

		// Vector3
		buffer.writef64(buf, offset, source[0].X);
		offset += f64_size;
		buffer.writef64(buf, offset, source[0].Y);
		offset += f64_size;
		buffer.writef64(buf, offset, source[0].Z);
		offset += f64_size;

		// index
		buffer.writeu16(buf, offset, source[1]);
		offset += u16_size;
	}

	// params.length
	buffer.writeu16(buf, offset, params.size());
	offset += u16_size;

	for (let i = 0; i < params.size(); ++i)
	{
		const param = params[i]!;

		// StartingPosition
		buffer.writef64(buf, offset, param.StartingPosition.X);
		offset += f64_size;
		buffer.writef64(buf, offset, param.StartingPosition.Y);
		offset += f64_size;
		buffer.writef64(buf, offset, param.StartingPosition.Z);
		offset += f64_size;

		// StartingDirection
		buffer.writef64(buf, offset, param.StartingDirection.X);
		offset += f64_size;
		buffer.writef64(buf, offset, param.StartingDirection.Y);
		offset += f64_size;
		buffer.writef64(buf, offset, param.StartingDirection.Z);
		offset += f64_size;

		// Emitter
		buffer.writeu16(buf, offset, param.EmitterIndex);
		offset += u16_size;
	}

	debug.profileend();

	return buf;
}

export function DecodeAudioRaytraceParamsBuffer(buf: buffer): LuaTuple<[AudioSource[], AudioRaytraceParams[]]>
{
	debug.profilebegin("DecodeAudioRaytraceParamsBuffer");

	let offset = 0;

	const audio_sources: AudioSource[] = [];
	const params: AudioRaytraceParams[] = [];

	// audioSources.length
	const audio_sources_length = buffer.readu16(buf, offset);
	offset += u16_size;

	// AudioSource[]
	for (let i = 0; i < audio_sources_length; ++i)
	{
		// Vector3
		const x = buffer.readf64(buf, offset);
		offset += f64_size;
		const y = buffer.readf64(buf, offset);
		offset += f64_size;
		const z = buffer.readf64(buf, offset);
		offset += f64_size;

		// index
		const index = buffer.readu16(buf, offset);
		offset += u16_size;

		audio_sources.push([new Vector3(x, y, z), index]);
	}

	// params.length
	const audio_params_length = buffer.readu16(buf, offset);
	offset += u16_size;

	// AudioRaytraceParams[]
	for (let i = 0; i < audio_params_length; ++i)
	{
		// StartingPosition
		const x1 = buffer.readf64(buf, offset);
		offset += f64_size;
		const y1 = buffer.readf64(buf, offset);
		offset += f64_size;
		const z1 = buffer.readf64(buf, offset);
		offset += f64_size;

		// StartingDirection
		const x2 = buffer.readf64(buf, offset);
		offset += f64_size;
		const y2 = buffer.readf64(buf, offset);
		offset += f64_size;
		const z2 = buffer.readf64(buf, offset);
		offset += f64_size;

		// Emitter
		const emitter = buffer.readu16(buf, offset);
		offset += u16_size;

		params.push({
			StartingPosition: new Vector3(x1, y1, z1),
			StartingDirection: new Vector3(x2, y2, z2),
			EmitterIndex: emitter,
		});
	}

	debug.profileend();

	return $tuple(audio_sources, params);
}

export function EncodeAudioRaytraceResultBuffer(result: AudioRaytraceResult[]): buffer
{
	debug.profilebegin("EncodeAudioRaytraceResultBuffer");

	let buffer_length = u16_size; // result.length

	// AudioRaytraceResult[]
	for (const res of result)
	{
		buffer_length +=
			u8_size + // PathPoints.length
			vector3_size * res.PathPoints.size() + // PathPoints[]
			u8_size + // TotalBounces
			f64_size + // DotProduct
			u8_size + // Occluded
			u16_size + // SelectedAudioSourceIndex
			u16_size + // EmitterIndex
			f64_size; // ElapsedTime
	}

	const buf = buffer.create(buffer_length);
	let offset = 0;

	// result.length
	buffer.writeu16(buf, offset, result.size());
	offset += u16_size;

	// AudioRaytraceResult[]
	for (let i = 0; i < result.size(); ++i)
	{
		const res = result[i]!;

		// PathPoints.length
		buffer.writeu8(buf, offset, res.PathPoints.size());
		offset += u8_size;

		// PathPoints[]
		for (let j = 0; j < res.PathPoints.size(); ++j)
		{
			const point = res.PathPoints[j]!;

			// Vector3
			buffer.writef64(buf, offset, point.X);
			offset += f64_size;
			buffer.writef64(buf, offset, point.Y);
			offset += f64_size;
			buffer.writef64(buf, offset, point.Z);
			offset += f64_size;
		}

		// TotalBounces
		buffer.writeu8(buf, offset, res.TotalBounces);
		offset += u8_size;

		// DotProduct
		buffer.writef64(buf, offset, res.DotProduct);
		offset += f64_size;

		// Occluded
		buffer.writeu8(buf, offset, res.Occluded ? 1 : 0);
		offset += u8_size;

		// SelectedAudioSourceIndex
		buffer.writeu16(buf, offset, res.SelectedAudioSourceIndex ?? u16_max);
		offset += u16_size;

		// EmitterIndex
		buffer.writeu16(buf, offset, res.EmitterIndex);
		offset += u16_size;

		// ElapsedTime
		buffer.writef64(buf, offset, res.ElapsedTime);
		offset += f64_size;
	}

	debug.profileend();

	return buf;
}

export function DecodeAudioRaytraceResultBuffer(buf: buffer): AudioRaytraceResult[]
{
	debug.profilebegin("DecodeAudioRaytraceResultBuffer");

	let offset = 0;

	const results: AudioRaytraceResult[] = [];

	// result.length
	const result_length = buffer.readu16(buf, offset);
	offset += u16_size;

	// AudioRaytraceResult[]
	for (let i = 0; i < result_length; ++i)
	{
		// PathPoints.length
		const path_length = buffer.readu8(buf, offset);
		offset += u8_size;

		const path: Vector3[] = [];

		// PathPoints[]
		for (let j = 0; j < path_length; ++j)
		{
			// Vector3
			const x = buffer.readf64(buf, offset);
			offset += f64_size;
			const y = buffer.readf64(buf, offset);
			offset += f64_size;
			const z = buffer.readf64(buf, offset);
			offset += f64_size;

			path.push(new Vector3(x, y, z));
		}

		// TotalBounces
		const total_bounces = buffer.readu8(buf, offset);
		offset += u8_size;

		// DotProduct
		const dot_product = buffer.readf64(buf, offset);
		offset += f64_size;

		// Occluded
		const occluded = buffer.readu8(buf, offset) === 1;
		offset += u8_size;

		// SelectedAudioSourceIndex
		const selected_audio_source_index = buffer.readu16(buf, offset);
		offset += u16_size;

		// EmitterIndex
		const emitter_index = buffer.readu16(buf, offset);
		offset += u16_size;

		// ElapsedTime
		const elapsed_time = buffer.readf64(buf, offset);
		offset += f64_size;

		results.push({
			PathPoints: path,
			TotalBounces: total_bounces,
			DotProduct: dot_product,
			Occluded: occluded,
			SelectedAudioSourceIndex: selected_audio_source_index !== u16_max ? selected_audio_source_index : undefined,
			EmitterIndex: emitter_index,
			ElapsedTime: elapsed_time,
		});
	}

	debug.profileend();

	return results;
}
