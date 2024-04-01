import Roact from "@rbxts/roact";
import { useEffect, useState } from "@rbxts/roact-hooked";

import { Workspace } from "@rbxts/services";
import { AudioSourceComponentInstance } from "client/components/AudioSourceComponent/types";

const emitter = Workspace.WaitForChild("Emitter", math.huge) as AudioSourceComponentInstance;

export const RayTraceEnabled = () => {
    const [enabled, setEnabled] = useState(emitter.GetAttribute("RaytracingEnabled") as boolean);

    useEffect(() => {
        emitter.SetAttribute("RaytracingEnabled", enabled);
    }, [enabled])

    return (
        <textbutton
            AnchorPoint={new Vector2(1, 1)}
            Position={new UDim2(1, -8, 1, -8)}
            Size={new UDim2(0, 200, 0, 50)}

            Text={enabled ? "RTX On" : "RTX Off"}
            Event={{
                MouseButton1Click: () => setEnabled((prev) => !prev)
            }}
        />
    )
}