import React, { useEffect, useRef, useState } from 'react';

const ACCEPTED = '.wav,.flac,.aiff,.mp3,.m4a,.ogg,.aac,.webm';
const INFERENCE_BASE = (import.meta.env.VITE_INFERENCE_URL || '').replace(/\/+$/, '');
const apiUrl = (path: string) => `${INFERENCE_BASE}${path}`;

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState('StemFlow Neural Engine');

  useEffect(() => {
    fetch(apiUrl('/api/models-info'))
      .then((response) => response.ok ? response.json() : null)
      .then((info) => {
        if (info?.engine) setEngine(info.engine);
      })
      .catch(() => {});
  }, []);

  const chooseFile = (next: File | null) => {
    setError(null);
    if (!next) return;
    if (next.size === 0) {
      setError('The selected file is empty.');
      return;
    }
    if (next.size > 100 * 1024 * 1024) {
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
    setStatus('Uploading source audio to the neural engine...');

    try {
      const response = await fetch(apiUrl('/api/process-audio'), {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
        },
        body: file,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.details || payload.error || `Processing failed (HTTP ${response.status}).`);
      }

      setStatus('Neural separation and MIDI transcription complete. Preparing archive...');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${file.name.replace(/\.[^/.]+$/, '')}_stemflow.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus('Complete. ZIP contains six WAV stems, six MIDI files, combined MIDI, and analysis.json.');
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
            Real neural stem separation followed by instrument-specific MIDI transcription.
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

          {error && (
            <div className="mt-3 p-3 rounded-lg border border-red-900 bg-red-950/30 text-xs font-mono text-red-300 whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        <footer className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-600">
          <span>{engine}</span>
          <span>HTDemucs 6-source</span>
          <span>Basic Pitch AMT</span>
          <span>No synthetic accuracy score</span>
        </footer>
      </section>
    </main>
  );
}
