/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Music2,
  Smartphone,
  Github,
  Download,
  UploadCloud,
} from 'lucide-react';
import { SongPipelineResult } from '../types';
import { isAndroidPlatform } from '../lib/androidBridge';

interface HeaderProps {
  pipelineResult: SongPipelineResult | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playSynthMidi: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onTogglePlaySynthMidi: () => void;
  onOpenExport: () => void;
  onSelectTrackModal: () => void;
  onOpenAndroidPackage?: () => void;
  dspStatus?: 'idle' | 'processing' | 'ready';
}

export const Header: React.FC<HeaderProps> = ({
  pipelineResult,
  isPlaying,
  currentTime,
  duration,
  playSynthMidi,
  onTogglePlay,
  onStop,
  onTogglePlaySynthMidi,
  onOpenExport,
  onSelectTrackModal,
  onOpenAndroidPackage,
  dspStatus = 'ready',
}) => {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(isAndroidPlatform());
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const metadata = pipelineResult?.metadata;

  return (
    <header className="bg-[#101217] border-b border-[#292D38] sticky top-0 z-40 backdrop-blur-md bg-opacity-95 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & App Title */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 bg-black border-2 border-[#DC2626] rounded flex items-center justify-center shadow-crimson-glow">
            {/* Waveform SVG Glyph */}
            <svg
              className="w-6 h-6 text-[#DC2626]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M2 10h3l2-6 4 16 4-12 2 6h5" />
              <circle cx="12" cy="18" r="1.5" fill="#DC2626" />
              <path d="M12 18v3" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-lg text-white tracking-wider">
                STEMFLOW <span className="text-[#DC2626]">AI</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 rounded">
                DSP Engine
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400">
              Real-Time Stem Separation & Signal-Driven MIDI Transcription
            </p>
          </div>
        </div>

        {/* DSP Status Chip */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-[#07080A] border border-[#292D38] rounded-md font-mono text-xs">
          <span className="text-zinc-500">DSP STATUS:</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                dspStatus === 'processing'
                  ? 'bg-[#F59E0B] animate-ping'
                  : dspStatus === 'ready'
                  ? 'bg-[#10B981] animate-pulse'
                  : 'bg-zinc-500'
              }`}
            />
            <span
              className={`font-semibold ${
                dspStatus === 'processing'
                  ? 'text-[#F59E0B]'
                  : dspStatus === 'ready'
                  ? 'text-[#10B981]'
                  : 'text-zinc-400'
              }`}
            >
              {dspStatus === 'processing'
                ? 'PROCESSING'
                : dspStatus === 'ready'
                ? 'DSP READY'
                : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Transport Readout / Controls in Header */}
        <div className="flex items-center gap-2 bg-[#07080A] px-3 py-1 rounded border border-[#292D38]">
          <button
            onClick={onStop}
            className="p-1 rounded hover:bg-[#1A1D26] text-zinc-400 hover:text-white transition cursor-pointer"
            title="Stop & Reset"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
          <button
            onClick={onTogglePlay}
            disabled={!pipelineResult}
            className={`w-7 h-7 rounded flex items-center justify-center transition font-bold cursor-pointer ${
              isPlaying
                ? 'bg-[#10B981] text-black hover:bg-emerald-400 shadow-sm'
                : 'bg-[#DC2626] text-white hover:bg-red-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isPlaying ? 'Pause' : 'Play Master'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
          <div className="px-2 py-0.5 bg-black/60 rounded text-center min-w-[68px]">
            <span className="font-mono text-xs font-bold text-[#DC2626] tabular-nums">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Quick Action CTAs from Top Nav Spec */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenAndroidPackage}
            className="px-3 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white font-mono text-xs font-bold rounded flex items-center gap-2 transition-all shadow-crimson-glow cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Android APK (4.2M)</span>
          </button>

          <button
            onClick={onSelectTrackModal}
            className="px-3 py-1.5 bg-[#1A1D26] hover:bg-[#292D38] text-zinc-200 font-mono text-xs font-medium rounded border border-[#292D38] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-[#06B6D4]" />
            <span className="hidden md:inline">Ingest Audio</span>
          </button>

          <button
            onClick={onOpenExport}
            disabled={!pipelineResult}
            className="px-3 py-1.5 bg-gradient-to-r from-[#DC2626] to-red-900 hover:from-red-600 hover:to-red-950 text-white font-mono text-xs font-bold rounded border border-red-500/50 flex items-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Stems</span>
          </button>
        </div>
      </div>
    </header>
  );
};
