import { Flamework } from "@flamework/core";
import Roact from "@rbxts/roact";
import { withHookDetection } from "@rbxts/roact-hooked";
import { Players } from "@rbxts/services";
import { App } from "./UI/components/App";

Flamework.addPaths("src/client/components");
Flamework.addPaths("src/client/controllers");
Flamework.addPaths("src/shared/components");

Flamework.ignite();

withHookDetection(Roact);

const PlayerGui = <PlayerGui> Players.LocalPlayer.WaitForChild("PlayerGui", math.huge);

Roact.mount(Roact.createElement(App), PlayerGui);
