import { BaseComponent, Component } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { HttpService } from "@rbxts/services";
import { Tags } from "client/types";

interface AudioSourceComponentAttributes
{
	AssetId: string;
	RaytracingEnabled: boolean;
}

type AudioSourceComponentInstance = BasePart & {
	AudioEmitter: AudioEmitter;
	AudioEqualizer: AudioEqualizer & {
		Wire: Wire;
	};
	AudioFader: AudioFader & {
		Wire: Wire;
	};
	AudioPlayer: AudioPlayer & {
		Wire: Wire;
	};
};

@Component({ tag: Tags.AudioSourceComponent })
export class AudioSourceComponent extends BaseComponent<AudioSourceComponentAttributes, AudioSourceComponentInstance> implements OnStart
{
	public readonly emitter_id: string = HttpService.GenerateGUID(false);

	public SetAssetId(newAssetId: string): void
	{
		this.instance.AudioPlayer.AssetId = newAssetId;
	}

	public SetRaytracingEnabled(enabled: boolean): void
	{
		this.instance.AudioFader.Wire.TargetInstance = enabled ? undefined : this.instance.AudioEmitter;
	}

	public onStart(): void
	{
		this.SetAssetId(this.attributes.AssetId);
		this.SetRaytracingEnabled(this.attributes.RaytracingEnabled);

		this.onAttributeChanged("AssetId", (newAssetId) => this.SetAssetId(newAssetId));
		this.onAttributeChanged("RaytracingEnabled", (enabled) => this.SetRaytracingEnabled(enabled));

		this.instance.AudioPlayer.Play();
	}
}
