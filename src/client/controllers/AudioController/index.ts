import { Controller, Flamework, OnStart } from "@flamework/core";
import { Workspace } from "@rbxts/services";
import Signal from "@rbxts/signal";

type DeviceOutputInstance = AudioListener & {
	AudioDeviceOutput: AudioDeviceOutput & {
		Wire: Wire;
	};
};

const IsDeviceOutputInstance = Flamework.createGuard<DeviceOutputInstance>();

@Controller()
export class AudioController implements OnStart
{
	public CurrentCamera = Workspace.CurrentCamera;

	public DeviceOutput: DeviceOutputInstance | undefined = undefined;
	public DeviceOutputChanged = new Signal<(newOutput: DeviceOutputInstance) => void>();

	public CreateDeviceOutput(parent: Instance): DeviceOutputInstance
	{
		if (this.DeviceOutput)
		{
			this.DeviceOutput.Destroy();
			this.DeviceOutput = undefined;
		}

		const audio_listener = new Instance("AudioListener");
		const audio_device_output = new Instance("AudioDeviceOutput", audio_listener);
		const wire = new Instance("Wire", audio_device_output);

		wire.SourceInstance = audio_listener;
		wire.TargetInstance = audio_device_output;
		audio_listener.Parent = parent;

		if (!IsDeviceOutputInstance(audio_listener))
		{
			throw "Failed to create DeviceOutput";
		}

		this.DeviceOutputChanged.Fire(audio_listener);

		return audio_listener;
	}

	public onStart(): void
	{
		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() =>
		{
			this.CurrentCamera = Workspace.CurrentCamera;

			if (this.CurrentCamera)
			{
				this.DeviceOutput = this.CreateDeviceOutput(this.CurrentCamera);
			}
		});

		if (this.CurrentCamera)
		{
			this.DeviceOutput = this.CreateDeviceOutput(this.CurrentCamera);
		}
	}
}
