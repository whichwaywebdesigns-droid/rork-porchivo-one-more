import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { log } from "./logger";

type ChimeType = 'delivery' | 'pickup' | 'startup';

let audioContextInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web') return null;

  try {
    if (!audioContextInstance || audioContextInstance.state === 'closed') {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextInstance = new AudioCtx();
      }
    }
    if (audioContextInstance?.state === 'suspended') {
      audioContextInstance.resume();
    }
    return audioContextInstance;
  } catch (e) {
    log('[Sounds] Failed to create AudioContext:', e);
    return null;
  }
}

function playWebChime(type: ChimeType): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const note1Freq = type === 'delivery' ? 523.25 : 587.33;
  const note2Freq = type === 'delivery' ? 659.25 : 783.99;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.35, now);
  masterGain.connect(ctx.destination);

  [note1Freq, note2Freq].forEach((freq, i) => {
    const startTime = now + i * 0.22;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const harmonic = ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2, startTime);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(0.7, startTime + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0, startTime);
    harmonicGain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, startTime);
    filter.Q.setValueAtTime(1.2, startTime);

    osc.connect(oscGain);
    harmonic.connect(harmonicGain);
    oscGain.connect(filter);
    harmonicGain.connect(filter);
    filter.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.7);
    harmonic.start(startTime);
    harmonic.stop(startTime + 0.4);
  });

  log('[Sounds] Web chime played:', type);
}

async function playHapticPattern(type: ChimeType): Promise<void> {
  try {
    if (type === 'delivery') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_) {}
      }, 200);
    }
  } catch (e) {
    log('[Sounds] Haptic feedback failed:', e);
  }
}

export async function playNotificationChime(type: ChimeType): Promise<void> {
  log('[Sounds] Playing notification chime:', type);

  if (Platform.OS === 'web') {
    playWebChime(type);
  }

  await playHapticPattern(type);
}

function playWebStartupJingle(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.3, now);
  masterGain.connect(ctx.destination);

  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0, now);
  padGain.gain.linearRampToValueAtTime(0.18, now + 0.4);
  padGain.gain.linearRampToValueAtTime(0.12, now + 1.6);
  padGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.setValueAtTime(1200, now);
  padFilter.frequency.linearRampToValueAtTime(1800, now + 0.8);
  padFilter.frequency.linearRampToValueAtTime(900, now + 2.5);
  padFilter.Q.setValueAtTime(0.7, now);

  const padFreqs = [261.63, 329.63, 392.0];
  padFreqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 1.002, now + 1.0);
    osc.connect(padGain);
    osc.start(now);
    osc.stop(now + 2.8);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq * 0.5, now);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.06, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    sub.connect(subGain);
    subGain.connect(padGain);
    sub.start(now);
    sub.stop(now + 2.6);
  });
  padGain.connect(padFilter);
  padFilter.connect(masterGain);

  const melodyNotes = [
    { freq: 523.25, time: 0.35, dur: 0.55 },
    { freq: 659.25, time: 0.65, dur: 0.5 },
    { freq: 783.99, time: 1.0, dur: 0.7 },
  ];

  melodyNotes.forEach(({ freq, time, dur }) => {
    const startTime = now + time;

    const pluck = ctx.createOscillator();
    pluck.type = 'sine';
    pluck.frequency.setValueAtTime(freq, startTime);

    const pluckGain = ctx.createGain();
    pluckGain.gain.setValueAtTime(0, startTime);
    pluckGain.gain.linearRampToValueAtTime(0.45, startTime + 0.015);
    pluckGain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.12);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    const harmonic = ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2, startTime);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0, startTime);
    harmonicGain.gain.linearRampToValueAtTime(0.08, startTime + 0.01);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.4);

    const mFilter = ctx.createBiquadFilter();
    mFilter.type = 'lowpass';
    mFilter.frequency.setValueAtTime(3000, startTime);
    mFilter.frequency.exponentialRampToValueAtTime(800, startTime + dur);
    mFilter.Q.setValueAtTime(1.5, startTime);

    pluck.connect(pluckGain);
    harmonic.connect(harmonicGain);
    pluckGain.connect(mFilter);
    harmonicGain.connect(mFilter);
    mFilter.connect(masterGain);

    pluck.start(startTime);
    pluck.stop(startTime + dur + 0.05);
    harmonic.start(startTime);
    harmonic.stop(startTime + dur * 0.5);
  });

  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(1567.98, now + 1.5);
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0, now + 1.5);
  shimmerGain.gain.linearRampToValueAtTime(0.04, now + 1.55);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(masterGain);
  shimmer.start(now + 1.5);
  shimmer.stop(now + 2.5);

  log('[Sounds] Startup jingle played');
}

export async function playStartupJingle(): Promise<void> {
  log('[Sounds] Playing startup jingle');

  if (Platform.OS === 'web') {
    playWebStartupJingle();
  }

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    log('[Sounds] Startup haptic failed:', e);
  }
}

export async function playDeliveryChime(): Promise<void> {
  return playNotificationChime('delivery');
}

export async function playPickupChime(): Promise<void> {
  return playNotificationChime('pickup');
}
