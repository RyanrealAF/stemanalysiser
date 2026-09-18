import { Client, handle_file } from '@gradio/client';
import { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import { Midi } from '@tonejs/midi';
import JSZip from 'jszip';
export const STEMS = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'] as const;
export type StemName = typeof STEMS[number];

const STEMFLOW_SPACE = 'Ryanrealaf/Stemsplitter';
const BASIC_PITCH_MODEL_URL = 'https://raw.githubusercontent.com/spotify/basic-pitch-ts/main/model/model.json';
const MIDI_CHANNELS: Record<StemName, number> = { vocals: 0, bass: 1, drums: 9, guitar: 2, piano: 3, other: 4 };
const PITCH_RANGES: Record<StemName, [number, number]> = {
  vocals: [36, 96], bass: [28, 72], guitar: [40, 88], piano: [21, 108], other: [28, 108], drums: [0, 127],
};

type BasicPitchNote = { startTimeSeconds: number; durationSeconds: number; pitchMidi: number; amplitude: number; pitchBends?: number[] };

function pickEndpoint(apiInfo: any): string | number {
  const named = Object.keys(apiInfo?.named_endpoints || {});
  if (named.length === 1) return named[0];
  const unnamed = Object.keys(apiInfo?.unnamed_endpoints || {});
  if (unnamed.length === 1) return Number(unnamed[0]);
  const all = [...named, ...unnamed];
  if (!all.length) throw new Error('Stemsplitter exposes no callable Gradio endpoint.');
  throw new Error(`Stemsplitter exposes multiple endpoints: ${all.join(', ')}`);
}

async function resolveGradioFile(value: any): Promise<Blob> {
  if (value instanceof Blob) return value;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      const response = await fetch(value);
      if (!response.ok) throw new Error(`Could not download Stemsplitter output (HTTP ${response.status}).`);
      return response.blob();
    }
    throw new Error(`Stemsplitter returned an inaccessible local file path: ${value}`);
  }
  if (value && typeof value === 'object') {
    if (value.url) {
      const response = await fetch(value.url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Could not download Stemsplitter output (HTTP ${response.status}).`);
      return response.blob();
    }
    if (value.path && /^https?:\/\//i.test(value.path)) return resolveGradioFile(value.path);
    if (value.blob instanceof Blob) return value.blob;
  }
  throw new Error('Stemsplitter returned an unsupported file result.');
}

export async function separateWithStemsplitter(file: File, onStatus: (message: string) => void): Promise<Blob> {
  onStatus('Connecting to Ryanrealaf/Stemsplitter...');
  const app = await Client.connect(STEMFLOW_SPACE, {
    events: ['data', 'status'],
    status_callback: (status: any) => {
      if (status?.message) onStatus(`Stemsplitter: ${status.message}`);
    },
  });
  const apiInfo = await app.view_api();
  const endpoint = pickEndpoint(apiInfo);
  onStatus('Submitting audio to HTDemucs 6s...');
  const result = await app.predict(endpoint, [handle_file(file)]);
  const data = Array.isArray(result.data) ? result.data : [result.data];
  const fileCandidate = data.find((item: any) =>
    typeof item === 'string' ? /\.(zip|wav)$/i.test(item) : Boolean(item?.url || item?.path || item?.blob instanceof Blob)
  );
  if (!fileCandidate) throw new Error('Stemsplitter completed without returning a downloadable production bundle.');
  onStatus('Downloading separated stems...');
  return resolveGradioFile(fileCandidate);
}

async function extractStems(bundle: Blob): Promise<Record<StemName, Blob>> {
  const zip = await JSZip.loadAsync(bundle);
  const stems = {} as Record<StemName, Blob>;
  for (const stem of STEMS) {
    const entry = zip.file(`stems/${stem}.wav`);
    if (!entry) throw new Error(`Stemsplitter bundle is missing stems/${stem}.wav`);
    stems[stem] = new Blob([await entry.async('uint8array')], { type: 'audio/wav' });
  }
  return stems;
}

function writeMidi(stem: StemName, notes: BasicPitchNote[]): Blob {
  const midi = new Midi();
  const track = midi.addTrack();
  track.name = stem[0].toUpperCase() + stem.slice(1);
  track.channel = MIDI_CHANNELS[stem];
  for (const note of notes) {
    const duration = Math.max(0.02, note.durationSeconds);
    track.addNote({
      midi: Math.max(0, Math.min(127, Math.round(note.pitchMidi))),
      time: Math.max(0, note.startTimeSeconds),
      duration,
      velocity: Math.max(0.05, Math.min(1, note.amplitude)),
    });
    if (note.pitchBends?.length) {
      note.pitchBends.forEach((value, index) => track.addPitchBend({
        time: note.startTimeSeconds + duration * index / Math.max(1, note.pitchBends!.length - 1),
        value,
      }));
    }
  }
  return new Blob([midi.toArray()], { type: 'audio/midi' });
}

async function transcribeStem(stem: StemName, audioBlob: Blob, model: BasicPitch, onStatus: (message: string) => void) {
  onStatus(`Transcribing ${stem}...`);
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];
    await model.evaluateModel(
      audioBuffer,
      (frameChunk: number[][], onsetChunk: number[][], contourChunk: number[][]) => {
        frames.push(...frameChunk); onsets.push(...onsetChunk); contours.push(...contourChunk);
      },
      () => {},
    );
    const rawNotes = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.45, 0.30, 5))) as BasicPitchNote[];
    const [minMidi, maxMidi] = PITCH_RANGES[stem];
    let notes = rawNotes.filter(note => note.pitchMidi >= minMidi && note.pitchMidi <= maxMidi);
    if (stem === 'drums') {
      notes = notes.map(note => ({ ...note, pitchMidi: note.pitchMidi < 50 ? 36 : note.pitchMidi >= 74 ? 42 : 38, durationSeconds: Math.min(note.durationSeconds, 0.08) }));
    }
    return { midi: writeMidi(stem, notes), noteCount: notes.length };
  } finally {
    await audioContext.close().catch(() => {});
  }
}

export async function buildStemFlowBundle(separatedBundle: Blob, sourceName: string, onStatus: (message: string) => void): Promise<Blob> {
  const stems = await extractStems(separatedBundle);
  onStatus('Loading Spotify Basic Pitch model...');
  const model = new BasicPitch(BASIC_PITCH_MODEL_URL);
  const output = new JSZip();
  const midiBlobs: Partial<Record<StemName, Blob>> = {};
  const analysis: Record<string, any> = {
    engine: 'StemFlow Browser Neural Pipeline',
    separator: 'Ryanrealaf/Stemsplitter (HTDemucs 6s)',
    transcription: 'Spotify Basic Pitch TypeScript',
    input: sourceName,
    notes: {},
    limitations: [
      'Separation is performed by the hosted Stemsplitter Space.',
      'Basic Pitch runs once per separated stem in the browser.',
      'Drum MIDI is a provisional pitch-to-GM mapping and is not a drum-specific transcription model.',
      'No synthetic accuracy percentage is reported.',
    ],
  };
  for (const stem of STEMS) {
    const result = await transcribeStem(stem, stems[stem], model, onStatus);
    midiBlobs[stem] = result.midi;
    analysis.notes[stem] = result.noteCount;
    output.file(`midi/${stem}.mid`, result.midi);
    output.file(`stems/${stem}.wav`, stems[stem]);
  }
  const combined = new Midi();
  for (const stem of STEMS) {
    const blob = midiBlobs[stem]; if (!blob) continue;
    const source = new Midi(new Uint8Array(await blob.arrayBuffer()));
    const track = combined.addTrack();
    track.name = stem[0].toUpperCase() + stem.slice(1);
    track.channel = MIDI_CHANNELS[stem];
    for (const note of source.tracks[0]?.notes || []) {
      track.addNote({ midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity });
    }
  }
  output.file('midi/combined.mid', new Blob([combined.toArray()], { type: 'audio/midi' }));
  output.file('analysis.json', JSON.stringify(analysis, null, 2));
  onStatus('Building final MIDI + stem archive...');
  return output.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
