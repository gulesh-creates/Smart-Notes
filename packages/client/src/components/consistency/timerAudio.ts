/**
 * Web Audio API Synthesizer for Focus & Break Timers.
 * 100% self-contained, offline-first, zero audio file dependencies.
 */

export interface TimerToneOption {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_TIMER_TONES: TimerToneOption[] = [
  { id: 'bell', name: 'Zen Bell Chime', description: 'Gentle harmonic bell with peaceful acoustic resonance (528Hz)' },
  { id: 'gong', name: 'Meditation Gong', description: 'Deep grounding singing bowl with warm overtones (174Hz)' },
  { id: 'arpeggio', name: 'Melodic Arpeggio', description: 'Pleasant 4-note ascending crystal chime (C5-E5-G5-C6)' },
  { id: 'marimba', name: 'Soft Wooden Marimba', description: 'Warm organic acoustic wooden mallet chime' },
  { id: 'beep', name: 'Digital Alert', description: 'Crisp three-pulse modern notification tone' }
];

const STORAGE_KEY_TONE = 'smartnotes_timer_tone';
const STORAGE_KEY_VOLUME = 'smartnotes_timer_volume';

export function getSavedTimerTone(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_TONE) || 'bell';
    }
  } catch {}
  return 'bell';
}

export function saveTimerTone(toneId: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TONE, toneId);
    }
  } catch {}
}

export function getSavedTimerVolume(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (v) return Math.min(1, Math.max(0, parseFloat(v)));
    }
  } catch {}
  return 0.8;
}

export function saveTimerVolume(volume: number): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString());
    }
  } catch {}
}

let audioContextInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContextInstance || audioContextInstance.state === 'closed') {
    audioContextInstance = new AudioCtx();
  }
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume().catch(() => {});
  }
  return audioContextInstance;
}

/**
 * Plays a synthesized timer tone.
 */
export function playTimerTone(toneId?: string, overrideVolume?: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const tone = toneId || getSavedTimerTone();
  const volume = overrideVolume !== undefined ? overrideVolume : getSavedTimerVolume();
  const now = ctx.currentTime;

  switch (tone) {
    case 'gong':
      playGong(ctx, now, volume);
      break;
    case 'arpeggio':
      playArpeggio(ctx, now, volume);
      break;
    case 'marimba':
      playMarimba(ctx, now, volume);
      break;
    case 'beep':
      playDigitalBeep(ctx, now, volume);
      break;
    case 'bell':
    default:
      playZenBell(ctx, now, volume);
      break;
  }
}

function playZenBell(ctx: AudioContext, start: number, vol: number) {
  // Fundamental 528 Hz (solfeggio tone) + harmonics
  const freqs = [528, 1056, 1584];
  const weights = [0.6, 0.25, 0.15];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol * weights[idx], start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 3.3);
  });
}

function playGong(ctx: AudioContext, start: number, vol: number) {
  // Deep warm gong: 174 Hz fundamental + 348 Hz overtone
  const freqs = [174, 348, 522];
  const weights = [0.7, 0.2, 0.1];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = idx === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol * weights[idx], start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 4.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 4.6);
  });
}

function playArpeggio(ctx: AudioContext, start: number, vol: number) {
  // C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const noteDuration = 0.15;

  notes.forEach((freq, i) => {
    const noteStart = start + i * noteDuration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteStart);

    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(vol * 0.5, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 1.3);
  });
}

function playMarimba(ctx: AudioContext, start: number, vol: number) {
  // Two warm strikes: 440 Hz, then 659.25 Hz
  const strikes = [440, 659.25];
  strikes.forEach((freq, i) => {
    const strikeStart = start + i * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, strikeStart);

    gain.gain.setValueAtTime(0, strikeStart);
    gain.gain.linearRampToValueAtTime(vol * 0.6, strikeStart + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, strikeStart + 0.85);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(strikeStart);
    osc.stop(strikeStart + 0.9);
  });
}

function playDigitalBeep(ctx: AudioContext, start: number, vol: number) {
  // Three crisp pulses
  const pulses = [880, 1046.5, 1318.5];
  pulses.forEach((freq, i) => {
    const pStart = start + i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, pStart);

    gain.gain.setValueAtTime(0, pStart);
    gain.gain.linearRampToValueAtTime(vol * 0.45, pStart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, pStart + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(pStart);
    osc.stop(pStart + 0.1);
  });
}

