import * as Tone from "tone";

export const STEP_COUNT = 16;
export const LOOP_LENGTH_OPTIONS = [1, 2, 4, 8] as const;

export const DRUM_CHANNELS = ["kick", "snare", "hihat"] as const;
export type DrumChannel = (typeof DRUM_CHANNELS)[number];

export type StepPattern = Record<DrumChannel, boolean[]>;

export type AutomationTarget = "snarePitch" | "noiseFilterCutoff" | "decayTime";
export type AutomationCurve = "linear" | "exponential";

export interface AutomationSettings {
  enabled: boolean;
  target: AutomationTarget;
  curve: AutomationCurve;
  startValue: number;
  endValue: number;
}

export interface RenderConfig {
  pattern: StepPattern;
  bpm: number;
  loopBars: (typeof LOOP_LENGTH_OPTIONS)[number];
  automation: AutomationSettings;
}

interface PlaybackParameters {
  snarePitch: number;
  noiseFilterCutoff: number;
  decayTime: number;
}

interface SynthRack {
  kickOsc: Tone.Oscillator;
  kickGain: Tone.Gain;
  snareNoise: Tone.Noise;
  snareNoiseFilter: Tone.Filter;
  snareNoiseGain: Tone.Gain;
  snareToneOsc: Tone.Oscillator;
  snareToneGain: Tone.Gain;
  hatNoise: Tone.Noise;
  hatFilter: Tone.Filter;
  hatGain: Tone.Gain;
  masterGain: Tone.Gain;
  dispose: () => void;
}

