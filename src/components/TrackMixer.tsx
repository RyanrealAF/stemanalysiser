/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Volume2,
  VolumeX,
  Mic,
  Disc,
  Sliders,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Download,
} from 'lucide-react';
import { SongPipelineResult, StemType } from '../types';

interface TrackMixerProps {
  pipelineResult: SongPipelineResult | null;
  volume: Record<StemType | 'master', number>;
  isMuted: Record<StemType | 'master', boolean>;
  isSoloed: Record<StemType, boolean>;
  pan: Record<StemType, number>;
  selectedStem: StemType | 'all';
  onVolumeChange: (stem: StemType | 'master', val: number) => void;
  onPanChange: (stem: StemType, val: number) => void;
  onToggleMute: (stem: StemType | 'master') => void;
  onToggleSolo: (stem: StemType) => void;
  onSelectStemFilter: (stem: StemType | 'all') => void;
  onExportStemMidi?: (stem: StemType) => void;
  onExportAllMidi?: () => void;
}

export const TrackMixer: React.FC<TrackMixerProps> = ({
  pipelineResult,
  volume,
  isMuted,
  isSoloed,
  pan,
  selectedStem,
  onVolumeChange,
  onPanChange,
  onToggleMute,
  onToggleSolo,
  onSelectStemFilter,
  onExportStemMidi,
  onExportAllMidi,
}) => {
  const stems: { type: StemType; label: string; channelId: string; icon: string; color: string; accentColor: string; bgGlow: string }[] = [
    { type: 'vocals', label: 'Vocals', channelId: 'CH 01', icon: '🎤', color: 'text-pink-400 border-pink-700/50 bg-pink-950/30', accentColor: '#ec4899', bgGlow: 'hover:border-pink-500/60' },
    { type: 'drums', label: 'Drums', channelId: 'CH 02', icon: '🥁', color: 'text-amber-400 border-amber-700/50 bg-amber-950/30', accentColor: '#f59e0b', bgGlow: 'hover:border-amber-500/60' },
    { type: 'bass', label: 'Bass', channelId: 'CH 03', icon: '🎸', color: 'text-cyan-400 border-cyan-700/50 bg-cyan-950/30', accentColor: '#06b6d4', bgGlow: 'hover:border-cyan-500/60' },
    { type: 'guitar', label: 'Guitar', channelId: 'CH 04', icon: '🎸', color: 'text-emerald-400 border-emerald-700/50 bg-emerald-950/30', accentColor: '#10b981', bgGlow: 'hover:border-emerald-500/60' },
    { type: 'piano', label: 'Piano', channelId: 'CH 05', icon: '🎹', color: 'text-violet-400 border-violet-700/50 bg-violet-950/30', accentColor: '#8b5cf6', bgGlow: 'hover:border-violet-500/60' },
    { type: 'other', label: 'Melody/Other', channelId: 'CH 06', icon: '🎛️', color: 'text-teal-400 border-teal-700/50 bg-teal-950/30', accentColor: '#14b8a6', bgGlow: 'hover:border-teal-500/60' },
  ];

  // Helper to convert volume float 0-1 to dB display
  const volToDb = (vol: number) => {
    if (vol <= 0.001) return '-inf dB';
    const db = 20 * Math.log10(vol / 0.8);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  // Helper to compute active LED meter segments based on volume and mute state
  const getMeterSegments = (vol: number, muted: boolean, count = 10) => {
    if (muted || vol <= 0.05) return 0;
    const active = Math.round(vol * count);
    return Math.max(1, Math.min(count, active));
  };

  return (
    <div className="soundboard-chassis rounded-xl p-3 sm:p-5 select-none relative overflow-hidden">
      {/* Soundboard Studio Console Corner Bolts */}
      <div className="absolute top-2.5 left-2.5 soundboard-bolt" title="Chassis Hex Bolt" />
      <div className="absolute top-2.5 right-2.5 soundboard-bolt" title="Chassis Hex Bolt" />
      <div className="absolute bottom-2.5 left-2.5 soundboard-bolt" title="Chassis Hex Bolt" />
      <div className="absolute bottom-2.5 right-2.5 soundboard-bolt" title="Chassis Hex Bolt" />

      {/* Top Console Meter Bridge & Nameplate */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#232733]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#07080a] border border-[#2d3342] flex items-center justify-center text-[#dc2626] shadow-inner">
            <Sliders className="w-4 h-4 text-[#dc2626]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-black uppercase tracking-[0.25em] text-white">
                STUDIO CONSOLE • 6-STEM SUMMING DESK
              </h3>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950/70 border border-red-700/60 text-red-300 font-bold uppercase tracking-wider">
                CALIBRATED 0VU = +4dBu
              </span>
            </div>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-2">
              <span>ANALOG-MODELED GAIN STAGES</span>
              <span className="text-zinc-600">•</span>
              <span>PHASE ALIGNED DSP</span>
              <span className="text-zinc-600">•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE 48V PHANTOM
              </span>
            </p>
          </div>
        </div>

        {/* Stem Quick-Select / Solo Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-[#090b0e] p-1 rounded-lg border border-[#232733] text-[10px] font-mono uppercase shadow-inner">
          <button
            type="button"
            onClick={() => onSelectStemFilter('all')}
            className={`px-2.5 py-1 rounded font-bold transition ${
              selectedStem === 'all'
                ? 'bg-[#292d38] text-white shadow-sm border border-[#3e4453]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Channels
          </button>
          {stems.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => onSelectStemFilter(s.type)}
              className={`px-2 py-1 rounded font-bold transition flex items-center gap-1.5 ${
                selectedStem === s.type
                  ? 'bg-[#1a1d26] text-white border border-[#3e4453] shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 6 Stems + Master Mixer Channel Strips Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {stems.map((stemObj) => {
          const stem = stemObj.type;
          const summary = pipelineResult?.stemSummaries[stem];
          const stemVol = volume[stem] ?? 0.8;
          const stemPan = pan[stem] ?? 0;
          const stemMuted = isMuted[stem] ?? false;
          const stemSoloed = isSoloed[stem] ?? false;
          const isSelected = selectedStem === stem;
          const activeLeds = getMeterSegments(stemVol, stemMuted, 8);

          return (
            <div
              key={stem}
              onClick={() => onSelectStemFilter(isSelected ? 'all' : stem)}
              className={`soundboard-channel-strip rounded-lg p-3 cursor-pointer flex flex-col justify-between transition-all ${
                isSelected
                  ? 'ring-2 ring-[#06b6d4] shadow-cyan-glow border-[#06b6d4]/80'
                  : 'hover:border-[#383e50]'
              }`}
            >
              {/* Channel Strip Top Bolt & Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 border-b border-[#232733] pb-1.5">
                  <div className="soundboard-bolt" />
                  <span className="font-bold tracking-wider text-zinc-400">{stemObj.channelId}</span>
                  <div className="soundboard-bolt" />
                </div>

                {/* Scribble Strip / Console Masking Tape */}
                <div className="soundboard-scribble-strip rounded p-1.5 border border-[#2d3342] text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <span className="text-xs">{stemObj.icon}</span>
                    <span className="text-xs font-mono font-black uppercase text-white tracking-wider truncate">
                      {stemObj.label}
                    </span>
                  </div>
                  <div
                    className="h-1 w-full rounded-full mt-1"
                    style={{ backgroundColor: stemObj.accentColor, boxShadow: `0 0 8px ${stemObj.accentColor}` }}
                  />
                </div>

                {/* Routing & Spectral Role Readout */}
                <div className="p-1 rounded bg-[#090a0d] border border-[#1d212b] text-center">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase block">Role</span>
                  <span className="text-[9px] font-mono font-bold text-zinc-300 uppercase truncate block">
                    {summary?.primaryRole || 'TRANSCRIPTION'}
                  </span>
                </div>

                {/* Hardware Rotary Pan Potentiometer */}
                <div className="p-2 rounded bg-[#0b0c10] border border-[#1f232d] flex flex-col items-center">
                  <div className="w-full flex items-center justify-between text-[8px] font-mono text-zinc-400 mb-1">
                    <span>PAN</span>
                    <span className="text-zinc-200 font-bold">
                      {stemPan === 0 ? 'CENTER' : stemPan < 0 ? `L ${Math.abs(Math.round(stemPan * 100))}%` : `R ${Math.round(stemPan * 100)}%`}
                    </span>
                  </div>

                  {/* Tactile Rotary Knob Visual */}
                  <div className="relative w-11 h-11 flex items-center justify-center my-0.5">
                    {/* Tick scale marks */}
                    <div className="absolute inset-0 rounded-full border border-dashed border-zinc-700/60 pointer-events-none" />
                    <div
                      className="w-8 h-8 soundboard-rotary-knob flex items-center justify-center transition-transform duration-75 shadow-lg"
                      style={{ transform: `rotate(${stemPan * 135}deg)` }}
                    >
                      {/* Top indicator notch */}
                      <div className="absolute top-1 w-1 h-2 rounded-sm bg-white shadow-[0_0_4px_white]" />
                    </div>
                  </div>

                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={stemPan}
                    onChange={(e) => {
                      e.stopPropagation();
                      onPanChange(stem, parseFloat(e.target.value));
                    }}
                    className="w-full h-1 bg-[#1a1d26] rounded appearance-none cursor-pointer accent-[#06b6d4] mt-1"
                    title={`Pan: ${stemPan}`}
                  />
                </div>

                {/* Tactile Push Buttons: SOLO & MUTE */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSolo(stem);
                    }}
                    className={`py-1.5 px-1 rounded text-[10px] font-mono font-black tracking-wider transition ${
                      stemSoloed
                        ? 'soundboard-btn-solo-active'
                        : 'soundboard-btn-inactive text-amber-300 hover:text-white'
                    }`}
                    title="Toggle Solo (Yellow LED)"
                  >
                    SOLO
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMute(stem);
                    }}
                    className={`py-1.5 px-1 rounded text-[10px] font-mono font-black tracking-wider transition ${
                      stemMuted
                        ? 'soundboard-btn-mute-active'
                        : 'soundboard-btn-inactive text-red-400 hover:text-white'
                    }`}
                    title="Toggle Mute (Red LED)"
                  >
                    MUTE
                  </button>
                </div>
              </div>

              {/* Hardware Fader Section with Recessed Trough & Optical LED VU Meter */}
              <div className="my-3 p-2.5 rounded bg-[#090b0e] border border-[#1d212b]">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 mb-1.5">
                  <span className="font-bold text-zinc-300">LEVEL</span>
                  <span className="text-emerald-400 font-mono font-bold tabular-nums">
                    {volToDb(stemVol)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Optical LED VU Meter Ladder (8 segments: 5 green, 2 amber, 1 red clip) */}
                  <div className="flex flex-col-reverse justify-between gap-1 h-24 py-1 px-1 bg-[#050608] rounded border border-[#1b1e27] shadow-inner shrink-0">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                      const isLit = idx < activeLeds;
                      let color = 'bg-emerald-500 shadow-[0_0_4px_#10b981]';
                      if (idx >= 7) color = 'bg-red-500 shadow-[0_0_6px_#ef4444]';
                      else if (idx >= 5) color = 'bg-amber-400 shadow-[0_0_5px_#f59e0b]';

                      return (
                        <div
                          key={idx}
                          className={`w-2 h-1.5 rounded-[1px] transition-all duration-75 ${
                            isLit ? color : 'bg-[#151821] opacity-50'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Recessed Fader Slot with Chunky Handle */}
                  <div className="flex-1 relative soundboard-fader-slot h-24 rounded flex flex-col justify-center px-1.5">
                    {/* Vertical Center Track Slit */}
                    <div className="soundboard-fader-slit" />

                    {/* Fader dB Scale Markings */}
                    <div className="absolute left-1 top-1 bottom-1 flex flex-col justify-between text-[7px] font-mono text-zinc-600 pointer-events-none select-none">
                      <span>+6</span>
                      <span>0</span>
                      <span>-6</span>
                      <span>-12</span>
                      <span>-∞</span>
                    </div>

                    {/* Native slider overlaid transparently on the fader trough */}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={stemVol}
                      onChange={(e) => {
                        e.stopPropagation();
                        onVolumeChange(stem, parseFloat(e.target.value));
                      }}
                      className="w-full h-4 opacity-90 cursor-pointer accent-white relative z-10"
                      title={`Volume: ${Math.round(stemVol * 100)}%`}
                    />
                  </div>
                </div>

                <div className="mt-1.5 text-center font-mono text-[8px] text-zinc-500">
                  SLIDER: {Math.round(stemVol * 100)}%
                </div>
              </div>

              {/* Bottom Strip Footer: Console Tape & Export Switch */}
              <div className="space-y-1.5 pt-1 border-t border-[#232733]">
                {/* Console Masking Tape Label with Notes & Bleed */}
                <div className="soundboard-tape px-2 py-0.5 rounded text-center text-[9px] font-mono font-bold flex items-center justify-between">
                  <span>{summary?.noteCount || 0}N</span>
                  <span className="text-red-700">-{summary?.purgedBleedCount || 0}B</span>
                </div>

                {/* Individual Stem MIDI Export Button */}
                {onExportStemMidi && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportStemMidi(stem);
                    }}
                    className="w-full py-1.5 px-2 rounded soundboard-btn-inactive text-zinc-200 hover:text-white text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition active:scale-95"
                    title={`Export ${stemObj.label} MIDI (.mid)`}
                  >
                    <Download className="w-3 h-3 text-[#06b6d4]" />
                    <span>MIDI EXP</span>
                  </button>
                )}

                {/* Channel Strip Bottom Hex Bolt */}
                <div className="flex justify-center pt-1">
                  <div className="soundboard-bolt" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Master Summing Bus Channel Strip (SSL Red Master Fader Style) */}
        <div className="soundboard-master-strip rounded-lg p-3 flex flex-col justify-between shadow-2xl border-[#3e4453]">
          {/* Master Strip Top Bolts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 border-b border-[#333949] pb-1.5">
              <div className="soundboard-bolt soundboard-bolt-gold" />
              <span className="font-bold tracking-wider text-white">MASTER BUS</span>
              <div className="soundboard-bolt soundboard-bolt-gold" />
            </div>

            {/* Master Console Scribble Strip */}
            <div className="soundboard-scribble-strip rounded p-1.5 border border-[#4a536b] text-center bg-[#151822]">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-sm">🎛️</span>
                <span className="text-xs font-mono font-black uppercase text-white tracking-widest">
                  MAIN STEREO
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-[#dc2626] shadow-[0_0_10px_#dc2626] mt-1" />
            </div>

            {/* Summing Grid Specs */}
            <div className="p-1.5 rounded bg-[#08090d] border border-[#2d3342] text-center">
              <span className="text-[8px] font-mono text-zinc-500 uppercase block">Tempo / Time Sig</span>
              <span className="text-[10px] font-mono font-bold text-cyan-300 block">
                {pipelineResult?.metadata.bpm ? pipelineResult.metadata.bpm.toFixed(1) : '120.0'} BPM • 4/4
              </span>
            </div>

            {/* Master Mute Push Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onToggleMute('master')}
                className={`w-full py-2 px-2 rounded text-[10px] font-mono font-black tracking-wider transition ${
                  isMuted.master
                    ? 'soundboard-btn-mute-active'
                    : 'soundboard-btn-inactive text-red-400 hover:text-white'
                }`}
                title="Toggle Master Output Mute"
              >
                {isMuted.master ? 'MASTER MUTED' : 'MUTE MASTER'}
              </button>
            </div>
          </div>

          {/* Master Dual Stereo VU Meters & Classic Red Master Fader */}
          <div className="my-3 p-2.5 rounded bg-[#08090d] border border-[#2d3342]">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 mb-1.5">
              <span className="font-bold text-white uppercase tracking-wider">STEREO OUT</span>
              <span className="text-red-400 font-mono font-bold tabular-nums">
                {volToDb(volume.master ?? 0.85)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Dual Stereo Optical LED VU Meters (Left & Right) */}
              <div className="flex items-center gap-1">
                {/* Left Channel Meter */}
                <div className="flex flex-col-reverse justify-between gap-1 h-24 py-1 px-0.5 bg-[#050608] rounded border border-[#1b1e27] shadow-inner">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                    const isLit = idx < getMeterSegments(volume.master ?? 0.85, isMuted.master, 8);
                    let color = 'bg-emerald-500 shadow-[0_0_4px_#10b981]';
                    if (idx >= 7) color = 'bg-red-500 shadow-[0_0_6px_#ef4444]';
                    else if (idx >= 5) color = 'bg-amber-400 shadow-[0_0_5px_#f59e0b]';

                    return (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-[1px] transition-all duration-75 ${
                          isLit ? color : 'bg-[#151821] opacity-50'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Right Channel Meter */}
                <div className="flex flex-col-reverse justify-between gap-1 h-24 py-1 px-0.5 bg-[#050608] rounded border border-[#1b1e27] shadow-inner">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                    const isLit = idx < getMeterSegments(volume.master ?? 0.85, isMuted.master, 8);
                    let color = 'bg-emerald-500 shadow-[0_0_4px_#10b981]';
                    if (idx >= 7) color = 'bg-red-500 shadow-[0_0_6px_#ef4444]';
                    else if (idx >= 5) color = 'bg-amber-400 shadow-[0_0_5px_#f59e0b]';

                    return (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-[1px] transition-all duration-75 ${
                          isLit ? color : 'bg-[#151821] opacity-50'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Master Fader Slot with Classic SSL Red Handle */}
              <div className="flex-1 relative soundboard-fader-slot h-24 rounded flex flex-col justify-center px-1.5">
                <div className="soundboard-fader-slit" />

                <div className="absolute left-1 top-1 bottom-1 flex flex-col justify-between text-[7px] font-mono text-zinc-500 pointer-events-none select-none">
                  <span className="text-red-400 font-bold">+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-∞</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume.master ?? 0.85}
                  onChange={(e) => onVolumeChange('master', parseFloat(e.target.value))}
                  className="w-full h-4 opacity-90 cursor-pointer accent-[#dc2626] relative z-10"
                  title={`Master: ${Math.round((volume.master ?? 0.85) * 100)}%`}
                />
              </div>
            </div>

            <div className="mt-1.5 text-center font-mono text-[8px] text-zinc-400">
              MASTER FADER: {Math.round((volume.master ?? 0.85) * 100)}%
            </div>
          </div>

          {/* Master Strip Footer: Total Notes & Bundle Export */}
          <div className="space-y-1.5 pt-1 border-t border-[#333949]">
            <div className="soundboard-tape px-2 py-0.5 rounded text-center text-[9px] font-mono font-bold flex items-center justify-between">
              <span>TOTAL</span>
              <span className="text-red-700">{pipelineResult?.cleanedMidiNotes.length || 0} NOTES</span>
            </div>

            {onExportAllMidi && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExportAllMidi();
                }}
                className="w-full py-1.5 px-2 rounded bg-[#dc2626] hover:bg-red-700 text-white text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-crimson-glow transition active:scale-95"
                title="Export all stem tracks as Multi-Track .MID Bundle"
              >
                <Download className="w-3 h-3 text-white" />
                <span>BUNDLE MIDI</span>
              </button>
            )}

            <div className="flex justify-center pt-1">
              <div className="soundboard-bolt soundboard-bolt-gold" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
