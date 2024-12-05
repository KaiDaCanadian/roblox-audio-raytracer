export function split_arr<T extends defined[]>(arr: T, chunk_size: number): T[]
{
	return arr.reduce<T[]>(
		(prev, curr, i) =>
		{
			const index = math.floor(i / chunk_size);
			const arr = prev[index] ?? <defined[]> [];
			arr.push(curr);
			prev[index] = <T> arr;
			return prev;
		},
		[]
	);
}

export function CreateWireInstance(sourceInstance?: Instance, targetInstance?: Instance, parentTo?: Instance): Wire
{
	const wire = new Instance("Wire");
	wire.SourceInstance = sourceInstance;
	wire.TargetInstance = targetInstance;
	wire.Parent = parentTo;
	return wire;
}
