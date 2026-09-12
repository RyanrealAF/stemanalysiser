/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RackFooterProps {
  currentTime: number;
  isPlaying: boolean;
  hasTrack?: boolean;
}

export const RackFooter: React.FC<RackFooterProps> = ({ currentTime, isPlaying, hasTrack = false }) => {
  // Format real-time SMPTE timecode strictly from current audio time (no fake offsets)
  const formatSmpte = (timeSec: number) => {
    if (!hasTrack || timeSec <= 0) return '00:00:00:00';
    const hrs = Math.floor(timeSec / 3600);
    const mins = Math.floor((timeSec % 3600) / 60);
    const secs = Math.floor(timeSec % 60);
    const frames = Math.floor((timeSec % 1) * 30);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  return (
    <footer className="fixed bottom-0 left-0 lg:left-64 right-0 h-10 brushed-metal-panel z-40 px-4 sm:px-6 flex items-center justify-between font-mono text-[11px] text-zinc-400 border-t border-[#2a2f3b] select-none">
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
        {hasTrack ? (
          <>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isPlaying ? 'bg-[#10B981] shadow-[0_0_8px_#10B981] animate-ping' : 'bg-[#06B6D4]'
                } border border-white/20`}
              />
              <span className="text-white font-bold tracking-wider text-[11px]">
                {isPlaying ? 'AUDIO STREAM ACTIVE' : 'DSP BUS ARMED'}
              </span>
            </div>
            <span className="text-[#353b49] font-bold hidden sm:inline">//</span>
            <span className="text-zinc-300 hidden md:inline shrink-0">
              {isPlaying ? 'DSP THREADS: ACTIVE' : 'TRACK LOADED'}
            </span>
            <span className="text-[#353b49] font-bold hidden md:inline">//</span>
            <span className="text-[#10B981] hidden sm:inline shrink-0">BIT DEPTH: 32-BIT FLOAT</span>
            <span className="text-[#353b49] font-bold hidden lg:inline">//</span>
            <span className="text-[#4CD7F6] hidden lg:inline shrink-0">
              STEM SEPARATION MATRIX
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-700" />
              <span className="text-zinc-500 font-bold tracking-wider text-[11px]">STANDBY</span>
            </div>
            <span className="text-[#252933] font-bold hidden sm:inline">//</span>
            <span className="text-zinc-500 hidden md:inline shrink-0">NO TRACK INGESTED</span>
            <span className="text-[#252933] font-bold hidden md:inline">//</span>
            <span className="text-zinc-500 hidden sm:inline shrink-0">DSP ENGINE DORMANT</span>
            <span className="text-[#252933] font-bold hidden lg:inline">//</span>
            <span className="text-zinc-500 hidden lg:inline shrink-0">
              AWAITING AUDIO INPUT
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 font-mono text-xs text-white shrink-0">
        <span className="text-[#DC2626] text-[10px] font-bold">SMPTE</span>
        <span className={`drop-shadow-[0_0_6px_rgba(255,255,255,0.4)] tabular-nums font-extrabold text-sm tracking-widest ${hasTrack ? 'text-[#DC2626]' : 'text-zinc-600'}`}>
          {formatSmpte(currentTime)}
        </span>
        <span className="hex-screw hidden sm:inline-block ml-2" />
      </div>
    </footer>
  );
};
