/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RackFooterProps {
  currentTime: number;
  isPlaying: boolean;
}

export const RackFooter: React.FC<RackFooterProps> = ({ currentTime, isPlaying }) => {
  // Format real-time SMPTE timecode based on current audio time
  const formatSmpte = (timeSec: number) => {
    const baseHrs = 1;
    const baseMins = 14 + Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    const frames = Math.floor((timeSec % 1) * 30);
    return `${String(baseHrs).padStart(2, '0')}:${String(baseMins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  return (
    <footer className="fixed bottom-0 left-0 lg:left-64 right-0 h-10 brushed-metal-panel z-40 px-4 sm:px-6 flex items-center justify-between font-mono text-[11px] text-zinc-400 border-t border-[#2a2f3b] select-none">
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-full bg-[#DC2626] shadow-[0_0_8px_#DC2626] border border-white/20 ${
              isPlaying ? 'animate-ping' : ''
            }`}
          />
          <span className="text-white font-bold tracking-wider text-[11px]">REC BUS ARMED</span>
        </div>
        <span className="text-[#353b49] font-bold hidden sm:inline">//</span>
        <span className="text-zinc-300 hidden md:inline shrink-0">DSP THREADS: 16/16 SYNCED</span>
        <span className="text-[#353b49] font-bold hidden md:inline">//</span>
        <span className="text-[#10B981] hidden sm:inline shrink-0">LATENCY JITTER: ±0.04ms</span>
        <span className="text-[#353b49] font-bold hidden lg:inline">//</span>
        <span className="text-[#4CD7F6] hidden lg:inline shrink-0">
          NEURAL SEPARATION MATRIX: CONVERGED
        </span>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs text-white shrink-0">
        <span className="text-[#DC2626] text-[10px] font-bold">SMPTE</span>
        <span className="drop-shadow-[0_0_6px_rgba(255,255,255,0.4)] tabular-nums font-extrabold text-sm tracking-widest text-[#DC2626]">
          {formatSmpte(currentTime)}
        </span>
        <span className="hex-screw hidden sm:inline-block ml-2" />
      </div>
    </footer>
  );
};
