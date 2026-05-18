"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Body, SimulationEffect } from "@/engine/Simulation";

type Soundscape = {
  update: (bodies: Body[]) => void;
  trigger: (effects: SimulationEffect[]) => void;
};

type AudioState = {
  context: AudioContext;
  gain: GainNode;
  oscillators: OscillatorNode[];
  filters: BiquadFilterNode[];
};

export function useSoundscape(enabled: boolean): Soundscape {
  const audioRef = useRef<AudioState | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.value = 0.035;
    gain.connect(context.destination);

    const oscillators = [0, 1, 2].map((index) => {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = 40 + index * 17;
      filter.type = "lowpass";
      filter.frequency.value = 180 + index * 70;
      oscillator.connect(filter);
      filter.connect(gain);
      oscillator.start();
      return { oscillator, filter };
    });

    audioRef.current = {
      context,
      gain,
      oscillators: oscillators.map((entry) => entry.oscillator),
      filters: oscillators.map((entry) => entry.filter)
    };

    return () => {
      audioRef.current = null;
      for (const entry of oscillators) {
        entry.oscillator.stop();
        entry.oscillator.disconnect();
        entry.filter.disconnect();
      }
      gain.disconnect();
      void context.close();
    };
  }, [enabled]);

  const update = useCallback((bodies: Body[]) => {
    const audio = audioRef.current;
    if (!audio || audio.context.state === "closed") {
      return;
    }

    if (audio.context.state === "suspended") {
      void audio.context.resume();
    }

    const largest = [...bodies].sort((a, b) => b.mass - a.mass).slice(0, 3);
    const now = audio.context.currentTime;
    audio.gain.gain.setTargetAtTime(Math.min(0.05, 0.012 + bodies.length / 8000), now, 0.2);

    audio.oscillators.forEach((oscillator, index) => {
      const body = largest[index];
      const base = body ? Math.max(22, 130 - Math.log10(body.mass + 1) * 34) : 28 + index * 11;
      const speed = body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;
      oscillator.frequency.setTargetAtTime(base + Math.sin(now * (0.4 + index * 0.2)) * (speed * 0.7), now, 0.18);
      audio.filters[index].frequency.setTargetAtTime(160 + speed * 22 + index * 80, now, 0.2);
    });
  }, []);

  const trigger = useCallback((effects: SimulationEffect[]) => {
    const audio = audioRef.current;
    if (!audio || effects.length === 0 || audio.context.state === "closed") {
      return;
    }

    if (audio.context.state === "suspended") {
      void audio.context.resume();
    }

    for (const effect of effects) {
      if (effect.kind !== "collision" && effect.kind !== "absorb" && effect.kind !== "roche") {
        continue;
      }

      const now = audio.context.currentTime;
      const boom = audio.context.createOscillator();
      const boomGain = audio.context.createGain();
      const filter = audio.context.createBiquadFilter();
      boom.type = effect.kind === "roche" ? "sawtooth" : "sine";
      boom.frequency.value = effect.kind === "absorb" ? 38 : 64;
      filter.type = "lowpass";
      filter.frequency.value = effect.kind === "roche" ? 420 : 260;
      boomGain.gain.setValueAtTime(0.0001, now);
      boomGain.gain.exponentialRampToValueAtTime(Math.min(0.18, 0.04 + effect.strength * 0.025), now + 0.02);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      boom.connect(filter);
      filter.connect(boomGain);
      boomGain.connect(audio.context.destination);
      boom.start(now);
      boom.stop(now + 0.82);
    }
  }, []);

  return { update, trigger };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