const DEFAULT_PARAMETERS: PlaybackParameters = {
  snarePitch: 220,
  noiseFilterCutoff: 4500,
  decayTime: 0.14,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createEmptyPattern(): StepPattern {
  return {
    kick: Array.from({ length: STEP_COUNT }, () => false),
    snare: Array.from({ length: STEP_COUNT }, () => false),
    hihat: Array.from({ length: STEP_COUNT }, () => false),
  };
}

function clonePattern(pattern: StepPattern): StepPattern {
  return {
    kick: [...pattern.kick],
    snare: [...pattern.snare],
    hihat: [...pattern.hihat],
  };
}

function createSynthRack(): SynthRack {
  const masterGain = new Tone.Gain(0.78).toDestination();

  const kickGain = new Tone.Gain(0).connect(masterGain);
  const kickOsc = new Tone.Oscillator({ type: "sine", frequency: 160 }).connect(kickGain);
  kickOsc.start();

  const snareNoise = new Tone.Noise("white");
  const snareNoiseFilter = new Tone.Filter({ type: "bandpass", frequency: 4200, Q: 0.7 });
  const snareNoiseGain = new Tone.Gain(0);
  snareNoise.connect(snareNoiseFilter);
  snareNoiseFilter.connect(snareNoiseGain);
  snareNoiseGain.connect(masterGain);
  snareNoise.start();

  const snareToneOsc = new Tone.Oscillator({ type: "sine", frequency: 220 });
  const snareToneGain = new Tone.Gain(0);
  snareToneOsc.connect(snareToneGain);
  snareToneGain.connect(masterGain);
  snareToneOsc.start();

  const hatNoise = new Tone.Noise("white");
  const hatFilter = new Tone.Filter({ type: "bandpass", frequency: 9000, Q: 6 });
  const hatGain = new Tone.Gain(0);
  hatNoise.connect(hatFilter);
  hatFilter.connect(hatGain);
  hatGain.connect(masterGain);
  hatNoise.start();

  return {
    kickOsc,
    kickGain,
    snareNoise,
    snareNoiseFilter,
    snareNoiseGain,
    snareToneOsc,
    snareToneGain,
    hatNoise,
    hatFilter,
    hatGain,
    masterGain,
    dispose: () => {
      kickOsc.dispose();
      kickGain.dispose();
      snareNoise.dispose();
      snareNoiseFilter.dispose();
      snareNoiseGain.dispose();
      snareToneOsc.dispose();
      snareToneGain.dispose();
      hatNoise.dispose();
      hatFilter.dispose();
      hatGain.dispose();
      masterGain.dispose();
    },
  };
}

function getAutomationValue(settings: AutomationSettings, progress: number) {
  const clampedProgress = clamp(progress, 0, 1);

  if (!settings.enabled) {
    return settings.startValue;
  }

  if (settings.curve === "linear" || settings.startValue <= 0 || settings.endValue <= 0) {
    return settings.startValue + (settings.endValue - settings.startValue) * clampedProgress;
  }

  return settings.startValue * Math.pow(settings.endValue / settings.startValue, clampedProgress);
}

function derivePlaybackParameters(settings: AutomationSettings, progress: number): PlaybackParameters {
  const value = getAutomationValue(settings, progress);

  if (!settings.enabled) {
    return { ...DEFAULT_PARAMETERS };
  }

  switch (settings.target) {
    case "snarePitch":
      return { ...DEFAULT_PARAMETERS, snarePitch: clamp(value, 100, 900) };
    case "noiseFilterCutoff":
      return { ...DEFAULT_PARAMETERS, noiseFilterCutoff: clamp(value, 1000, 14000) };
    case "decayTime":
      return { ...DEFAULT_PARAMETERS, decayTime: clamp(value, 0.06, 0.6) };
    default:
      return { ...DEFAULT_PARAMETERS };
  }
}

function triggerKick(rack: SynthRack, time: number) {
  rack.kickOsc.frequency.cancelScheduledValues(time);
  rack.kickOsc.frequency.setValueAtTime(180, time);
  rack.kickOsc.frequency.exponentialRampToValueAtTime(42, time + 0.19);

  rack.kickGain.gain.cancelScheduledValues(time);
  rack.kickGain.gain.setValueAtTime(1, time);
  rack.kickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
}

function triggerSnare(rack: SynthRack, time: number, params: PlaybackParameters) {
  rack.snareNoiseFilter.frequency.setValueAtTime(params.noiseFilterCutoff, time);
  rack.snareNoiseGain.gain.cancelScheduledValues(time);
  rack.snareNoiseGain.gain.setValueAtTime(0.95, time);
  rack.snareNoiseGain.gain.linearRampToValueAtTime(0.0001, time + params.decayTime);

  rack.snareToneOsc.frequency.cancelScheduledValues(time);
  rack.snareToneOsc.frequency.setValueAtTime(params.snarePitch, time);
  rack.snareToneOsc.frequency.exponentialRampToValueAtTime(
    Math.max(110, params.snarePitch * 0.7),
    time + 0.08,
  );

  rack.snareToneGain.gain.cancelScheduledValues(time);
  rack.snareToneGain.gain.setValueAtTime(0.55, time);
  rack.snareToneGain.gain.exponentialRampToValueAtTime(
    0.0001,
    time + Math.max(0.05, params.decayTime * 0.82),
  );
}

function triggerHiHat(rack: SynthRack, time: number, params: PlaybackParameters) {
  const hatFilterFrequency = clamp(params.noiseFilterCutoff * 1.55, 4800, 15000);

  rack.hatFilter.frequency.setValueAtTime(hatFilterFrequency, time);
  rack.hatGain.gain.cancelScheduledValues(time);
  rack.hatGain.gain.setValueAtTime(0.48, time);
  rack.hatGain.gain.exponentialRampToValueAtTime(
    0.0001,
    time + Math.max(0.02, params.decayTime * 0.32),
  );
}

function scheduleStep(
  rack: SynthRack,
  pattern: StepPattern,
  absoluteStep: number,
  loopBars: number,
  automation: AutomationSettings,
  stepTime: number,
) {
  const patternStep = absoluteStep % STEP_COUNT;
  const totalSteps = loopBars * STEP_COUNT;
  const progress = totalSteps <= 1 ? 0 : (absoluteStep % totalSteps) / (totalSteps - 1);
  const params = derivePlaybackParameters(automation, progress);

  if (pattern.kick[patternStep]) {
    triggerKick(rack, stepTime);
  }

  if (pattern.snare[patternStep]) {
    triggerSnare(rack, stepTime, params);
  }

  if (pattern.hihat[patternStep]) {
    triggerHiHat(rack, stepTime, params);
  }
}

export class RealtimeSequencerEngine {
  private pattern: StepPattern;
  private loopBars: number;
  private automation: AutomationSettings;
  private sequence: Tone.Sequence<number>;
  private rack: SynthRack;
  private stepCounter = 0;
  private onStepUpdate?: (step: number) => void;

  constructor(pattern: StepPattern, bpm: number, loopBars: number, automation: AutomationSettings) {
    this.pattern = clonePattern(pattern);
    this.loopBars = loopBars;
    this.automation = { ...automation };
    this.rack = createSynthRack();

    this.sequence = new Tone.Sequence(
      (time, step) => {
        scheduleStep(this.rack, this.pattern, this.stepCounter, this.loopBars, this.automation, time);
        this.stepCounter = (this.stepCounter + 1) % (this.loopBars * STEP_COUNT);

        Tone.Draw.schedule(() => {
          this.onStepUpdate?.(step);
        }, time);
      },
      Array.from({ length: STEP_COUNT }, (_, index) => index),
      "16n",
    ).start(0);

    Tone.Transport.loop = true;
    this.setLoopBars(loopBars);
    this.setBpm(bpm);
  }

  async start(onStepUpdate?: (step: number) => void) {
    await Tone.start();
    this.onStepUpdate = onStepUpdate;
    this.stepCounter = 0;
    Tone.Transport.position = 0;
    Tone.Transport.start("+0.02");
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  }

  setPattern(pattern: StepPattern) {
    this.pattern = clonePattern(pattern);
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.rampTo(bpm, 0.05);
  }

  setLoopBars(loopBars: number) {
    this.loopBars = loopBars;
    Tone.Transport.loop = true;
    Tone.Transport.loopEnd = `${loopBars}m`;
    this.stepCounter = 0;
  }

  setAutomation(automation: AutomationSettings) {
    this.automation = { ...automation };
  }

  dispose() {
    this.stop();
    this.sequence.dispose();
    this.rack.dispose();
  }
}

function encodeAudioBufferTo24BitWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 24;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = audioBuffer.length;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numberOfChannels }, (_, channel) =>
    audioBuffer.getChannelData(channel),
  );

  let offset = 44;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = clamp(channels[channel][sampleIndex], -1, 1);
      const integer = sample < 0 ? Math.round(sample * 0x800000) : Math.round(sample * 0x7fffff);
      const value = integer < 0 ? integer + 0x1000000 : integer;

      view.setUint8(offset, value & 0xff);
      view.setUint8(offset + 1, (value >> 8) & 0xff);
      view.setUint8(offset + 2, (value >> 16) & 0xff);
      offset += 3;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function renderSequenceToWav({
  pattern,
  bpm,
  loopBars,
  automation,
}: RenderConfig): Promise<Blob> {
  const totalSteps = loopBars * STEP_COUNT;
  const sixteenthDuration = 60 / bpm / 4;
  const duration = totalSteps * sixteenthDuration;

  const rendered = await Tone.Offline(
    () => {
      const rack = createSynthRack();

      for (let step = 0; step < totalSteps; step += 1) {
        const stepTime = step * sixteenthDuration;
        scheduleStep(rack, pattern, step, loopBars, automation, stepTime);
      }

      const finalReleaseTime = duration + 0.05;
      rack.kickGain.gain.setValueAtTime(0.0001, finalReleaseTime);
      rack.snareNoiseGain.gain.setValueAtTime(0.0001, finalReleaseTime);
      rack.snareToneGain.gain.setValueAtTime(0.0001, finalReleaseTime);
      rack.hatGain.gain.setValueAtTime(0.0001, finalReleaseTime);
    },
    duration + 0.12,
    2,
    44100,
  );

  const audioBuffer = rendered.get();

  if (!audioBuffer) {
    throw new Error("Offline rendering completed without an audio buffer.");
  }

  return encodeAudioBufferTo24BitWav(audioBuffer);
}

export function triggerWavDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
