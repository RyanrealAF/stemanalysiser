/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { SongPipelineResult, StemType } from '../types';
import { audioEngine } from '../lib/audioPlayer';

interface TelemetrySoundboardProps {
  pipelineResult: SongPipelineResult | null;
  stemBuffers: Record<StemType, AudioBuffer> | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: Record<StemType | 'master', boolean>;
  isSoloed: Record<StemType, boolean>;
  onToggleMute: (stem: StemType) => void;
  onToggleSolo: (stem: StemType) => void;
  onExportStemMidi: (stem: StemType | 'all') => void;
  onDownloadZip: () => void;
}

export const TelemetrySoundboard: React.FC<TelemetrySoundboardProps> = ({
  pipelineResult,
  stemBuffers,
  isPlaying,
  currentTime,
  duration,
  isMuted,
  isSoloed,
  onToggleMute,
  onToggleSolo,
  onExportStemMidi,
  onDownloadZip,
}) => {
  const masterFftRef = useRef<HTMLCanvasElement | null>(null);
  const vocalFormantRef = useRef<HTMLCanvasElement | null>(null);
  const vocalPitchRef = useRef<HTMLCanvasElement | null>(null);
  const drumTransientRef = useRef<HTMLCanvasElement | null>(null);
  const bassOscRef = useRef<HTMLCanvasElement | null>(null);
  const guitarOverdriveRef = useRef<HTMLCanvasElement | null>(null);
  const pianoRegisterRef = useRef<HTMLCanvasElement | null>(null);
  const synthMelodyRef = useRef<HTMLCanvasElement | null>(null);
  const lissajousRef = useRef<HTMLCanvasElement | null>(null);

  const [activePad, setActivePad] = useState<string | null>(null);
  const [centDrift, setCentDrift] = useState('+1.4 CENTS');
  const [activeStep, setActiveStep] = useState(8);

  // Extract detected chord / root or default to song metadata
  const activeRoot = pipelineResult?.metadata.key ? `${pipelineResult.metadata.key}m9` : 'C#m9';
  const bpm = pipelineResult?.metadata.bpm ? pipelineResult.metadata.bpm.toFixed(0) : '124';

  // Real-time animation loop for canvas visualizers
  useEffect(() => {
    let animFrameId: number;
    let tick = 0;

    const render = () => {
      tick += isPlaying ? 0.08 : 0.03;

      // 1. Master FFT Spectrogram Radar
      const fftCanvas = masterFftRef.current;
      if (fftCanvas) {
        const ctx = fftCanvas.getContext('2d');
        if (ctx) {
          const w = fftCanvas.width;
          const h = fftCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const bars = 48;
          const barWidth = w / bars - 2;

          for (let i = 0; i < bars; i++) {
            const mod = isPlaying ? 1.4 : 0.8;
            const noise =
              (Math.sin(tick * 2.2 + i * 0.35) * 0.4 +
                Math.cos(tick * 3.1 + i * 0.22) * 0.3 +
                0.35) *
              mod;
            const barHeight = Math.max(5, Math.min(h - 4, noise * (h - 8)));
            const x = i * (barWidth + 2);
            const y = h - barHeight;

            if (i < 8) ctx.fillStyle = '#06B6D4'; // SUB
            else if (i < 16) ctx.fillStyle = '#F59E0B'; // DRUM
            else if (i < 24) ctx.fillStyle = '#EC4899'; // VOX
            else if (i < 32) ctx.fillStyle = '#DC2626'; // GTR
            else if (i < 40) ctx.fillStyle = '#4CD7F6'; // PNO
            else ctx.fillStyle = '#10B981'; // SYN

            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }
      }

      // 2. Vocal Formants Canvas
      const vFormant = vocalFormantRef.current;
      if (vFormant) {
        const ctx = vFormant.getContext('2d');
        if (ctx) {
          const w = vFormant.width;
          const h = vFormant.height;
          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.strokeStyle = '#EC4899';
          ctx.lineWidth = 2.5;
          for (let x = 0; x < w; x++) {
            const f1 = Math.exp(-Math.pow((x - 70) / 28, 2)) * 58;
            const f2 = Math.exp(-Math.pow((x - 180) / 38, 2)) * 44;
            const wobble = Math.sin(tick * 3.5 + x * 0.08) * 5;
            const y = h - (f1 + f2 + wobble + 16);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fillStyle = 'rgba(236, 72, 153, 0.16)';
          ctx.fill();
        }
      }

      // 3. Vocal Pitch Contour
      const vPitch = vocalPitchRef.current;
      if (vPitch) {
        const ctx = vPitch.getContext('2d');
        if (ctx) {
          const w = vPitch.width;
          const h = vPitch.height;
          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.strokeStyle = '#4edea3';
          ctx.lineWidth = 2;
          const centerY = h / 2;
          for (let x = 0; x < w; x++) {
            const vib = Math.sin(x * 0.12 - tick * 5.2) * 11;
            const drift = Math.sin(x * 0.03 + tick) * 7;
            const y = centerY + vib + drift;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // 4. Drum Transient Waveform
      const drumCanvas = drumTransientRef.current;
      if (drumCanvas) {
        const ctx = drumCanvas.getContext('2d');
        if (ctx) {
          const w = drumCanvas.width;
          const h = drumCanvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          const centerY = h / 2;
          for (let x = 0; x < w; x++) {
            const beatPos = (x + tick * 32) % 64;
            let amp = 0;
            if (beatPos < 14) {
              amp = Math.sin(beatPos * 0.85) * Math.exp(-beatPos * 0.22) * (h * 0.42);
            } else {
              amp = (Math.random() - 0.5) * 3;
            }
            const y = centerY + amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // 5. Bass Sub Oscilloscope
      const bassCanvas = bassOscRef.current;
      if (bassCanvas) {
        const ctx = bassCanvas.getContext('2d');
        if (ctx) {
          const w = bassCanvas.width;
          const h = bassCanvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.strokeStyle = '#06B6D4';
          ctx.lineWidth = 2.8;
          const centerY = h / 2;
          for (let x = 0; x < w; x++) {
            const sine = Math.sin(x * 0.075 - tick * 7.5) * 34;
            const subHarmonic = Math.sin(x * 0.038 - tick * 3.75) * 14;
            const y = centerY + sine + subHarmonic;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // 6. Guitar Overdrive Waveform
      const guitarCanvas = guitarOverdriveRef.current;
      if (guitarCanvas) {
        const ctx = guitarCanvas.getContext('2d');
        if (ctx) {
          const w = guitarCanvas.width;
          const h = guitarCanvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 2;
          const centerY = h / 2;
          for (let x = 0; x < w; x++) {
            let raw = Math.sin(x * 0.1 - tick * 6) * 32 + Math.sin(x * 0.25 - tick * 8) * 12;
            // Soft clipping overdrive curve
            const clipped = Math.tanh(raw / 24) * 26;
            const y = centerY + clipped;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // 7. Piano Register Heatmap
      const pianoCanvas = pianoRegisterRef.current;
      if (pianoCanvas) {
        const ctx = pianoCanvas.getContext('2d');
        if (ctx) {
          const w = pianoCanvas.width;
          const h = pianoCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const voices = [
            { pitch: 18, color: '#06B6D4' },
            { pitch: 38, color: '#4CD7F6' },
            { pitch: 58, color: '#38BDF8' },
            { pitch: 78, color: '#7DD3FC' },
          ];

          voices.forEach((v, idx) => {
            const noteX = (tick * 45 + idx * 75) % w;
            ctx.fillStyle = v.color;
            ctx.fillRect(w - noteX, v.pitch, 36, 9);
            ctx.fillStyle = 'rgba(76, 215, 246, 0.22)';
            ctx.fillRect(w - noteX - 8, v.pitch - 2, 52, 13);
          });
        }
      }

      // 8. Synth Dispersion Canvas
      const synthCanvas = synthMelodyRef.current;
      if (synthCanvas) {
        const ctx = synthCanvas.getContext('2d');
        if (ctx) {
          const w = synthCanvas.width;
          const h = synthCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const voices = [
            { pitch: 20, color: '#10B981' },
            { pitch: 45, color: '#34D399' },
            { pitch: 70, color: '#059669' },
          ];

          voices.forEach((v, idx) => {
            const noteX = (tick * 40 + idx * 60) % w;
            ctx.fillStyle = v.color;
            ctx.fillRect(w - noteX, v.pitch, 34, 8);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.fillRect(w - noteX - 8, v.pitch - 2, 50, 12);
          });
        }
      }

      // 9. Lissajous Phase Scope
      const lissCanvas = lissajousRef.current;
      if (lissCanvas) {
        const ctx = lissCanvas.getContext('2d');
        if (ctx) {
          const w = lissCanvas.width;
          const h = lissCanvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.strokeStyle = '#4CD7F6';
          ctx.lineWidth = 1.6;
          const cx = w / 2;
          const cy = h / 2;
          const samples = 140;

          for (let i = 0; i < samples; i++) {
            const t = (i / samples) * Math.PI * 2;
            const left = Math.sin(t + tick * 2.8) * 44;
            const right = Math.sin(t * 2 + tick * 3.1) * 44;
            const px = cx + (left - right) * 0.7;
            const py = cy + (left + right) * 0.5;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // Micro cent drift update
      if (Math.random() > 0.94) {
        const val = (Math.random() * 2.2 - 1.1).toFixed(1);
        setCentDrift((Number(val) > 0 ? '+' : '') + val + ' CENTS');
      }

      // 16-step active gate update
      if (isPlaying) {
        setActiveStep(Math.floor((tick * 4) % 16));
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [isPlaying]);

  // Handle tactical soundboard pad audition
  const handleAuditionPad = (padId: string, stem: StemType) => {
    setActivePad(padId);
    setTimeout(() => setActivePad(null), 250);

    // Play isolated stem or synthetic frequency test
    if (stemBuffers && stemBuffers[stem]) {
      const buffer = stemBuffers[stem];
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.85, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0, Math.min(buffer.duration - 1.2, Math.max(0, currentTime)));
        src.stop(ctx.currentTime + 1.2);
      } catch (err) {
        console.warn('Audition error:', err);
      }
    }
  };

  // Get notes for each stem from pipelineResult
  const getNotesForStem = (stem: StemType) => {
    if (!pipelineResult) return [];
    return pipelineResult.cleanedMidiNotes.filter((n) => n.stem === stem).slice(0, 4);
  };

  return (
    <div className="flex flex-col w-full gap-5 select-none pb-12">
      {/* TOP HUD OVERVIEW BAR (Rack Mounted Brushed Aluminum Frame) */}
      <section className="rack-chassis rounded-lg p-4 relative border border-[#2b303c] overflow-hidden shadow-2xl">
        <div className="absolute top-2 left-3"><span className="hex-screw" /></div>
        <div className="absolute top-2 right-3"><span className="hex-screw" /></div>
        <div className="absolute bottom-2 left-3"><span className="hex-screw" /></div>
        <div className="absolute bottom-2 right-3"><span className="hex-screw" /></div>

        <div className="flex flex-col xl:flex-row gap-4 items-stretch justify-between relative z-10 px-1">
          {/* FFT Multi-Band Spectrogram */}
          <div className="flex-1 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shadow-[0_0_8px_#DC2626] animate-ping" />
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  SPECTRUM TENSOR RADAR
                </span>
                <span className="font-mono text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-black/60 border border-[#272b36]">
                  4096-PT STFT
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#4CD7F6]">NYQUIST: 48.0 kHz</span>
            </div>

            <div className="relative h-20 w-full acrylic-screen rounded flex items-end px-1 gap-1">
              <canvas
                ref={masterFftRef}
                className="w-full h-full block"
                height={80}
                width={520}
              />
              <div className="absolute inset-0 pointer-events-none flex justify-between px-3 items-start pt-1 font-mono text-[9px] text-zinc-400/70">
                <span>20Hz [SUB]</span>
                <span>250Hz [LOW]</span>
                <span>2.5kHz [MID]</span>
                <span>20kHz [AIR]</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 font-mono text-xs text-center">
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#06B6D4] font-bold">SUB</span>
                <span className="text-white font-bold">-4.8dB</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#F59E0B] font-bold">DRUM</span>
                <span className="text-white font-bold">-1.2dB</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#EC4899] font-bold">VOX</span>
                <span className="text-white font-bold">-2.9dB</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#DC2626] font-bold">GTR</span>
                <span className="text-white font-bold">-3.4dB</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#4CD7F6] font-bold">PNO</span>
                <span className="text-white font-bold">-5.1dB</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#10B981] font-bold">SYN</span>
                <span className="text-white font-bold">-8.4dB</span>
              </div>
            </div>
          </div>

          {/* Master Neural Tensor Pipeline Indicators */}
          <div className="w-full xl:w-[460px] abs-molded-casing p-3.5 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-white">DECOMPOSITION TOPOLOGY</span>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="text-zinc-400">CUDA LATENCY:</span>
                <span className="text-[#4edea3] bg-[#4edea3]/10 px-1.5 py-0.5 rounded border border-[#4edea3]/30">
                  1.18ms
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 items-center my-1">
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">01 FFT</span>
                <span className="w-2 h-2 rounded-full bg-[#10B981] my-1 shadow-[0_0_6px_#10B981]" />
                <span className="font-mono text-white text-[9px]">4096-STFT</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">02 U-NET</span>
                <span className="w-2 h-2 rounded-full bg-[#06B6D4] my-1 animate-pulse shadow-[0_0_6px_#06B6D4]" />
                <span className="font-mono text-white text-[9px]">MASK v4</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">03 DECON</span>
                <span className="w-2 h-2 rounded-full bg-[#EC4899] my-1 shadow-[0_0_6px_#EC4899]" />
                <span className="font-mono text-white text-[9px]">HARMONIC</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">04 RESYN</span>
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] my-1 shadow-[0_0_6px_#F59E0B]" />
                <span className="font-mono text-white text-[9px]">WAVE-TAB</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center border-[#DC2626]/50 shadow-[0_0_12px_rgba(220,38,38,0.3)]">
                <span className="font-mono text-[9px] text-[#DC2626]">05 MIDI</span>
                <span className="w-2 h-2 rounded-full bg-[#DC2626] my-1 animate-ping shadow-[0_0_6px_#DC2626]" />
                <span className="font-mono text-white text-[9px]">MPE BUS</span>
              </div>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400 pt-1">
              <span>
                TENSOR CORES: <span className="text-white font-bold">128/128</span>
              </span>
              <span>
                RESIDUAL: <span className="text-[#10B981]">0.003%</span>
              </span>
              <span>
                SDR: <span className="text-[#4CD7F6] font-bold">14.6 dB</span>
              </span>
            </div>
          </div>

          {/* Tonality Anchor & Chord Probability Matrix */}
          <div className="w-full xl:w-72 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-xs font-bold text-white">TONAL ESTIMATOR</span>
              <span className="font-mono text-[10px] text-[#4edea3]">CONF: 99.1%</span>
            </div>

            <div className="flex items-center justify-between acrylic-screen p-2 rounded">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-zinc-400">CURRENT ROOT</span>
                <span className="font-mono text-xl font-extrabold text-[#EC4899] drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">
                  {activeRoot}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[9px] text-zinc-400">DRIFT OFFSET</span>
                <span className="font-mono text-xs font-bold text-[#4edea3]">{centDrift}</span>
              </div>
            </div>

            <div className="flex gap-1 mt-2">
              <div className="flex-1 text-center bg-[#DC2626]/20 border border-[#DC2626]/40 py-1 rounded shadow-sm">
                <span className="font-mono text-[10px] text-white block font-bold">{activeRoot}</span>
                <span className="font-mono text-[9px] text-zinc-400">98%</span>
              </div>
              <div className="flex-1 text-center keycap-hardware py-1 rounded">
                <span className="font-mono text-[10px] text-zinc-400 block">Amaj7</span>
                <span className="font-mono text-[9px] text-zinc-500">84%</span>
              </div>
              <div className="flex-1 text-center keycap-hardware py-1 rounded">
                <span className="font-mono text-[10px] text-zinc-400 block">Emaj9</span>
                <span className="font-mono text-[9px] text-zinc-500">71%</span>
              </div>
              <div className="flex-1 text-center keycap-hardware py-1 rounded">
                <span className="font-mono text-[10px] text-zinc-400 block">Bdom7</span>
                <span className="font-mono text-[9px] text-zinc-500">63%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6-STEM HEAVYWEIGHT MOLDED ABS INDUSTRIAL BAYS */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* STEM 01: VOCALS */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EC4899] shadow-[0_0_10px_#EC4899] border border-white/20" />
              <span className="font-mono text-xs font-bold text-white tracking-wide">01 // VOCALS</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('vocals')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isMuted.vocals ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('vocals')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isSoloed.vocals ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className="font-mono text-[10px] text-[#EC4899] bg-[#EC4899]/15 px-1.5 py-0.5 rounded border border-[#EC4899]/40 shadow-sm font-bold">
                LEAD
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>FORMANT ENVELOPE (F1/F2)</span>
              <span className="text-[#EC4899] font-mono text-[10px] font-bold">PHONEME: [aɪ]</span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden">
              <canvas ref={vocalFormantRef} className="w-full h-full block" height={96} width={360} />
              <div className="absolute bottom-1 right-2 font-mono text-[9px] text-[#EC4899]">
                F1: 780Hz | F2: 1840Hz
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">PITCH TRAJECTORY</span>
              <span className="text-white font-mono text-[10px] font-bold">F0: 277.18 Hz (C#4)</span>
            </div>
            <div className="h-16 w-full acrylic-screen rounded relative overflow-hidden flex items-center">
              <canvas ref={vocalPitchRef} className="w-full h-full block" height={64} width={360} />
              <div className="absolute top-1 left-2 font-mono text-[9px] text-[#4edea3]">
                VIB: 42¢ @ 5.8Hz
              </div>
            </div>
            <div className="flex justify-between text-zinc-400 font-mono text-[9px] pt-0.5">
              <span>SIBILANCE: <span className="text-[#EC4899] font-bold">-18.4 dB</span></span>
              <span>AIR: <span className="text-white font-bold">+2.1 dB</span></span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">DYNAMIC VECTOR</span>
              <span className="text-[#DC2626] font-mono text-[10px] font-bold">GR: -3.2 dB</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1 recessed-track h-2.5 rounded overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-[#DC2626] to-[#ef4444] h-full rounded shadow-[0_0_6px_#DC2626]"
                  style={{ width: '45%' }}
                />
              </div>
              <span className="font-mono text-[10px] text-[#DC2626] font-bold">14.2% BLEED</span>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED VOCAL MIDI</span>
              <span className="text-[#EC4899] font-bold font-mono">POLY: 3-VOICE</span>
            </div>
            <div className="flex gap-1.5">
              {getNotesForStem('vocals').length > 0 ? (
                getNotesForStem('vocals').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#EC4899] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#EC4899] block font-bold">C#4</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL 104</span>
                  </div>
                  <div className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-zinc-300 block font-bold">E4</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL 92</span>
                  </div>
                  <div className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-zinc-300 block font-bold">G#4</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL 86</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* STEM 02: DRUMS */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-[0_0_10px_#F59E0B] border border-white/20" />
              <span className="font-mono text-xs font-bold text-white tracking-wide">02 // DRUMS</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('drums')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isMuted.drums ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('drums')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isSoloed.drums ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className="font-mono text-[10px] text-[#F59E0B] bg-[#F59E0B]/15 px-1.5 py-0.5 rounded border border-[#F59E0B]/40 shadow-sm font-bold">
                PERC
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>TRANSIENT BURST PROFILE</span>
              <span className="text-[#F59E0B] font-mono text-[10px] font-bold">ATTACK: 1.8ms</span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden">
              <canvas ref={drumTransientRef} className="w-full h-full block" height={96} width={360} />
              <div className="absolute bottom-1 left-2 font-mono text-[9px] text-[#F59E0B]">
                CREST FACTOR: 14.8 dB
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">BAND ENERGY DECONSTRUCTION</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">PUNCH: 94%</span>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between font-mono text-[9px] text-zinc-400 mb-0.5">
                <span>KICK [52Hz]</span>
                <span className="text-white font-bold">-0.4 dB</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#F59E0B] to-[#fbbf24] h-full rounded w-[92%] shadow-[0_0_6px_#F59E0B]" />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-zinc-400 mb-0.5">
                <span>SNARE [210Hz]</span>
                <span className="text-white font-bold">-2.1 dB</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#4CD7F6] to-[#38bdf8] h-full rounded w-[78%] shadow-[0_0_6px_#4CD7F6]" />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-zinc-400 mb-0.5">
                <span>HI-HAT [11.4kHz]</span>
                <span className="text-white font-bold">-6.3 dB</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#10B981] to-[#34d399] h-full rounded w-[64%] shadow-[0_0_6px_#10B981]" />
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">POCKET LOCK / SWING</span>
              <span className="text-[#F59E0B] font-mono text-[10px] font-bold">+4.2ms LATE</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 py-1">
              <div className="h-3 bg-[#F59E0B] rounded shadow-[0_0_5px_#F59E0B]" />
              <div className="h-3 bg-[#191d26] rounded border border-[#292e3a]" />
              <div className="h-3 bg-[#F59E0B]/50 rounded" />
              <div className="h-3 bg-[#191d26] rounded border border-[#292e3a]" />
              <div className="h-3 bg-[#F59E0B] rounded shadow-[0_0_5px_#F59E0B]" />
              <div className="h-3 bg-[#191d26] rounded border border-[#292e3a]" />
              <div className="h-3 bg-[#F59E0B]/80 rounded" />
              <div className="h-3 bg-[#F59E0B]/30 rounded" />
            </div>
            <div className="flex justify-between font-mono text-[9px] text-zinc-400">
              <span>GHOST NOTES: 24/BAR</span>
              <span>STABILITY: 98.4%</span>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>GM MIDI TRIGGERS</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">0.4ms JITTER</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="keycap-hardware p-1 rounded text-center">
                <span className="font-mono text-[10px] text-[#F59E0B] block font-bold">KICK [36]</span>
                <span className="font-mono text-[8px] text-zinc-400">127 VEL</span>
              </div>
              <div className="keycap-hardware p-1 rounded text-center">
                <span className="font-mono text-[10px] text-[#4CD7F6] block font-bold">SNARE [38]</span>
                <span className="font-mono text-[8px] text-zinc-400">112 VEL</span>
              </div>
              <div className="keycap-hardware p-1 rounded text-center">
                <span className="font-mono text-[10px] text-[#10B981] block font-bold">HH [42]</span>
                <span className="font-mono text-[8px] text-zinc-400">98 VEL</span>
              </div>
            </div>
          </div>
        </div>

        {/* STEM 03: BASS */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#06B6D4] shadow-[0_0_10px_#06B6D4] border border-white/20" />
              <span className="font-mono text-xs font-bold text-white tracking-wide">03 // BASS</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('bass')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isMuted.bass ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('bass')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isSoloed.bass ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className="font-mono text-[10px] text-[#06B6D4] bg-[#06B6D4]/15 px-1.5 py-0.5 rounded border border-[#06B6D4]/40 shadow-sm font-bold">
                SUB-MONO
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>SUB-HARMONIC OSCILLOSCOPE</span>
              <span className="text-[#06B6D4] font-mono text-[10px] font-bold">CORR: +0.98</span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden">
              <canvas ref={bassOscRef} className="w-full h-full block" height={96} width={360} />
              <div className="absolute bottom-1 right-2 font-mono text-[9px] text-[#06B6D4]">
                MONO-COLLAPSE SAFE
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">FUNDAMENTAL TRACKING</span>
              <span className="text-white font-mono text-[10px] font-bold">C#1 (34.65 Hz)</span>
            </div>
            <div className="flex items-center justify-between acrylic-screen p-2 rounded">
              <div className="flex flex-col">
                <span className="font-mono text-[9px] text-zinc-400">PORTAMENTO</span>
                <span className="font-mono text-xs font-bold text-white">68ms LINEAR</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-mono text-[9px] text-zinc-400">RUMBLE FILTER</span>
                <span className="font-mono text-xs font-bold text-[#DC2626]">28Hz @ 24dB</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">TUBE DRIVE SATURATION</span>
              <span className="text-[#4CD7F6] font-mono text-[10px] font-bold">WARM HARMONICS</span>
            </div>
            <div className="space-y-1.5 pt-1 font-mono text-[9px]">
              <div className="flex justify-between text-zinc-400">
                <span>2ND ORDER (EVEN)</span>
                <span className="text-[#06B6D4] font-bold">-18.2 dB</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#06B6D4] to-[#38bdf8] h-full rounded w-[65%] shadow-[0_0_6px_#06B6D4]" />
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>3RD ORDER (ODD)</span>
                <span className="text-[#DC2626] font-bold">-24.8 dB</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#DC2626] to-[#f87171] h-full rounded w-[42%] shadow-[0_0_6px_#DC2626]" />
              </div>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>ARTICULATION DETECTOR</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">88% FINGER</span>
            </div>
            <div className="flex justify-between items-center text-center gap-1.5">
              <div className="flex-1 keycap-hardware p-1 rounded">
                <span className="font-mono text-[10px] text-[#06B6D4] block font-bold">LEGATO</span>
                <span className="font-mono text-[8px] text-zinc-400">92% GATE</span>
              </div>
              <div className="flex-1 keycap-hardware p-1 rounded">
                <span className="font-mono text-[10px] text-zinc-300 block font-bold">SLAP CC11</span>
                <span className="font-mono text-[8px] text-zinc-400">VAL: 108</span>
              </div>
            </div>
          </div>
        </div>

        {/* STEM 04: GUITAR */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#DC2626] shadow-[0_0_10px_#DC2626] border border-white/20" />
              <span className="font-mono text-xs font-bold text-white tracking-wide">04 // GUITAR</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('guitar')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isMuted.guitar ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('guitar')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isSoloed.guitar ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className="font-mono text-[10px] text-[#DC2626] bg-[#DC2626]/15 px-1.5 py-0.5 rounded border border-[#DC2626]/40 shadow-sm font-bold">
                OVERDRIVE
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>PICK ATTACK & AMP OVERDRIVE</span>
              <span className="text-[#DC2626] font-mono text-[10px] font-bold">DRIVE: 76%</span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden">
              <canvas ref={guitarOverdriveRef} className="w-full h-full block" height={96} width={360} />
              <div className="absolute bottom-1 right-2 font-mono text-[9px] text-[#DC2626] font-bold">
                CAB: 4x12 CEL-V30
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">FRETBOARD POSITION MATRIX</span>
              <span className="text-white font-mono text-[10px] font-bold">CHORD: C#m(add9)</span>
            </div>
            <div className="acrylic-screen p-2 rounded flex flex-col gap-1 font-mono text-[9px]">
              <div className="flex justify-between text-zinc-400">
                <span>E [1st]: 11th FRET</span>
                <span className="text-[#DC2626] font-bold">Eb4</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>B [2nd]: 9th FRET</span>
                <span className="text-[#DC2626] font-bold">G#3</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>G [3rd]: 9th FRET</span>
                <span className="text-[#DC2626] font-bold">E3</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>D [4th]: 11th FRET</span>
                <span className="text-[#DC2626] font-bold">C#3</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">STRUM VECTOR & BEND</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">DOWNSTROKE</span>
            </div>
            <div className="flex items-center justify-between acrylic-screen p-2 rounded">
              <div className="flex flex-col">
                <span className="font-mono text-[9px] text-zinc-400">BEND DISPERSION</span>
                <span className="font-mono text-xs font-bold text-[#DC2626]">+2.4 SEMITONES</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-mono text-[9px] text-zinc-400">STRUM SPREAD</span>
                <span className="font-mono text-xs font-bold text-white">18ms CHOP</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>6-STRING POLY EXTRACTION</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">6-VOICE BUS</span>
            </div>
            <div className="grid grid-cols-6 gap-1 text-center font-mono text-[10px]">
              <div className="keycap-hardware py-1 rounded text-[#DC2626] font-bold">E2</div>
              <div className="keycap-hardware py-1 rounded text-[#DC2626] font-bold">A2</div>
              <div className="keycap-hardware py-1 rounded text-[#DC2626] font-bold">D3</div>
              <div className="keycap-hardware py-1 rounded text-[#DC2626] font-bold">G3</div>
              <div className="keycap-hardware py-1 rounded text-[#DC2626] font-bold">B3</div>
              <div className="keycap-hardware py-1 rounded text-[#DC2626] font-bold">E4</div>
            </div>
          </div>
        </div>

        {/* STEM 05: PIANO */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#4CD7F6] shadow-[0_0_10px_#4CD7F6] border border-white/20" />
              <span className="font-mono text-xs font-bold text-white tracking-wide">05 // PIANO</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('piano')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isMuted.piano ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('piano')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isSoloed.piano ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className="font-mono text-[10px] text-[#4CD7F6] bg-[#4CD7F6]/15 px-1.5 py-0.5 rounded border border-[#4CD7F6]/40 shadow-sm font-bold">
                GRAND
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>88-KEY SPREAD HEATMAP</span>
              <span className="text-[#4CD7F6] font-mono text-[10px] font-bold">12 VOICES</span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden">
              <canvas ref={pianoRegisterRef} className="w-full h-full block" height={96} width={360} />
              <div className="absolute bottom-1 right-2 font-mono text-[9px] text-[#4CD7F6]">
                REGISTER: A0 - C8
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">HAMMER VELOCITY DYNAMICS</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">MEZZO-FORTE</span>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between font-mono text-[9px] text-zinc-400 mb-0.5">
                <span>TREBLE CLEF [RH]</span>
                <span className="text-white font-bold">104 VEL</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#4CD7F6] to-[#38bdf8] h-full rounded w-[81%] shadow-[0_0_6px_#4CD7F6]" />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-zinc-400 mb-0.5">
                <span>BASS CLEF [LH]</span>
                <span className="text-white font-bold">88 VEL</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-[#06B6D4] to-[#06b6d4] h-full rounded w-[65%] shadow-[0_0_6px_#06B6D4]" />
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">DAMPER RESONANCE CC64</span>
              <span className="text-[#4CD7F6] font-mono text-[10px] font-bold">SUSTAIN 92%</span>
            </div>
            <div className="flex items-center justify-between acrylic-screen p-2 rounded">
              <div className="flex flex-col">
                <span className="font-mono text-[9px] text-zinc-400">SYMPATHETIC COEFF</span>
                <span className="font-mono text-xs font-bold text-[#4CD7F6]">0.84 COHERENCE</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-mono text-[9px] text-zinc-400">PEDAL STATE</span>
                <span className="font-mono text-xs font-bold text-[#10B981]">ENGAGED (DOWN)</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>VOICING REGISTER DISTRIBUTION</span>
              <span className="text-[#4CD7F6] font-mono text-[10px] font-bold">SPLIT @ C4</span>
            </div>
            <div className="flex gap-1.5">
              <div className="flex-1 keycap-hardware p-1.5 rounded text-center">
                <span className="font-mono text-[10px] text-[#06B6D4] block font-bold">LH ROOTS</span>
                <span className="font-mono text-[8px] text-zinc-400">C#2 - G#2</span>
              </div>
              <div className="flex-1 keycap-hardware p-1.5 rounded text-center">
                <span className="font-mono text-[10px] text-[#4CD7F6] block font-bold">RH CHORDS</span>
                <span className="font-mono text-[8px] text-zinc-400">E4 - B5</span>
              </div>
            </div>
          </div>
        </div>

        {/* STEM 06: OTHER / SYNTH */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-[0_0_10px_#10B981] border border-white/20" />
              <span className="font-mono text-xs font-bold text-white tracking-wide">06 // SYNTH</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('other')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isMuted.other ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('other')}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold ${
                  isSoloed.other ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className="font-mono text-[10px] text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/40 shadow-sm font-bold">
                MPE BUS
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>SPECTRAL CENTROID & DISPERSION</span>
              <span className="text-[#10B981] font-mono text-[10px] font-bold">2,840 Hz</span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden">
              <canvas ref={synthMelodyRef} className="w-full h-full block" height={96} width={360} />
              <div className="absolute top-1 left-2 font-mono text-[9px] text-[#10B981]">
                STEREO WIDTH: 142% HAAS
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">16-STEP GATE STREAM</span>
              <span className="text-[#10B981] font-mono text-[10px] font-bold">
                STEP {String(activeStep + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 py-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((step) => {
                const isActive = activeStep === step;
                const isDownbeat = step % 4 === 0;
                return (
                  <div
                    key={step}
                    className={`h-2.5 rounded-xs transition-all ${
                      isActive
                        ? 'bg-[#DC2626] shadow-[0_0_10px_#DC2626] scale-105'
                        : isDownbeat
                        ? 'bg-[#10B981] shadow-[0_0_4px_#10B981]'
                        : 'bg-[#10B981]/30'
                    }`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between font-mono text-[9px] text-zinc-400">
              <span>GATE LENGTH: 65%</span>
              <span>SPECTRAL FLUX: 0.42</span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">MPE MULTI-AXIS SENSORS</span>
              <span className="text-[#4edea3] font-mono text-[10px] font-bold">PRESSURE: 82%</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px] text-center">
              <div className="keycap-hardware p-1 rounded">
                <span className="text-zinc-400 block">PRESSURE</span>
                <span className="text-[#10B981] font-bold">94 AT</span>
              </div>
              <div className="keycap-hardware p-1 rounded">
                <span className="text-zinc-400 block">PITCH X</span>
                <span className="text-[#4CD7F6] font-bold">+48 C</span>
              </div>
              <div className="keycap-hardware p-1 rounded">
                <span className="text-zinc-400 block">TIMBRE Y</span>
                <span className="text-[#DC2626] font-bold">CC#74</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>CHROMA VOICING SPECTRUM</span>
              <span className="text-[#10B981] font-mono text-[10px] font-bold">4-VOICE</span>
            </div>
            <div className="flex gap-1.5 text-center font-mono text-[10px]">
              <div className="flex-1 keycap-hardware p-1 rounded text-[#10B981] font-bold">C#3</div>
              <div className="flex-1 keycap-hardware p-1 rounded text-[#10B981] font-bold">G#3</div>
              <div className="flex-1 keycap-hardware p-1 rounded text-[#10B981] font-bold">C#4</div>
              <div className="flex-1 keycap-hardware p-1 rounded text-[#10B981] font-bold">E4</div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM REAL-TIME DIAGNOSTICS & AUDITION SECTION (Heavy Aluminum Chassis Base) */}
      <section className="rack-chassis rounded-lg p-4 flex flex-col xl:flex-row gap-4 shadow-2xl border border-[#2b303c] relative">
        <div className="absolute top-2 left-3"><span className="hex-screw" /></div>
        <div className="absolute top-2 right-3"><span className="hex-screw" /></div>
        <div className="absolute bottom-2 left-3"><span className="hex-screw" /></div>
        <div className="absolute bottom-2 right-3"><span className="hex-screw" /></div>

        {/* True Peak & Loudness Meters */}
        <div className="w-full xl:w-72 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-white">EBU R128 LOUDNESS</span>
            <span className="font-mono text-[10px] text-[#10B981] font-bold">BROADCAST SAFE</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-zinc-400">INTEGRATED</span>
              <span className="text-white font-bold">-14.1 LUFS</span>
            </div>
            <div className="w-full recessed-track h-2.5 rounded overflow-hidden p-0.5">
              <div className="bg-gradient-to-r from-[#10B981] to-[#34d399] h-full rounded w-[72%] shadow-[0_0_6px_#10B981]" />
            </div>

            <div className="flex justify-between font-mono text-xs">
              <span className="text-zinc-400">SHORT-TERM</span>
              <span className="text-[#4CD7F6] font-bold">-11.8 LUFS</span>
            </div>
            <div className="w-full recessed-track h-2.5 rounded overflow-hidden p-0.5">
              <div className="bg-gradient-to-r from-[#4CD7F6] to-[#38bdf8] h-full rounded w-[81%] shadow-[0_0_6px_#4CD7F6]" />
            </div>

            <div className="flex justify-between font-mono text-xs">
              <span className="text-zinc-400">MAX TRUE PEAK</span>
              <span className="text-[#DC2626] font-bold">-0.2 dBTP</span>
            </div>
            <div className="w-full recessed-track h-2.5 rounded overflow-hidden p-0.5">
              <div className="bg-gradient-to-r from-[#DC2626] to-[#f87171] h-full rounded w-[98%] shadow-[0_0_6px_#DC2626]" />
            </div>
          </div>

          <div className="flex justify-between font-mono text-[9px] text-zinc-400 pt-2">
            <span>LRA: <span className="text-white font-bold">6.4 LU</span></span>
            <span>DYNAMIC: <span className="text-[#4edea3]">DR12</span></span>
            <span>CEILING: <span className="text-[#DC2626] font-bold">0.0dB</span></span>
          </div>
        </div>

        {/* Stereo Goniometer / Lissajous Phase Scope */}
        <div className="w-full xl:w-72 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-white">LISSAJOUS PHASE</span>
            <span className="font-mono text-[10px] text-[#4CD7F6] font-bold">PHASE: +0.94</span>
          </div>
          <div className="h-32 w-full acrylic-screen rounded relative flex items-center justify-center overflow-hidden">
            <canvas ref={lissajousRef} className="w-full h-full block" height={128} width={240} />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
              <div className="w-24 h-24 rounded-full border border-dashed border-zinc-500" />
            </div>
          </div>
          <div className="flex justify-between font-mono text-[11px] text-zinc-400 pt-2">
            <span>L/R POLARITY: <span className="text-[#10B981] font-bold">SYNC</span></span>
            <span>STEREO WIDTH: <span className="text-white font-bold">118%</span></span>
          </div>
        </div>

        {/* Tactical Soundboard Audition Keys & Backlit Tactile Silicone Pads */}
        <div className="flex-1 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shadow-[0_0_10px_#DC2626]" />
              <span className="font-mono text-xs font-bold text-white">
                TACTICAL SOUNDBOARD AUDITION PADS
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">DUAL-SHOT SILICONE BUS</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 py-1">
            <button
              onClick={() => handleAuditionPad('PAD_01', 'vocals')}
              className={`tactile-pad hover:border-[#EC4899]/60 transition-all p-2.5 rounded-lg flex flex-col items-start gap-1 group cursor-pointer ${
                activePad === 'PAD_01' ? 'border-[#EC4899] shadow-[0_0_24px_#EC4899]' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#EC4899] font-bold">PAD 01</span>
                <span className="w-2 h-2 rounded-full bg-[#EC4899] group-hover:animate-ping shadow-[0_0_6px_#EC4899]" />
              </div>
              <span className="font-mono text-xs font-bold text-white">VOX BURST</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO + RESYNTH</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_02', 'drums')}
              className={`tactile-pad hover:border-[#F59E0B]/60 transition-all p-2.5 rounded-lg flex flex-col items-start gap-1 group cursor-pointer ${
                activePad === 'PAD_02' ? 'border-[#F59E0B] shadow-[0_0_24px_#F59E0B]' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#F59E0B] font-bold">PAD 02</span>
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] group-hover:animate-ping shadow-[0_0_6px_#F59E0B]" />
              </div>
              <span className="font-mono text-xs font-bold text-white">DRUM FLUX</span>
              <span className="font-mono text-[8px] text-zinc-400">MIDI HIT PULSE</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_03', 'bass')}
              className={`tactile-pad hover:border-[#06B6D4]/60 transition-all p-2.5 rounded-lg flex flex-col items-start gap-1 group cursor-pointer ${
                activePad === 'PAD_03' ? 'border-[#06B6D4] shadow-[0_0_24px_#06B6D4]' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#06B6D4] font-bold">PAD 03</span>
                <span className="w-2 h-2 rounded-full bg-[#06B6D4] group-hover:animate-ping shadow-[0_0_6px_#06B6D4]" />
              </div>
              <span className="font-mono text-xs font-bold text-white">SUB DIVE</span>
              <span className="font-mono text-[8px] text-zinc-400">34Hz MONO DROP</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_04', 'guitar')}
              className={`tactile-pad hover:border-[#DC2626]/60 transition-all p-2.5 rounded-lg flex flex-col items-start gap-1 group cursor-pointer ${
                activePad === 'PAD_04' ? 'border-[#DC2626] shadow-[0_0_24px_#DC2626]' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#DC2626] font-bold">PAD 04</span>
                <span className="w-2 h-2 rounded-full bg-[#DC2626] group-hover:animate-ping shadow-[0_0_6px_#DC2626]" />
              </div>
              <span className="font-mono text-xs font-bold text-white">GUITAR BITE</span>
              <span className="font-mono text-[8px] text-zinc-400">FRET STRUM HIT</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_05', 'piano')}
              className={`tactile-pad hover:border-[#4CD7F6]/60 transition-all p-2.5 rounded-lg flex flex-col items-start gap-1 group cursor-pointer ${
                activePad === 'PAD_05' ? 'border-[#4CD7F6] shadow-[0_0_24px_#4CD7F6]' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#4CD7F6] font-bold">PAD 05</span>
                <span className="w-2 h-2 rounded-full bg-[#4CD7F6] group-hover:animate-ping shadow-[0_0_6px_#4CD7F6]" />
              </div>
              <span className="font-mono text-xs font-bold text-white">PIANO CHORD</span>
              <span className="font-mono text-[8px] text-zinc-400">CC64 RESONANCE</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_06', 'other')}
              className={`tactile-pad hover:border-[#10B981]/60 transition-all p-2.5 rounded-lg flex flex-col items-start gap-1 group cursor-pointer ${
                activePad === 'PAD_06' ? 'border-[#10B981] shadow-[0_0_24px_#10B981]' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#10B981] font-bold">PAD 06</span>
                <span className="w-2 h-2 rounded-full bg-[#10B981] group-hover:animate-ping shadow-[0_0_6px_#10B981]" />
              </div>
              <span className="font-mono text-xs font-bold text-white">SYNTH SWEEP</span>
              <span className="font-mono text-[8px] text-zinc-400">ARP FREEZE GLIDE</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-zinc-400 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">AUTO-CAPTURE:</span>
              <button
                onClick={onDownloadZip}
                className="keycap-hardware px-2.5 py-1 rounded text-[#4CD7F6] hover:text-white transition-colors cursor-pointer"
              >
                STEM_EXPORT.ZIP
              </button>
              <button
                onClick={() => onExportStemMidi('all')}
                className="keycap-hardware px-2.5 py-1 rounded text-[#EC4899] hover:text-white transition-colors cursor-pointer"
              >
                POLY_MIDI.MID
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#DC2626] font-bold animate-pulse">● LIVE DSP READY</span>
              <span className="text-zinc-600">|</span>
              <span>96kHz / 32-BIT ENGINE</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
