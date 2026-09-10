/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Download,
  FileArchive,
  CheckCircle2,
  FileAudio,
  FileMusic,
  ExternalLink,
  Sparkles,
  Smartphone,
  ShieldCheck,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { SongPipelineResult, StemType } from '../types';
import { downloadStemWav, downloadStemmedAudioZip, triggerBlobDownload } from '../lib/audioExport';
import { downloadMidiBlob, generateMidiFile } from '../lib/midiExport';
import { isAndroidPlatform, exportMidiToAndroid, exportWavToAndroid } from '../lib/androidBridge';

interface DownloadProcessedModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineResult: SongPipelineResult;
  stemBuffers: Record<StemType, AudioBuffer> | null;
  cachedZipBlob: { blob: Blob; filename: string } | null;
  autoDownloadTriggered: boolean;
}

export const DownloadProcessedModal: React.FC<DownloadProcessedModalProps> = ({
  isOpen,
  onClose,
  pipelineResult,
  stemBuffers,
  cachedZipBlob,
  autoDownloadTriggered,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [androidNotice, setAndroidNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const { metadata, cleanedMidiNotes } = pipelineResult;
  const titleSlug = (metadata.title || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const isAndroid = isAndroidPlatform();

  const handleDownloadFullZip = async () => {
    if (!stemBuffers) return;
    try {
      setIsZipping(true);
      if (cachedZipBlob) {
        triggerBlobDownload(cachedZipBlob.blob, cachedZipBlob.filename);
        setDownloadSuccess(`Downloaded "${cachedZipBlob.filename}"`);
        setTimeout(() => setDownloadSuccess(null), 4000);
      } else {
        const midiBytes = generateMidiFile(cleanedMidiNotes, metadata.bpm);
        const { filename, blob } = await downloadStemmedAudioZip(stemBuffers, metadata.title, [
          {
            filename: `${titleSlug}_aligned_multitrack.mid`,
            data: midiBytes,
          },
        ]);
        setDownloadSuccess(`Downloaded "${filename}"`);
        setTimeout(() => setDownloadSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to trigger ZIP download:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadMidi = () => {
    const bytes = generateMidiFile(cleanedMidiNotes, metadata.bpm);
    const filename = `${titleSlug}_aligned_multitrack.mid`;
    downloadMidiBlob(bytes, filename);
    setDownloadSuccess(`Downloaded "${filename}"`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadSingleWav = (stem: StemType) => {
    if (!stemBuffers || !stemBuffers[stem]) return;
    const filename = `${titleSlug}_${stem}.wav`;
    downloadStemWav(stemBuffers[stem], filename);
    setDownloadSuccess(`Downloaded "${filename}"`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleSaveToAndroidMediaStore = async () => {
    if (!isAndroid) return;
    try {
      setAndroidNotice('Exporting to Android device storage...');
      const midiRes = await exportMidiToAndroid(cleanedMidiNotes, metadata.bpm, metadata.title);
      if (midiRes.success) {
        setAndroidNotice(`Saved MIDI to Android Downloads (${midiRes.byteCount || 0} bytes)`);
      } else {
        setAndroidNotice(`Export notice: ${midiRes.error || 'Check permissions'}`);
      }
      setTimeout(() => setAndroidNotice(null), 5000);
    } catch (err: any) {
      setAndroidNotice(`Android storage: ${err?.message || err}`);
      setTimeout(() => setAndroidNotice(null), 5000);
    }
  };

  const stemList: { stem: StemType; label: string; color: string; bg: string; icon: string }[] = [
    { stem: 'vocals', label: 'Vocals', color: 'text-pink-400', bg: 'bg-pink-950/40 border-pink-700/50 hover:bg-pink-900/50', icon: '🎤' },
    { stem: 'drums', label: 'Drums', color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-700/50 hover:bg-amber-900/50', icon: '🥁' },
    { stem: 'bass', label: 'Bass', color: 'text-cyan-400', bg: 'bg-cyan-950/40 border-cyan-700/50 hover:bg-cyan-900/50', icon: '🎸' },
    { stem: 'guitar', label: 'Guitar', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-700/50 hover:bg-emerald-900/50', icon: '🎸' },
    { stem: 'piano', label: 'Piano', color: 'text-violet-400', bg: 'bg-violet-950/40 border-violet-700/50 hover:bg-violet-900/50', icon: '🎹' },
    { stem: 'other', label: 'Other/Synths', color: 'text-teal-400', bg: 'bg-teal-950/40 border-teal-700/50 hover:bg-teal-900/50', icon: '🎛️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#101217] border border-[#292D38] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#292D38] bg-[#07080A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
                Processing Complete — Download Ready
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                "{metadata.title}" ({metadata.duration}s · {metadata.bpm} BPM · Key of {metadata.key})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1D26] border border-transparent hover:border-[#292D38] transition"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status banner */}
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-emerald-300">
                {autoDownloadTriggered
                  ? 'Automatic browser download initiated!'
                  : 'Stems separation and multi-track MIDI transcription ready!'}
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                If your browser blocked the automatic download popup or you need to re-download, click the primary package button below.
              </p>
            </div>
          </div>

          {downloadSuccess && (
            <div className="p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-500/50 text-cyan-200 text-xs font-mono flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {androidNotice && (
            <div className="p-2.5 rounded-lg bg-indigo-950/50 border border-indigo-500/50 text-indigo-200 text-xs font-mono flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>{androidNotice}</span>
            </div>
          )}

          {/* Primary Action: Full ZIP Package */}
          <div className="bg-[#07080A] p-4 rounded-xl border border-[#292D38] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
                Full Production Stems Package
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1A1D26] border border-[#292D38] text-zinc-300">
                6 WAVs + Aligned MIDI
              </span>
            </div>

            <button
              type="button"
              onClick={handleDownloadFullZip}
              disabled={isZipping || !stemBuffers}
              className="w-full py-3.5 px-4 rounded-lg bg-[#DC2626] hover:bg-[#b91c1c] text-white font-mono font-bold text-sm tracking-wide shadow-lg shadow-red-950/50 flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-50"
            >
              <FileArchive className="w-5 h-5 text-white" />
              <span>{isZipping ? 'Generating Stems Package...' : 'DOWNLOAD COMPLETE STEMS & MIDI (.ZIP)'}</span>
            </button>

            <div className="text-[11px] text-zinc-400 space-y-1 pl-1">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Includes 6 uncompressed 16-Bit PCM WAV stems + Standard Type 1 multi-track MIDI file.</span>
              </p>
              <p className="text-zinc-500 text-[10px] font-mono">
                Drag-and-drop ready for FL Studio, Ableton Live, Logic Pro, Pro Tools, and Reaper.
              </p>
            </div>
          </div>

          {/* Quick Direct Download: Multi-Track MIDI */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#07080A] p-3.5 rounded-xl border border-[#292D38]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <FileMusic className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white font-mono">
                  {titleSlug}_aligned_multitrack.mid
                </p>
                <p className="text-[11px] text-zinc-400">
                  {cleanedMidiNotes.length} notes with micro-timing, pitch bends & velocities
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadMidi}
              className="px-4 py-2 rounded-lg bg-[#1A1D26] hover:bg-indigo-900/40 border border-[#292D38] hover:border-indigo-500/60 text-white font-mono text-xs flex items-center justify-center gap-2 transition"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download MIDI</span>
            </button>
          </div>

          {/* Individual Stems WAV Downloads */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Individual Stem WAV Downloads (16-Bit PCM)
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">One-click download</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {stemList.map((item) => (
                <button
                  key={item.stem}
                  type="button"
                  onClick={() => handleDownloadSingleWav(item.stem)}
                  disabled={!stemBuffers || !stemBuffers[item.stem]}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 ${item.bg} disabled:opacity-40`}
                  title={`Download ${item.label} Lossless WAV`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{item.icon}</span>
                      <span className={`text-xs font-bold font-mono ${item.color} truncate`}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono block">.WAV Audio</span>
                  </div>
                  <Download className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                </button>
              ))}
            </div>
          </div>

          {/* Android Native Integration Action */}
          {isAndroid && (
            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-white">Save to Android Device MediaStore</p>
                  <p className="text-[11px] text-zinc-400 font-mono">Direct export to Android /Downloads folder</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveToAndroidMediaStore}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/60 text-cyan-200 text-xs font-mono transition"
              >
                Export Native
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#292D38] bg-[#07080A] flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>Files processed locally in high-fidelity 16-bit PCM</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#1A1D26] hover:bg-[#292D38] text-white border border-[#292D38] transition"
          >
            Continue to DAW Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
