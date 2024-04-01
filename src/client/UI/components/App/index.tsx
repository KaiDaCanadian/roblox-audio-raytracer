import Roact from "@rbxts/roact";
import { MusicSetter } from "../MusicSetter";
import { RayTraceEnabled } from "../RaytraceEnabled";

export const App: Roact.FunctionComponent = () =>
{
	return (
		<screengui ResetOnSpawn={false}>
			<MusicSetter />
			<RayTraceEnabled />
		</screengui>
	);
};
