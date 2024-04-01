import Roact from "@rbxts/roact";
import { MusicSetter } from "../MusicSetter";

export const App: Roact.FunctionComponent = () =>
{
	return (
		<screengui ResetOnSpawn={false}>
			<MusicSetter />
		</screengui>
	);
};
