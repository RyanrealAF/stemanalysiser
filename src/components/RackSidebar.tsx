/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Grid,
  Activity,
  Music2,
  Gauge,
  Cpu,
} from 'lucide-react';

export type RackNavView =
  | 'matrix-view'
  | 'spectral-tensor'
  | 'midi-extraction-bus'
  | 'phase-and-latency'
  | 'diagnostic-telemetry';

interface RackSidebarProps {
  activeView: RackNavView;
  onSelectView: (view: RackNavView) => void;
  hasTrack?: boolean;
  rackThermalLoad?: number;
  bufferSize?: number;
}

export const RackSidebar: React.FC<RackSidebarProps> = ({
  activeView,
  onSelectView,
  hasTrack = false,
  rackThermalLoad = 18.4,
  bufferSize = 64,
}) => {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 gunmetal-aluminum border-r border-[#262a34] z-50 hidden lg:flex flex-col justify-between shadow-[8px_0_24px_rgba(0,0,0,0.6)] select-none">
      {/* Top Brand Banner */}
      <div className="flex flex-col">
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#282d38] bg-black/40 relative">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="StemFlow Logo"
              className="w-8 h-8 rounded object-cover border border-[#3b4252] shadow-sm shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-mono font-extrabold text-sm text-white uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                STEMFLOW
              </span>
              <span className="font-mono text-[9px] text-[#DC2626] uppercase tracking-widest font-bold flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full bg-[#DC2626] ${hasTrack ? 'animate-pulse' : 'opacity-60'}`} />
                <span>DSP HARDWARE // V4.2</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="hex-screw" title="Rack M3 Fastener" />
            <span className="hex-screw" title="Rack M3 Fastener" />
          </div>
        </div>

        {/* Bays Sub-header */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-black/40">
          <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
            DSP Rack Bays
          </div>
          <span className="font-mono text-[9px] text-zinc-400 bg-black/50 px-1.5 py-0.5 rounded border border-[#2b303c]">
            ANODIZED 4U
          </span>
        </div>

        {/* Rack Navigation Modules */}
        <nav className="flex flex-col gap-1.5 px-3 pt-2.5 font-mono text-xs">
          <button
            onClick={() => onSelectView('matrix-view')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded transition-all cursor-pointer font-bold ${
              activeView === 'matrix-view'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#b91c1c] text-white shadow-[0_2px_10px_rgba(220,38,38,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border-t border-[#fca5a5]/40 border-b border-[#7f1d1d]'
                : 'text-zinc-400 hover:bg-[#20242e] hover:text-white border border-transparent hover:border-[#353a47]'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Matrix View</span>
          </button>

          <button
            onClick={() => onSelectView('spectral-tensor')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded transition-all cursor-pointer font-bold ${
              activeView === 'spectral-tensor'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#b91c1c] text-white shadow-[0_2px_10px_rgba(220,38,38,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border-t border-[#fca5a5]/40 border-b border-[#7f1d1d]'
                : 'text-zinc-400 hover:bg-[#20242e] hover:text-white border border-transparent hover:border-[#353a47]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Spectral Tensor</span>
          </button>

          <button
            onClick={() => onSelectView('midi-extraction-bus')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded transition-all cursor-pointer font-bold ${
              activeView === 'midi-extraction-bus'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#b91c1c] text-white shadow-[0_2px_10px_rgba(220,38,38,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border-t border-[#fca5a5]/40 border-b border-[#7f1d1d]'
                : 'text-zinc-400 hover:bg-[#20242e] hover:text-white border border-transparent hover:border-[#353a47]'
            }`}
          >
            <Music2 className="w-4 h-4" />
            <span>MIDI Extraction Bus</span>
          </button>

          <button
            onClick={() => onSelectView('phase-and-latency')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded transition-all cursor-pointer font-bold ${
              activeView === 'phase-and-latency'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#b91c1c] text-white shadow-[0_2px_10px_rgba(220,38,38,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border-t border-[#fca5a5]/40 border-b border-[#7f1d1d]'
                : 'text-zinc-400 hover:bg-[#20242e] hover:text-white border border-transparent hover:border-[#353a47]'
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span>Phase & Latency</span>
          </button>

          <button
            onClick={() => onSelectView('diagnostic-telemetry')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded transition-all cursor-pointer font-bold ${
              activeView === 'diagnostic-telemetry'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#b91c1c] text-white shadow-[0_2px_10px_rgba(220,38,38,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border-t border-[#fca5a5]/40 border-b border-[#7f1d1d]'
                : 'text-zinc-400 hover:bg-[#20242e] hover:text-white border border-transparent hover:border-[#353a47]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Diagnostic Telemetry</span>
          </button>
        </nav>
      </div>

      {/* Bottom Rack Diagnostic Gauges */}
      <div className="p-4 border-t border-[#262a34] bg-black/60 flex flex-col gap-2 font-mono">
        <div className="flex items-center justify-between text-[10px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${hasTrack ? 'bg-[#10B981]' : 'bg-zinc-600'}`} />
            RACK THERMAL LOAD
          </span>
          <span className={`font-bold ${hasTrack ? 'text-[#10B981]' : 'text-zinc-600'}`}>
            {hasTrack ? `${rackThermalLoad.toFixed(1)}%` : '0.0% (IDLE)'}
          </span>
        </div>
        <div className="w-full recessed-track h-2 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-[#10B981] to-[#34d399] h-full rounded-full shadow-[0_0_6px_#10B981] transition-all duration-300"
            style={{ width: hasTrack ? `${Math.min(100, rackThermalLoad)}%` : '0%' }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${hasTrack ? 'bg-[#4CD7F6]' : 'bg-zinc-600'}`} />
            BUFFER CYCLE
          </span>
          <span className={`font-bold ${hasTrack ? 'text-[#4CD7F6]' : 'text-zinc-600'}`}>
            {hasTrack ? `${bufferSize} SAMPLES` : 'STANDBY (0)'}
          </span>
        </div>
        <div className="w-full recessed-track h-2 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-[#4CD7F6] to-[#38bdf8] h-full rounded-full shadow-[0_0_6px_#4CD7F6] transition-all duration-300"
            style={{ width: hasTrack ? '35%' : '0%' }}
          />
        </div>

        <div className="flex justify-between items-center pt-2 text-[8px] text-zinc-500">
          <span>CHASSIS: CH-RACK-01A</span>
          <span className="hex-screw" />
        </div>
      </div>
    </aside>
  );
};
