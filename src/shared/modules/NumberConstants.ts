const enum NumberConstants
{
	/* Size in bytes */
	i8_size_b = 1,
	u8_size_b = 1,
	i16_size_b = 2,
	u16_size_b = 2,
	i32_size_b = 4,
	u32_size_b = 4,
	f32_size_b = 4,
	f64_size_b = 8,

	vector2_size_b = f64_size_b * 2,
	vector3_size_b = f64_size_b * 3,
	cframe_size_b = vector3_size_b * 4,

	/* Maximum value */
	i8_max_n = 2 ** (i8_size_b * 8) / 2 - 1,
	u8_max_n = 2 ** (u8_size_b * 8) - 1,
	i16_max_n = 2 ** (i16_size_b * 8) / 2 - 1,
	u16_max_n = 2 ** (u16_size_b * 8) - 1,
	i32_max_n = 2 ** (i32_size_b * 8) / 2 - 1,
	u32_max_n = 2 ** (u32_size_b * 8) - 1,
	f32_max_n = 2 ** 127 * (2 - 2 ** -23),
	f64_max_n = 2 ** 1023 * (2 - 2 ** -52),

	/* Minimum value */
	i8_min_n = -(2 ** (i8_size_b * 8) / 2),
	u8_min_n = 0,
	i16_min_n = -(2 ** (i16_size_b * 8) / 2),
	u16_min_n = 0,
	i32_min_n = -(2 ** (i32_size_b * 8) / 2),
	u32_min_n = 0,
	f32_min_n = -(2 ** 127 * (2 - 2 ** -23)),
	f64_min_n = -(2 ** 1023 * (2 - 2 ** -52)),
}

export default NumberConstants;
