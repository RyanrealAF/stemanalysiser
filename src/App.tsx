import React, { useRef, useState } from 'react';
import { buildStemFlowBundle, separateWithStemsplitter, type SeparationProgress } from './lib/stemflowBrowserEngine';

const ACCEPTED = '.wav,.flac,.aiff,.mp3,.m4a,.ogg,.aac,.webm';
const MAX_BYTES = 100 * 1024 * 1024;

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [separationProgress, setSeparationProgress] = useState<SeparationProgress | null>(null);

  const chooseFile = (next: File | null) => {
    setError(null);
    if (!next) return;
    if (next.size === 0) {
      setError('The selected file is empty.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('This free compute path accepts audio files up to 100 MB.');
      return;
    }
    setFile(next);
    setStatus('Audio loaded. Ready to process.');
  };

  const processAudio = async () => {
    if (!file || busy) return;

    setBusy(true);
    setError(null);
    setSeparationProgress(null);

    try {
      const separatedBundle = await separateWithStemsplitter(file, (progress) => {
        setSeparationProgress(progress);
        setStatus(progress.message);
      });
      const finalBundle = await buildStemFlowBundle(
        separatedBundle,
        file.name,
        setStatus,
      );

      setStatus('Complete. Saving MIDI archive...');
      const midiUrl = URL.createObjectURL(finalBundle);
      const midiAnchor = document.createElement('a');
      midiAnchor.href = midiUrl;
      midiAnchor.download = file.name.replace(/\.[^/.]+$/, '') + '_midi.zip';
      document.body.appendChild(midiAnchor);
      midiAnchor.click();
      midiAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(midiUrl), 5000);

      setStatus('MIDI archive saved. Saving original separated stems...');
      const stemUrl = URL.createObjectURL(separatedBundle);
      const stemAnchor = document.createElement('a');
      stemAnchor.href = stemUrl;
      stemAnchor.download = file.name.replace(/\.[^/.]+$/, '') + '_stems.zip';
      document.body.appendChild(stemAnchor);
      stemAnchor.click();
      stemAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(stemUrl), 5000);

      setStatus('Complete. MIDI archive and original six-stem archive saved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus('Processing failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090a0c] text-zinc-100 flex items-center justify-center p-4">
      <section className="w-full max-w-xl">
        <header className="mb-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-2">
            Personal Audio Instrument
          </div>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight">
            StemFlow
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            HTDemucs 6s separation → Spotify Basic Pitch MIDI. No paid backend required.
          </p>
        </header>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files?.[0] ?? null);
          }}
          className="border border-zinc-800 bg-zinc-950 rounded-xl p-6"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-40 border border-dashed border-zinc-700 rounded-lg hover:border-zinc-500 transition flex flex-col items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="text-sm font-mono">Choose audio</span>
            <span className="text-xs text-zinc-500">or drop it here</span>
            <span className="text-[10px] font-mono text-zinc-600">{ACCEPTED}</span>
          </button>

          {file && (
            <div className="mt-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="text-xs font-mono text-zinc-200 truncate">{file.name}</div>
              <div className="mt-1 text-[10px] font-mono text-zinc-500">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!file || busy}
            onClick={processAudio}
            className="w-full mt-4 py-3 rounded-lg bg-zinc-100 text-black font-mono font-bold text-sm disabled:opacity-30 hover:bg-white transition"
          >
            {busy ? 'PROCESSING...' : 'SEPARATE + TRANSCRIBE'}
          </button>

          <div aria-live="polite" className="mt-4 text-xs font-mono text-zinc-400">
            {status}
          </div>

          {busy && separationProgress && (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 font-mono">
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-zinc-500">
                <span>
                  {separationProgress.phase === 'queued' ? 'Queue' : 'Separation'}
                </span>
                <span>
                  {separationProgress.elapsedSeconds ?? 0}s elapsed
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-zinc-300 transition-all duration-500"
                  style={{ width: `${separationProgress.percent ?? (separationProgress.phase === 'separating' ? 8 : 0)}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                {typeof separationProgress.percent === 'number' && (
                  <span>{separationProgress.percent}% reported</span>
                )}
                {typeof separationProgress.position === 'number' && (
                  <span>position #{separationProgress.position}</span>
                )}
                {typeof separationProgress.queueSize === 'number' && (
                  <span>{separationProgress.queueSize} queued</span>
                )}
                {typeof separationProgress.etaSeconds === 'number' && (
                  <span>ETA ~{separationProgress.etaSeconds}s</span>
                )}
              </div>

              <div className="mt-2 text-[11px] text-zinc-300">
                {separationProgress.message}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-lg border border-red-900 bg-red-950/30 text-xs font-mono text-red-300 whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        <footer className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-600">
          <span>Ryanrealaf/Stemsplitter</span>
          <span>HTDemucs 6-source</span>
          <span>Spotify Basic Pitch</span>
          <span>Browser MIDI pass</span>
          <span>No synthetic accuracy score</span>
        </footer>
      </section>
    </main>
  );
}
