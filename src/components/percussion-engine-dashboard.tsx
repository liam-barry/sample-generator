"use client";

import { Pause, Play, RotateCcw, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  AutomationSettings,
  createEmptyPattern,
  LOOP_LENGTH_OPTIONS,
  RealtimeSequencerEngine,
  renderSequenceToWav,
  STEP_COUNT,
  triggerWavDownload,
  type AutomationTarget,
  type StepPattern,
} from "@/lib/audio/percussion-engine";
import { cn } from "@/lib/utils";

const CHANNELS: Array<{
  key: keyof StepPattern;
  label: string;
  tint: string;
}> = [
  { key: "kick", label: "Kick", tint: "bg-cyan-400" },
  { key: "snare", label: "Snare", tint: "bg-fuchsia-400" },
  { key: "hihat", label: "Hi-Hat", tint: "bg-amber-300" },
];

const AUTOMATION_TARGETS: Record<
  AutomationTarget,
  { label: string; min: number; max: number; step: number; start: number; end: number; unit: string }
> = {
  snarePitch: { label: "Snare Pitch", min: 100, max: 900, step: 5, start: 220, end: 520, unit: "Hz" },
  noiseFilterCutoff: {
    label: "Noise Filter Cutoff",
    min: 1000,
    max: 14000,
    step: 50,
    start: 3400,
    end: 10200,
    unit: "Hz",
  },
  decayTime: { label: "Decay Time", min: 0.06, max: 0.6, step: 0.01, start: 0.12, end: 0.42, unit: "s" },
};

function formatValue(value: number, unit: string) {
  if (unit === "s") {
    return `${value.toFixed(2)}${unit}`;
  }

  return `${Math.round(value)}${unit}`;
}

