/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Sparkles,
  Layers,
  Cpu,
  Download,
  Music2,
  Volume2,
  VolumeX,
  Smartphone,
  Github,
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
    <header className="sticky top-0 z-40 soundboard-chassis border-b border-[#2d3342] px-4 py-2.5 sm:px-6 shadow-2xl select-none">
      {/* Soundboard Rackmount Ear Screws */}
      <div className="absolute top-2 left-2 hidden sm:block soundboard-bolt" title="Rack Mount Hex Screw" />
      <div className="absolute bottom-2 left-2 hidden sm:block soundboard-bolt" title="Rack Mount Hex Screw" />
      <div className="absolute top-2 right-2 hidden sm:block soundboard-bolt" title="Rack Mount Hex Screw" />
      <div className="absolute bottom-2 right-2 hidden sm:block soundboard-bolt" title="Rack Mount Hex Screw" />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Console Master Module Plate */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 bg-black border-2 border-[#DC2626] rounded-lg flex items-center justify-center shadow-crimson-glow">
              <svg className="w-5 h-5 text-[#DC2626]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 10h3l2-6 4 16 4-12 2 6h5" />
                <path d="M12 18v3" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-mono font-black text-base leading-tight uppercase tracking-wider">
                  StemFlow <span className="text-[#DC2626]">AI</span>
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950/80 border border-[#DC2626]/70 text-red-300 font-bold uppercase tracking-wider">
                  SERIES BWB-001
                </span>
                {isAndroid && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/70 text-emerald-400 flex items-center gap-1 font-bold uppercase">
                    <Smartphone className="w-2.5 h-2.5" />
                    Android Direct API
                  </span>
                )}
              </div>
              <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>STUDIO MASTER CONSOLE · ANALOG SUMMING & DSP</span>
              </p>
            </div>
          </div>

          {/* Quick Action buttons on mobile */}
          <div className="flex items-center gap-1.5 md:hidden">
            <a
              href="https://github.com/RyanrealAF/stemanalysiser"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded bg-[#131722] hover:bg-[#1C2333] text-zinc-300 hover:text-white border border-[#2D3548] transition relative"
              title="Official GitHub Repo: RyanrealAF/stemanalysiser (Token Authenticated)"
            >
              <Github className="w-3.5 h-3.5 text-zinc-300" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-[#131722]" />
            </a>
            <button
              onClick={onOpenAndroidPackage}
              className="px-2.5 py-1 rounded bg-[#DC2626] hover:bg-red-700 text-[10px] font-mono font-bold text-white shadow-crimson-glow transition uppercase tracking-wider flex items-center gap-1"
              title="Android API Library (.AAR) & App"
            >
              <Smartphone className="w-3 h-3 text-white" />
              Android API
            </button>
            <button
              onClick={onSelectTrackModal}
              className="px-2.5 py-1 rounded bg-[#1A1D26] text-[10px] font-mono text-zinc-300 border border-[#292D38] hover:bg-zinc-800 transition uppercase tracking-wider"
            >
              Upload
            </button>
          </div>
        </div>

        {/* Center Master Transport & Digital Readout */}
        <div className="flex items-center gap-3 sm:gap-5">
          {metadata && (
            <div className="hidden lg:flex flex-col items-end soundboard-tape px-2 py-0.5 rounded">
              <span className="text-[8px] text-zinc-800 uppercase tracking-wider font-mono font-bold">SOURCE TAPE</span>
              <span className="text-xs text-zinc-900 font-mono font-black italic truncate max-w-[170px]">
                {metadata.title}.wav
              </span>
            </div>
          )}

          {metadata && <div className="hidden lg:block h-7 w-px bg-[#2d3342]" />}

          {/* Tempo Badge styled like analog clock display */}
          {metadata && (
            <div className="hidden sm:flex flex-col items-center px-2 py-1 rounded bg-[#07080a] border border-[#232733] shadow-inner">
              <span className="text-[8px] text-zinc-500 uppercase tracking-wider font-mono">BPM CLOCK</span>
              <span className="text-sm font-bold text-cyan-400 tabular-nums font-mono">
                {metadata.bpm.toFixed(1)} <span className="text-[8px] text-zinc-500 uppercase">BPM</span>
              </span>
            </div>
          )}

          {metadata && <div className="hidden sm:block h-7 w-px bg-[#2d3342]" />}

          {/* Transport Controls styled like hardware tape deck buttons */}
          <div className="flex items-center gap-2 bg-[#08090d] px-3 py-1.5 rounded-lg border border-[#232733] shadow-inner">
            <button
              onClick={onStop}
              className="p-1.5 rounded soundboard-btn-inactive text-zinc-400 hover:text-white transition active:scale-95"
              title="Stop & Reset to 0:00"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={onTogglePlay}
              disabled={!pipelineResult}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition font-bold ${
                isPlaying
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_12px_#10b981]'
                  : 'bg-[#DC2626] text-white hover:bg-red-600 shadow-crimson-glow'
              } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95`}
              title={isPlaying ? 'Pause' : 'Play (Master Sum)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            {/* Recessed Timecode Display */}
            <div className="px-2.5 py-0.5 bg-[#050608] rounded border border-[#1a1d26] text-center min-w-[80px] shadow-inner">
              <span className="font-mono text-xs font-black text-[#DC2626] tracking-wider tabular-nums block">
                {formatTime(currentTime)}
              </span>
              <span className="text-[8px] text-zinc-500 block font-mono">
                / {formatTime(duration)}
              </span>
            </div>

            <div className="h-4 w-px bg-[#232733]" />

            {/* Synthesizer vs Audio Stems Toggle */}
            <button
              onClick={onTogglePlaySynthMidi}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition ${
                playSynthMidi
                  ? 'bg-cyan-950/60 text-[#06B6D4] border border-[#06B6D4] shadow-[0_0_8px_#06b6d4]'
                  : 'soundboard-btn-inactive text-zinc-400 hover:text-zinc-200'
              }`}
              title="Toggle MIDI Synthesizer vs Separated Stem Audio"
            >
              <Music2 className="w-3 h-3 text-[#06B6D4]" />
              <span className="hidden sm:inline">{playSynthMidi ? 'SYNTH ON' : 'STEMS ONLY'}</span>
            </button>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="hidden md:flex items-center gap-2">
          <a
            href="https://github.com/RyanrealAF/stemanalysiser"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#131722] hover:bg-[#1C2333] text-xs font-mono text-zinc-300 hover:text-white border border-[#2D3548] transition cursor-pointer"
            title="Official Git Repository: RyanrealAF/stemanalysiser (Authenticated: RyanrealAF)"
          >
            <span className="relative flex items-center">
              <Github className="w-3.5 h-3.5 text-zinc-300" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="hidden lg:inline">Git</span>
          </a>

          <button
            onClick={onOpenAndroidPackage}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#DC2626] hover:bg-red-700 text-xs font-mono font-bold uppercase tracking-wider text-white shadow-crimson-glow transition"
            title="Download Packaged Android API (.AAR), SDK & Standalone App"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Packaged Android API</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-red-200 border border-white/20">
              AAR / APK
            </span>
          </button>

          <button
            onClick={onSelectTrackModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1A1D26] text-xs font-mono uppercase tracking-wider text-zinc-300 border border-[#292D38] hover:bg-zinc-800 hover:text-white transition"
          >
            <Cpu className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Ingest Audio</span>
          </button>

          <button
            onClick={onOpenExport}
            disabled={!pipelineResult}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-gradient-to-r from-[#DC2626] to-red-900 hover:from-red-600 hover:to-red-950 text-xs font-mono uppercase tracking-wider font-bold text-white border border-red-500/40 shadow-crimson-glow transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Bundle</span>
          </button>
        </div>
      </div>
    </header>
  );
};
