import { Controller, Flamework, OnStart } from "@flamework/core";
import { Workspace } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { CreateWireInstance } from "shared/util";

type DeviceOutputInstance = AudioListener & {
	AudioDeviceOutput: AudioDeviceOutput & {
		Wire: Wire;
	};
};

@Controller()
export class DiegeticAudioController implements OnStart
{
	public static BASE_DEVICE_OUTPUT: DeviceOutputInstance;

	static {
		/* Create a base DeviceOutputInstance to clone from */
		
		const IsDeviceOutputInstance = Flamework.createGuard<DeviceOutputInstance>();

		const audio_listener = new Instance("AudioListener");
		const audio_device_output = new Instance("AudioDeviceOutput", audio_listener);
		CreateWireInstance(audio_listener, audio_device_output, audio_device_output);

		assert(IsDeviceOutputInstance(audio_listener), "Failed to validate DeviceOutputInstance; check your code");

		this.BASE_DEVICE_OUTPUT = audio_listener;
	}

	public CurrentCamera = Workspace.CurrentCamera;

	public DeviceOutput: DeviceOutputInstance | undefined = undefined;
	public DeviceOutputChanged = new Signal<(newOutput: DeviceOutputInstance) => void>();

	public HandleCurrentCameraChanged(): void
	{
		this.CurrentCamera = Workspace.CurrentCamera;

		if (this.CurrentCamera)
		{
			this.DeviceOutput?.Destroy();
			this.DeviceOutput = DiegeticAudioController.BASE_DEVICE_OUTPUT.Clone();
			this.DeviceOutput.Parent = this.CurrentCamera;
			this.DeviceOutputChanged.Fire(this.DeviceOutput);
		}
	}

	public onStart(): void
	{
		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() => this.HandleCurrentCameraChanged());
		this.HandleCurrentCameraChanged();
	}
}
