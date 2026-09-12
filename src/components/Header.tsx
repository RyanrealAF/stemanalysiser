/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  UploadCloud,
  Smartphone,
  Download,
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
  onTogglePlay,
  onStop,
  onOpenExport,
  onSelectTrackModal,
  onOpenAndroidPackage,
  dspStatus = 'ready',
}) => {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(isAndroidPlatform());
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const bpm = pipelineResult?.metadata.bpm ? pipelineResult.metadata.bpm.toFixed(0) : '124';
  const key = pipelineResult?.metadata.key ? `${pipelineResult.metadata.key.toUpperCase()} MINOR` : 'C# MINOR';

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 brushed-metal-panel z-40 px-4 sm:px-6 flex items-center justify-between border-b border-[#282d38] select-none">
      {/* Left Title & Status Readout */}
      <div className="flex items-center gap-3">
        <span className="hex-screw hidden sm:inline-block" title="Corner Torx" />
        <div className="flex flex-col">
          <h1 className="font-mono text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>STEMFLOW DSP // TELEMETRY SOUNDBOARD</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#14161b] text-zinc-400 border border-[#2e3340] rounded font-mono font-bold">
              REV 4.2
            </span>
          </h1>
          <div className="flex items-center gap-2 font-mono text-[9px] sm:text-[10px] mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]" />
            <span className="text-[#10B981] tracking-wide font-medium">
              ENGINE: LIVE NEURAL DECOMPOSITION @ 96kHz, 32-BIT FLOAT
            </span>
            <span className="text-zinc-500 hidden md:inline">|</span>
            <span className="text-[#DC2626] font-mono tracking-wider font-bold hidden md:inline">
              SMPTE LOCK ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls & Telemetry HUD */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Telemetry pill box */}
        <div className="hidden xl:flex items-center gap-2 bg-[#0b0c10] px-3 py-1.5 rounded border border-[#2c303c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex flex-col text-right">
            <span className="font-mono text-[9px] text-zinc-400">MASTER TEMPO</span>
            <span className="font-mono text-xs font-bold text-[#4CD7F6] drop-shadow-[0_0_6px_rgba(76,215,246,0.5)]">
              {bpm} BPM
            </span>
          </div>
          <div className="h-6 w-px bg-[#262a34] mx-1" />
          <div className="flex flex-col text-right">
            <span className="font-mono text-[9px] text-zinc-400">TONAL ROOT</span>
            <span className="font-mono text-xs font-bold text-[#EC4899] drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]">
              {key}
            </span>
          </div>
          <div className="h-6 w-px bg-[#262a34] mx-1" />
          <div className="flex flex-col text-right">
            <span className="font-mono text-[9px] text-zinc-400">BUS SDR</span>
            <span className="font-mono text-xs font-bold text-[#DC2626] drop-shadow-[0_0_6px_rgba(220,38,38,0.5)]">
              14.2 dB
            </span>
          </div>
        </div>

        {/* Transport Mini Player */}
        <div className="flex items-center gap-1.5 bg-[#0b0c10] px-2 py-1 rounded border border-[#2c303c]">
          <button
            onClick={onStop}
            className="p-1 rounded hover:bg-[#1A1D26] text-zinc-400 hover:text-white transition cursor-pointer"
            title="Stop & Reset"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
          <button
            onClick={onTogglePlay}
            disabled={!pipelineResult}
            className={`w-6 h-6 rounded flex items-center justify-center transition font-bold cursor-pointer ${
              isPlaying
                ? 'bg-[#10B981] text-black hover:bg-emerald-400 shadow-sm'
                : 'bg-[#DC2626] text-white hover:bg-red-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isPlaying ? 'Pause' : 'Play Master'}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current ml-0.5" />
            )}
          </button>
          <span className="font-mono text-[11px] font-bold text-[#DC2626] px-1 tabular-nums">
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Ingest / Audio Upload CTA */}
        <button
          onClick={onSelectTrackModal}
          className="px-2.5 py-1.5 bg-[#14161b] hover:bg-[#20242e] text-zinc-300 font-mono text-[11px] font-medium rounded border border-[#2e3340] flex items-center gap-1.5 transition cursor-pointer"
          title="Upload or record audio"
        >
          <UploadCloud className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span className="hidden sm:inline">Ingest Audio</span>
        </button>

        {/* Android Package CTA */}
        {onOpenAndroidPackage && (
          <button
            onClick={onOpenAndroidPackage}
            className="hidden md:flex px-2.5 py-1.5 bg-[#14161b] hover:bg-[#20242e] text-zinc-300 font-mono text-[11px] font-medium rounded border border-[#2e3340] items-center gap-1.5 transition cursor-pointer"
            title="Android APK & Hardware DSP Package"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Android API</span>
          </button>
        )}

        {/* Operator Profile / Chassis Lock */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#2e323e]">
          <div className="flex flex-col text-right hidden sm:flex">
            <span className="font-mono text-[10px] font-bold text-white">OP_CHASSIS_01</span>
            <span className="font-mono text-[9px] text-[#10B981] font-bold">AUTHORIZED</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#3a3f4e] to-[#121418] p-0.5 shadow-md flex items-center justify-center border border-[#262a34]">
            <div className="w-full h-full rounded-full bg-[#181a20] flex items-center justify-center text-[10px] font-mono font-bold text-zinc-300">
              01
            </div>
          </div>
          <span className="hex-screw" title="Chassis Lock" />
        </div>
      </div>
    </header>
  );
};