export function PercussionEngineDashboard() {
  const [pattern, setPattern] = useState<StepPattern>(() => {
    const seeded = createEmptyPattern();
    seeded.kick[0] = true;
    seeded.kick[4] = true;
    seeded.kick[8] = true;
    seeded.kick[12] = true;
    seeded.snare[4] = true;
    seeded.snare[12] = true;
    seeded.hihat[2] = true;
    seeded.hihat[6] = true;
    seeded.hihat[10] = true;
    seeded.hihat[14] = true;
    return seeded;
  });
  const [bpm, setBpm] = useState(128);
  const [loopBars, setLoopBars] = useState<(typeof LOOP_LENGTH_OPTIONS)[number]>(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isExporting, setIsExporting] = useState(false);

  const [automation, setAutomation] = useState<AutomationSettings>({
    enabled: true,
    target: "snarePitch",
    curve: "linear",
    startValue: AUTOMATION_TARGETS.snarePitch.start,
    endValue: AUTOMATION_TARGETS.snarePitch.end,
  });

  const sequencerRef = useRef<RealtimeSequencerEngine | null>(null);
  const targetConfig = useMemo(() => AUTOMATION_TARGETS[automation.target], [automation.target]);

  useEffect(() => {
    const engine = new RealtimeSequencerEngine(pattern, bpm, loopBars, automation);
    sequencerRef.current = engine;

    return () => {
      sequencerRef.current?.dispose();
      sequencerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sequencerRef.current?.setPattern(pattern);
  }, [pattern]);

  useEffect(() => {
    sequencerRef.current?.setBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    sequencerRef.current?.setLoopBars(loopBars);
  }, [loopBars]);

  useEffect(() => {
    sequencerRef.current?.setAutomation(automation);
  }, [automation]);

  async function handlePlayToggle() {
    if (!sequencerRef.current) {
      return;
    }

    if (isPlaying) {
      sequencerRef.current.stop();
      setCurrentStep(-1);
      setIsPlaying(false);
      return;
    }

    await sequencerRef.current.start((step) => {
      setCurrentStep(step);
    });
    setIsPlaying(true);
  }

  function toggleStep(channel: keyof StepPattern, step: number) {
    setPattern((previous) => {
      const next = {
        kick: [...previous.kick],
        snare: [...previous.snare],
        hihat: [...previous.hihat],
      };
      next[channel][step] = !next[channel][step];
      return next;
    });
  }

  function clearPattern() {
    setPattern(createEmptyPattern());
  }

  function updateAutomationTarget(nextTarget: AutomationTarget) {
    const defaults = AUTOMATION_TARGETS[nextTarget];
    setAutomation((previous) => ({
      ...previous,
      target: nextTarget,
      startValue: defaults.start,
      endValue: defaults.end,
    }));
  }

  async function handleExport() {
    try {
      setIsExporting(true);
      const wavBlob = await renderSequenceToWav({
        pattern,
        bpm,
        loopBars,
        automation,
      });
      triggerWavDownload(wavBlob, `percussion-engine-${bpm}bpm-${loopBars}bars.wav`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Procedural Audio Sequencer</p>
            <h1 className="text-3xl font-semibold tracking-tight">Percussion Engine</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Pure synthesis-only percussion generation with deterministic sequencing and offline WAV export.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={clearPattern}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button variant={isPlaying ? "default" : "primary"} onClick={handlePlayToggle}>
              {isPlaying ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Play
                </>
              )}
            </Button>
            <Button variant="primary" onClick={handleExport} disabled={isExporting}>
              <WandSparkles className="mr-2 h-4 w-4" />
              {isExporting ? "Rendering..." : "Export to WAV"}
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>16-Step Grid Sequencer</CardTitle>
              <CardDescription>
                Trigger Kick, Snare, and Hi-Hat channels on a shared timeline. The highlighted column is the live playhead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {CHANNELS.map((channel) => (
                  <div className="grid grid-cols-[72px_1fr] items-center gap-3" key={channel.key}>
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      {channel.label}
                    </span>
                    <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-2">
                      {Array.from({ length: STEP_COUNT }, (_, stepIndex) => {
                        const active = pattern[channel.key][stepIndex];
                        const isCurrent = currentStep === stepIndex && isPlaying;
                        return (
                          <button
                            aria-label={`${channel.label} step ${stepIndex + 1}`}
                            className={cn(
                              "h-10 rounded-md border transition",
                              active
                                ? `${channel.tint} border-transparent text-zinc-950`
                                : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800",
                              isCurrent && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-zinc-950",
                            )}
                            key={`${channel.key}-${stepIndex}`}
                            onClick={() => toggleStep(channel.key, stepIndex)}
                            type="button"
                          >
                            <span className="text-[10px] font-semibold">{stepIndex + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Synthesis Engines</CardTitle>
                <CardDescription>Procedural drums generated entirely from oscillators and white-noise shaping.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-zinc-300">
                <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                  <p className="font-semibold text-cyan-300">Kick Drum</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Continuous sine oscillator with exponential frequency drop and rapid amplitude decay envelope.
                  </p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                  <p className="font-semibold text-fuchsia-300">Snare / Noise</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Bandpass-filtered white noise burst layered with a short metallic sine tone in the mid-range.
                  </p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                  <p className="font-semibold text-amber-300">Hi-Hat / Metallic</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    High-frequency white-noise source through a tight bandpass filter with ultra-short decay.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Master Transport</CardTitle>
                <CardDescription>Set the tempo and overall loop duration in bars.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Tempo</span>
                    <span className="text-sm font-semibold text-cyan-300">{bpm} BPM</span>
                  </div>
                  <Slider
                    max={180}
                    min={60}
                    onValueChange={(value) => setBpm(value[0] ?? bpm)}
                    step={1}
                    value={[bpm]}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm text-zinc-300" htmlFor="loopBars">
                    Loop Length
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    id="loopBars"
                    onChange={(event) => setLoopBars(Number(event.target.value) as (typeof LOOP_LENGTH_OPTIONS)[number])}
                    value={loopBars}
                  >
                    {LOOP_LENGTH_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} {option === 1 ? "bar" : "bars"}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Build-Up Automation Curves</CardTitle>
                <CardDescription>Apply per-loop ramps across snare pitch, filter cutoff, or decay.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center justify-between text-sm text-zinc-300">
                  Automation Enabled
                  <input
                    checked={automation.enabled}
                    className="h-4 w-4 accent-cyan-400"
                    onChange={(event) =>
                      setAutomation((previous) => ({ ...previous, enabled: event.target.checked }))
                    }
                    type="checkbox"
                  />
                </label>

                <div className="grid gap-3">
                  <label className="text-xs uppercase tracking-wide text-zinc-500" htmlFor="automationTarget">
                    Target
                  </label>
                  <select
                    className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    id="automationTarget"
                    onChange={(event) => updateAutomationTarget(event.target.value as AutomationTarget)}
                    value={automation.target}
                  >
                    {Object.entries(AUTOMATION_TARGETS).map(([target, config]) => (
                      <option key={target} value={target}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3">
                  <label className="text-xs uppercase tracking-wide text-zinc-500" htmlFor="automationCurve">
                    Curve Shape
                  </label>
                  <select
                    className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    id="automationCurve"
                    onChange={(event) =>
                      setAutomation((previous) => ({
                        ...previous,
                        curve: event.target.value as AutomationSettings["curve"],
                      }))
                    }
                    value={automation.curve}
                  >
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">Start Value</span>
                    <span className="font-semibold text-cyan-300">
                      {formatValue(automation.startValue, targetConfig.unit)}
                    </span>
                  </div>
                  <Slider
                    max={targetConfig.max}
                    min={targetConfig.min}
                    onValueChange={(value) =>
                      setAutomation((previous) => ({
                        ...previous,
                        startValue: value[0] ?? previous.startValue,
                      }))
                    }
                    step={targetConfig.step}
                    value={[automation.startValue]}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">End Value</span>
                    <span className="font-semibold text-cyan-300">
                      {formatValue(automation.endValue, targetConfig.unit)}
                    </span>
                  </div>
                  <Slider
                    max={targetConfig.max}
                    min={targetConfig.min}
                    onValueChange={(value) =>
                      setAutomation((previous) => ({
                        ...previous,
                        endValue: value[0] ?? previous.endValue,
                      }))
                    }
                    step={targetConfig.step}
                    value={[automation.endValue]}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
