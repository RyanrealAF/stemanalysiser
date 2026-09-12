/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  Clock,
  Sparkles,
  Zap,
  Info,
  ChevronRight,
  Sliders,
  Volume2,
} from 'lucide-react';
import { SectionAnalysis, SongPipelineResult, StemRole, StemType } from '../types';

interface TimelineViewProps {
  pipelineResult: SongPipelineResult | null;
  currentTime: number;
  duration: number;
  selectedStem: StemType | 'all';
  onSeek: (time: number) => void;
  onSelectSection: (section: SectionAnalysis) => void;
  activeSection: SectionAnalysis | null;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  pipelineResult,
  currentTime,
  duration,
  selectedStem,
  onSeek,
  onSelectSection,
  activeSection,
}) => {
  const timelineRef = useRef<HTMLDivElement | null>(null);

  if (!pipelineResult) return null;

  const { sections, metadata, stemFeatures } = pipelineResult;
  const totalDuration = Math.max(1, duration || metadata.duration || 1);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * totalDuration);
  };

  const getRoleColor = (role: StemRole) => {
    switch (role) {
      case 'foundation':
        return 'bg-amber-900/30 text-amber-300 border-amber-700/50';
      case 'lead':
        return 'bg-cyan-900/30 text-cyan-300 border-cyan-700/50';
      case 'texture':
        return 'bg-purple-900/30 text-purple-300 border-purple-700/50';
      case 'ornament':
        return 'bg-indigo-900/30 text-indigo-300 border-indigo-700/50';
      case 'percussion':
        return 'bg-pink-900/30 text-pink-300 border-pink-700/50';
      case 'silent':
      default:
        return 'bg-[#1A1D24] text-slate-500 border-[#2D3139]';
    }
  };

  const getSectionBadgeStyle = (sectionType: string) => {
    switch (sectionType) {
      case 'drop':
        return 'bg-rose-950/40 border-rose-700/60 text-rose-300';
      case 'chorus':
      case 'hook':
        return 'bg-indigo-950/40 border-indigo-500/60 text-indigo-300';
      case 'verse':
        return 'bg-blue-950/30 border-blue-700/50 text-blue-300';
      case 'intro':
        return 'bg-[#1A1D24] border-slate-700/50 text-slate-300';
      case 'outro':
        return 'bg-purple-950/30 border-purple-800/50 text-purple-300';
      default:
        return 'bg-[#1A1D24] border-[#2D3139] text-slate-300';
    }
  };

  const stemsList: { type: StemType; label: string; icon: string; color: string }[] = [
    { type: 'vocals', label: 'VOCALS', icon: '🎤', color: 'text-cyan-400' },
    { type: 'bass', label: 'BASS', icon: '🎸', color: 'text-amber-400' },
    { type: 'drums', label: 'DRUMS', icon: '🥁', color: 'text-pink-400' },
    { type: 'guitar', label: 'GUITAR', icon: '🎸', color: 'text-emerald-400' },
    { type: 'piano', label: 'PIANO', icon: '🎹', color: 'text-sky-400' },
    { type: 'other', label: 'OTHER', icon: '🎛️', color: 'text-purple-400' },
  ];

  const visibleStems = selectedStem === 'all' ? stemsList : stemsList.filter((s) => s.type === selectedStem);
  const playheadPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="soundboard-chassis rounded-xl p-3 sm:p-5 select-none relative overflow-hidden shadow-2xl">
      {/* Soundboard Chassis Corner Bolts */}
      <div className="absolute top-2.5 left-2.5 soundboard-bolt" />
      <div className="absolute top-2.5 right-2.5 soundboard-bolt" />
      <div className="absolute bottom-2.5 left-2.5 soundboard-bolt" />
      <div className="absolute bottom-2.5 right-2.5 soundboard-bolt" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-[#232733]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#090b0e] border border-[#2d3342] flex items-center justify-center text-[#06b6d4] shadow-inner">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-black uppercase tracking-[0.2em] text-white">
              STEM DECOMPOSITION & FUNCTIONAL TIMELINE
            </h3>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
              Click sections for Gemini musical reasoning or scrub timeline to reposition master playback
            </p>
          </div>
        </div>

        {/* Legend for Stems & Signal Bands */}
        <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase font-mono bg-[#090b0e] px-2.5 py-1 rounded-lg border border-[#232733] shadow-inner">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" /> Bass Sub-Band
          </span>
          <span className="flex items-center gap-1.5 text-pink-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_6px_#ec4899]" /> Vocal Formant
          </span>
          <span className="flex items-center gap-1.5 text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" /> Drum Transients
          </span>
        </div>
      </div>

      {/* Main Timeline Canvas */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="relative bg-[#07080a] rounded-lg p-3 border border-[#232733] select-none cursor-pointer overflow-hidden group shadow-inner"
      >
        {/* Playhead Indicator Line */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-[#dc2626] shadow-[0_0_10px_#dc2626] pointer-events-none transition-all duration-75"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-[#dc2626] shadow-[0_0_10px_#dc2626] -translate-x-[5px] -translate-y-1 border border-white" />
        </div>

        {/* Top: Section Header Blocks */}
        <div className="flex h-11 gap-1.5 mb-2.5">
          {sections.map((sec) => {
            const widthPct = ((sec.endTime - sec.startTime) / totalDuration) * 100;
            const isSecActive =
              currentTime >= sec.startTime && currentTime < sec.endTime;
            const isSecSelected = activeSection?.id === sec.id;

            return (
              <button
                key={sec.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSection(sec);
                }}
                style={{ width: `${widthPct}%` }}
                className={`h-full rounded-md border px-2 py-1 text-left relative overflow-hidden transition-all font-mono ${getSectionBadgeStyle(
                  sec.section
                )} ${
                  isSecSelected
                    ? 'ring-2 ring-cyan-400 shadow-[0_0_10px_#06b6d4]'
                    : isSecActive
                    ? 'ring-1 ring-white/60 brightness-110'
                    : 'hover:brightness-110'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase truncate block text-white">{sec.title}</span>
                  <span className="text-[9px] opacity-70 shrink-0 ml-1">
                    {Math.round(sec.startTime)}s-{Math.round(sec.endTime)}s
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] mt-0.5">
                  <span className="truncate opacity-75 uppercase">{sec.dynamics}</span>
                  <span className="font-bold text-cyan-300">
                    {sec.quantizationStrictness}% SNAP
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Per-Stem Functional Role Ribbons */}
        <div className="space-y-1.5">
          {visibleStems.map((stemObj) => {
            const stem = stemObj.type;

            return (
              <div key={stem} className="flex items-center gap-2.5 h-8">
                {/* Stem Label Pill */}
                <div className="w-20 shrink-0 soundboard-scribble-strip px-1.5 py-1 rounded border border-[#2d3342] flex items-center justify-between text-[10px] font-mono font-bold">
                  <span>{stemObj.icon}</span>
                  <span className={`${stemObj.color} uppercase tracking-wider truncate`}>{stemObj.label}</span>
                </div>

                {/* Section Windows for this stem */}
                <div className="flex-1 flex h-full gap-1 relative">
                  {sections.map((sec) => {
                    const widthPct = ((sec.endTime - sec.startTime) / totalDuration) * 100;
                    const role = sec.stemRoles?.[stem] || 'silent';
                    const roleReasoning = sec.stemReasoning?.[stem] || '';
                    const isSecSelected = activeSection?.id === sec.id;

                    return (
                      <div
                        key={sec.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSection(sec);
                        }}
                        style={{ width: `${widthPct}%` }}
                        title={`${sec.title} - ${stem.toUpperCase()} [${role.toUpperCase()}]: ${roleReasoning}`}
                        className={`h-full rounded border text-[9px] font-mono uppercase font-bold flex items-center justify-center px-1 truncate transition-all cursor-pointer ${getRoleColor(
                          role
                        )} ${isSecSelected ? 'ring-2 ring-white shadow-md' : 'hover:opacity-90'}`}
                      >
                        <span className="truncate tracking-wide">
                          {role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Analog Time Ruler styled like SMPTE Timecode Tape */}
        <div className="flex justify-between text-[9px] font-mono text-zinc-500 pt-2 mt-2 border-t border-[#1d212b] tracking-wider">
          <span className="text-zinc-400">00:00:00.00</span>
          <span>{Math.round(totalDuration * 0.25)}s</span>
          <span className="text-cyan-400 font-bold">{Math.round(totalDuration * 0.5)}s (CENTER)</span>
          <span>{Math.round(totalDuration * 0.75)}s</span>
          <span className="text-zinc-400">SMPTE {Math.round(totalDuration)}s</span>
        </div>
      </div>

      {/* Active Section Tap-to-Read Detail Card */}
      {activeSection && (
        <div className="mt-3 p-3 rounded bg-[#0A0B0E] border border-indigo-500/30 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[#2D3139]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-3 h-3" />
              </div>
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Section: {activeSection.title} [{activeSection.startTime.toFixed(1)}s - {activeSection.endTime.toFixed(1)}s]
              </h4>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono uppercase">
              <span className="text-slate-400">
                Tension: <strong className="text-indigo-400 font-bold">{activeSection.harmonicTension}%</strong>
              </span>
              <span className="text-slate-400">
                Quantization: <strong className="text-white font-bold">{activeSection.quantizationStrictness}% Strict</strong>
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 italic leading-relaxed mb-2.5 font-sans">
            "{activeSection.musicalContext}"
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {stemsList.map((s) => {
              const role = activeSection.stemRoles?.[s.type] || 'silent';
              const reasoning = activeSection.stemReasoning?.[s.type] || 'Standard functional attribution.';
              return (
                <div key={s.type} className="p-2 rounded bg-[#15171C] border border-[#2D3139] text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold font-mono ${s.color}`}>
                      {s.label}
                    </span>
                    <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${getRoleColor(role)}`}>
                      {role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                    {reasoning}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
