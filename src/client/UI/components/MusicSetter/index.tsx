import { useDebounceEffect } from "@rbxts/pretty-roact-hooks";
import Roact from "@rbxts/roact";
import { useState } from "@rbxts/roact-hooked";
import { Workspace } from "@rbxts/services";
import { AudioSourceComponentInstance } from "client/components/AudioSourceComponent/types";

const emitter = Workspace.WaitForChild("Emitter", math.huge) as AudioSourceComponentInstance;

const to_id = (id: string) => `rbxassetid://${id}`;
const from_id = (rbxassetid: string) => string.gsub(rbxassetid, "%D+", "")[0];

export const MusicSetter: Roact.FunctionComponent = () =>
{
	const [text, setText] = useState(from_id(emitter.GetAttribute("AssetId") as string));

	useDebounceEffect(
		() =>
		{
			emitter.SetAttribute("AssetId", to_id(text));
			emitter.AudioPlayer.Play();
		},
		[text],
		{ wait: 1 }
	);

	return (
		<textbox
			AnchorPoint={new Vector2(1, 0.5)}
			Position={new UDim2(1, -8, 0.5, 0)}
			Size={new UDim2(0, 200, 0, 50)}
			Text={text}
			Change={{
				Text: (rbx) => setText(rbx.Text)
			}}
		/>
	);
};
