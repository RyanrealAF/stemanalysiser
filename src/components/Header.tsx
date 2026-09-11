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
    <header className="sticky top-0 z-40 bg-[#07080A]/95 backdrop-blur border-b border-[#292D38] px-4 py-2 sm:px-6 shadow-md select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Brand & Status */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            {/* Custom Dripping Waveform Icon from Spec */}
            <div className="w-8 h-8 bg-black border border-[#DC2626] rounded flex items-center justify-center text-[#DC2626] shadow-crimson-glow">
              <svg className="w-5 h-5 text-[#DC2626]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 10h3l2-6 4 16 4-12 2 6h5" />
                <circle cx="12" cy="18" r="1.5" fill="#DC2626" />
                <path d="M12 18v3" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono font-extrabold text-sm tracking-wider">
                  StemFlow <span className="text-[#DC2626]">AI</span>
                </span>
                {isAndroid && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] flex items-center gap-1 font-semibold">
                    <Smartphone className="w-2.5 h-2.5" />
                    Android
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                6-Stem Separation & MIDI
              </span>
            </div>
          </div>

          {/* Quick Mobile Action Buttons */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <button
              onClick={onSelectTrackModal}
              className="p-1.5 rounded bg-[#101217] text-zinc-300 border border-[#292D38]"
              title="Upload Audio"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#06B6D4]" />
            </button>
            <button
              onClick={onOpenAndroidPackage}
              className="p-1.5 rounded bg-[#990000]/60 text-red-300 border border-[#DC2626]/60"
              title="Android API Package"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Transport & Playback Controls */}
        <div className="flex items-center gap-2 sm:gap-3 bg-[#101217] px-3 py-1 rounded-lg border border-[#292D38]">
          {metadata && (
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-zinc-300 border-r border-[#292D38] pr-2.5">
              <span className="text-[#06B6D4] font-bold">{metadata.bpm.toFixed(0)} BPM</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">{metadata.key || '4/4'}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={onStop}
              className="p-1.5 rounded hover:bg-[#1A1D26] text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer"
              title="Stop & Reset"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>

            <button
              onClick={onTogglePlay}
              disabled={!pipelineResult}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition font-bold cursor-pointer ${
                isPlaying
                  ? 'bg-[#10B981] text-black hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                  : 'bg-[#DC2626] text-white hover:bg-red-700 shadow-crimson-glow'
              } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95`}
              title={isPlaying ? 'Pause' : 'Play Master'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            {/* Clean Digital Time Readout */}
            <div className="px-2 py-0.5 bg-black/60 rounded text-center min-w-[72px]">
              <span className="font-mono text-xs font-bold text-[#DC2626] tabular-nums">
                {formatTime(currentTime)}
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-[#292D38]" />

          {/* Synth vs Audio Stems Toggle */}
          <button
            onClick={onTogglePlaySynthMidi}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium transition cursor-pointer ${
              playSynthMidi
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle MIDI Synthesizer vs Separated Stem Audio"
          >
            <Music2 className="w-3 h-3 text-[#06B6D4]" />
            <span className="hidden sm:inline">{playSynthMidi ? 'Synth' : 'Stems'}</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="hidden sm:flex items-center gap-2">
          <a
            href="https://github.com/RyanrealAF/stemanalysiser"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#101217] hover:bg-[#1A1D26] text-xs font-mono text-zinc-300 hover:text-white border border-[#292D38] transition"
            title="Official GitHub Repo: RyanrealAF/stemanalysiser"
          >
            <span className="relative flex items-center">
              <Github className="w-3.5 h-3.5 text-zinc-300" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            </span>
            <span className="hidden lg:inline text-[11px]">Git</span>
          </a>

          <button
            onClick={onOpenAndroidPackage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#101217] hover:bg-[#1A1D26] text-xs font-mono text-zinc-200 hover:text-white border border-[#292D38] transition cursor-pointer"
            title="Download Packaged Android API (.AAR), SDK & Standalone App"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[11px]">Android API</span>
          </button>

          <button
            onClick={onSelectTrackModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#101217] hover:bg-[#1A1D26] text-xs font-mono text-zinc-300 hover:text-white border border-[#292D38] transition cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="text-[11px]">Audio</span>
          </button>

          <button
            onClick={onOpenExport}
            disabled={!pipelineResult}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#DC2626] hover:bg-red-700 text-xs font-mono font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-crimson-glow"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[11px]">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
