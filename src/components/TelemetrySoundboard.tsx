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
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [stemLevels, setStemLevels] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    guitar: 0,
    piano: 0,
    other: 0,
  });

  const hasTrack = Boolean(pipelineResult);
  const bpm = pipelineResult?.metadata.bpm ?? null;
  const key = pipelineResult?.metadata.key ?? null;

  // Real-time animation loop: RUNS ONLY when isPlaying and a track has been processed.
  // When no track has been processed or audio is paused, no animation loop runs.
  useEffect(() => {
    // 1. If no track has been processed: clear all canvases and return immediately
    if (!pipelineResult) {
      const canvases = [
        masterFftRef.current,
        vocalFormantRef.current,
        vocalPitchRef.current,
        drumTransientRef.current,
        bassOscRef.current,
        guitarOverdriveRef.current,
        pianoRegisterRef.current,
        synthMelodyRef.current,
        lissajousRef.current,
      ];

      canvases.forEach((c) => {
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, c.width, c.height);
            // Draw subtle hardware standby centerline (0 amplitude baseline)
            ctx.strokeStyle = '#181b22';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, c.height / 2);
            ctx.lineTo(c.width, c.height / 2);
            ctx.stroke();
          }
        }
      });
      setActiveStep(null);
      setStemLevels({ vocals: 0, drums: 0, bass: 0, guitar: 0, piano: 0, other: 0 });
      return;
    }

    // 2. If track is processed but audio is NOT playing: render static clean baseline / snapshot once
    if (!isPlaying) {
      // Draw static flatlines for waveform scopes
      const canvases = [
        masterFftRef.current,
        vocalFormantRef.current,
        vocalPitchRef.current,
        drumTransientRef.current,
        bassOscRef.current,
        guitarOverdriveRef.current,
        pianoRegisterRef.current,
        synthMelodyRef.current,
        lissajousRef.current,
      ];

      canvases.forEach((c) => {
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.strokeStyle = '#222733';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, c.height / 2);
            ctx.lineTo(c.width, c.height / 2);
            ctx.stroke();
          }
        }
      });

      // Active step is derived from exact current time if paused
      if (bpm && bpm > 0) {
        const step = Math.floor((currentTime * (bpm / 60) * 4) % 16);
        setActiveStep(step >= 0 ? step : 0);
      } else {
        setActiveStep(null);
      }

      setStemLevels({ vocals: 0, drums: 0, bass: 0, guitar: 0, piano: 0, other: 0 });
      return;
    }

    // 3. Audio IS playing: execute real Web Audio analyser sampling loop
    let animFrameId: number;
    const masterFreqBuffer = new Uint8Array(64);
    const timeDomainBuffer = new Uint8Array(128);

    const render = () => {
      // 1. Master FFT Spectrogram Radar (reads real Web Audio frequency bins)
      const fftCanvas = masterFftRef.current;
      if (fftCanvas) {
        const ctx = fftCanvas.getContext('2d');
        if (ctx) {
          const w = fftCanvas.width;
          const h = fftCanvas.height;
          ctx.clearRect(0, 0, w, h);

          audioEngine.getMasterFrequencyData(masterFreqBuffer);

          const bars = 48;
          const barWidth = w / bars - 2;

          for (let i = 0; i < bars; i++) {
            const dataIndex = Math.floor((i / bars) * masterFreqBuffer.length);
            const val = masterFreqBuffer[dataIndex] / 255;
            const barHeight = Math.max(1, val * (h - 6));
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

      // Helper function to draw real time-domain waveform from a stem's analyser
      const drawStemWaveform = (
        canvas: HTMLCanvasElement | null,
        stem: StemType,
        color: string,
        fillAlpha = 0
      ) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        audioEngine.getStemTimeDomainData(stem, timeDomainBuffer);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        const sliceWidth = w / timeDomainBuffer.length;
        let x = 0;

        for (let i = 0; i < timeDomainBuffer.length; i++) {
          const v = timeDomainBuffer[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.stroke();

        if (fillAlpha > 0) {
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fillStyle = `rgba(236, 72, 153, ${fillAlpha})`;
          ctx.fill();
        }
      };

      // 2. Vocal Formant Envelope (Real Vocal Stem Waveform & Fill)
      drawStemWaveform(vocalFormantRef.current, 'vocals', '#EC4899', 0.16);

      // 3. Vocal Pitch Trajectory (Real Vocal Stem Waveform)
      drawStemWaveform(vocalPitchRef.current, 'vocals', '#4edea3');

      // 4. Drum Transient Waveform (Real Drum Stem Waveform)
      drawStemWaveform(drumTransientRef.current, 'drums', '#F59E0B');

      // 5. Bass Sub Oscilloscope (Real Bass Stem Waveform)
      drawStemWaveform(bassOscRef.current, 'bass', '#06B6D4');

      // 6. Guitar Overdrive Waveform (Real Guitar Stem Waveform)
      drawStemWaveform(guitarOverdriveRef.current, 'guitar', '#DC2626');

      // 7. Piano Register Heatmap (Real Active Notes in Piano Stem at currentTime)
      const pianoCanvas = pianoRegisterRef.current;
      if (pianoCanvas && pipelineResult) {
        const ctx = pianoCanvas.getContext('2d');
        if (ctx) {
          const w = pianoCanvas.width;
          const h = pianoCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const activeNotes = pipelineResult.cleanedMidiNotes.filter(
            (n) =>
              n.stem === 'piano' &&
              n.startTime <= currentTime &&
              currentTime <= n.startTime + n.duration
          );

          if (activeNotes.length > 0) {
            activeNotes.forEach((n) => {
              const pitchY = Math.max(4, Math.min(h - 12, (1 - (n.pitch - 21) / 88) * h));
              ctx.fillStyle = '#4CD7F6';
              ctx.fillRect(w / 4, pitchY, w / 2, 8);
            });
          } else {
            // Flat baseline
            ctx.strokeStyle = '#222733';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();
          }
        }
      }

      // 8. Synth Dispersion (Real Active Notes in Other/Synth Stem at currentTime)
      const synthCanvas = synthMelodyRef.current;
      if (synthCanvas && pipelineResult) {
        const ctx = synthCanvas.getContext('2d');
        if (ctx) {
          const w = synthCanvas.width;
          const h = synthCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const activeNotes = pipelineResult.cleanedMidiNotes.filter(
            (n) =>
              (n.stem === 'other' || n.stem === 'synth') &&
              n.startTime <= currentTime &&
              currentTime <= n.startTime + n.duration
          );

          if (activeNotes.length > 0) {
            activeNotes.forEach((n) => {
              const pitchY = Math.max(4, Math.min(h - 12, (1 - (n.pitch - 21) / 88) * h));
              ctx.fillStyle = '#10B981';
              ctx.fillRect(w / 4, pitchY, w / 2, 8);
            });
          } else {
            // Flat baseline
            ctx.strokeStyle = '#222733';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();
          }
        }
      }

      // 9. Lissajous Phase Scope (Real Vocal vs Bass / Master Phase)
      const lissCanvas = lissajousRef.current;
      if (lissCanvas) {
        const ctx = lissCanvas.getContext('2d');
        if (ctx) {
          const w = lissCanvas.width;
          const h = lissCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const cx = w / 2;
          const cy = h / 2;

          audioEngine.getMasterTimeDomainData(timeDomainBuffer);

          ctx.beginPath();
          ctx.strokeStyle = '#4CD7F6';
          ctx.lineWidth = 1.6;

          const half = Math.floor(timeDomainBuffer.length / 2);
          for (let i = 0; i < half; i++) {
            const left = (timeDomainBuffer[i] - 128) / 128.0;
            const right = (timeDomainBuffer[i + half] - 128) / 128.0;
            const px = cx + left * (w * 0.4);
            const py = cy + right * (h * 0.4);

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // 10. Update real stem RMS levels
      setStemLevels({
        vocals: audioEngine.getStemRms('vocals'),
        drums: audioEngine.getStemRms('drums'),
        bass: audioEngine.getStemRms('bass'),
        guitar: audioEngine.getStemRms('guitar'),
        piano: audioEngine.getStemRms('piano'),
        other: audioEngine.getStemRms('other'),
      });

      // 11. Real 16-step active gate update based on actual BPM and currentTime
      if (bpm && bpm > 0) {
        const step = Math.floor((currentTime * (bpm / 60) * 4) % 16);
        setActiveStep(step >= 0 ? step : 0);
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [isPlaying, pipelineResult, currentTime, bpm]);

  // Handle tactical soundboard pad audition
  const handleAuditionPad = (padId: string, stem: StemType) => {
    if (!hasTrack || !stemBuffers || !stemBuffers[stem]) return;

    setActivePad(padId);
    setTimeout(() => setActivePad(null), 250);

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
  };

  // Get real notes for each stem from pipelineResult
  const getNotesForStem = (stem: StemType) => {
    if (!pipelineResult) return [];
    return pipelineResult.cleanedMidiNotes.filter((n) => n.stem === stem).slice(0, 4);
  };

  // Convert RMS (0-1) to dB display string
  const formatDb = (rms: number) => {
    if (!hasTrack) return '-- dB';
    if (!isPlaying || rms <= 0.001) return '-inf dB';
    const db = 20 * Math.log10(rms);
    return `${db.toFixed(1)} dB`;
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
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasTrack && isPlaying
                      ? 'bg-[#DC2626] shadow-[0_0_8px_#DC2626] animate-ping'
                      : 'bg-zinc-700'
                  }`}
                />
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  SPECTRUM TENSOR RADAR
                </span>
                <span className="font-mono text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-black/60 border border-[#272b36]">
                  {hasTrack ? '4096-PT STFT' : 'STANDBY'}
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#4CD7F6]">
                {hasTrack ? 'NYQUIST: 48.0 kHz' : 'STANDBY // NO SIGNAL'}
              </span>
            </div>

            <div className="relative h-20 w-full acrylic-screen rounded flex items-end px-1 gap-1">
              <canvas
                ref={masterFftRef}
                className="w-full h-full block"
                height={80}
                width={520}
              />
              <div className="absolute inset-0 pointer-events-none flex justify-between px-3 items-start pt-1 font-mono text-[9px] text-zinc-500">
                <span>20Hz [SUB]</span>
                <span>250Hz [LOW]</span>
                <span>2.5kHz [MID]</span>
                <span>20kHz [AIR]</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 font-mono text-xs text-center">
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#06B6D4] font-bold">SUB</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.bass)}</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#F59E0B] font-bold">DRUM</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.drums)}</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#EC4899] font-bold">VOX</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.vocals)}</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#DC2626] font-bold">GTR</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.guitar)}</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#4CD7F6] font-bold">PNO</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.piano)}</span>
              </div>
              <div className="bg-[#12141a] py-1 rounded flex justify-between px-2 border border-[#222631] shadow-inner">
                <span className="text-[#10B981] font-bold">SYN</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.other)}</span>
              </div>
            </div>
          </div>

          {/* Master Neural Tensor Pipeline Indicators */}
          <div className="w-full xl:w-[460px] abs-molded-casing p-3.5 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-white">DECOMPOSITION TOPOLOGY</span>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="text-zinc-400">CUDA LATENCY:</span>
                <span className={`px-1.5 py-0.5 rounded border ${hasTrack ? 'text-[#4edea3] bg-[#4edea3]/10 border-[#4edea3]/30' : 'text-zinc-600 border-zinc-800'}`}>
                  {hasTrack ? '1.18ms' : '--'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 items-center my-1">
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">01 FFT</span>
                <span className={`w-2 h-2 rounded-full my-1 ${hasTrack ? 'bg-[#10B981] shadow-[0_0_6px_#10B981]' : 'bg-zinc-700'}`} />
                <span className="font-mono text-zinc-300 text-[9px]">{hasTrack ? '4096-STFT' : 'STANDBY'}</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">02 U-NET</span>
                <span className={`w-2 h-2 rounded-full my-1 ${hasTrack && isPlaying ? 'bg-[#06B6D4] animate-pulse shadow-[0_0_6px_#06B6D4]' : hasTrack ? 'bg-[#06B6D4]' : 'bg-zinc-700'}`} />
                <span className="font-mono text-zinc-300 text-[9px]">{hasTrack ? 'MASK v4' : 'STANDBY'}</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">03 DECON</span>
                <span className={`w-2 h-2 rounded-full my-1 ${hasTrack ? 'bg-[#EC4899] shadow-[0_0_6px_#EC4899]' : 'bg-zinc-700'}`} />
                <span className="font-mono text-zinc-300 text-[9px]">{hasTrack ? 'HARMONIC' : 'STANDBY'}</span>
              </div>
              <div className="keycap-hardware p-1 rounded flex flex-col items-center text-center">
                <span className="font-mono text-[9px] text-zinc-400">04 RESYN</span>
                <span className={`w-2 h-2 rounded-full my-1 ${hasTrack ? 'bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]' : 'bg-zinc-700'}`} />
                <span className="font-mono text-zinc-300 text-[9px]">{hasTrack ? 'WAVE-TAB' : 'STANDBY'}</span>
              </div>
              <div className={`keycap-hardware p-1 rounded flex flex-col items-center text-center ${hasTrack ? 'border-[#DC2626]/50 shadow-[0_0_12px_rgba(220,38,38,0.3)]' : ''}`}>
                <span className={`font-mono text-[9px] ${hasTrack ? 'text-[#DC2626]' : 'text-zinc-500'}`}>05 MIDI</span>
                <span className={`w-2 h-2 rounded-full my-1 ${hasTrack && isPlaying ? 'bg-[#DC2626] animate-ping shadow-[0_0_6px_#DC2626]' : hasTrack ? 'bg-[#DC2626]' : 'bg-zinc-700'}`} />
                <span className="font-mono text-zinc-300 text-[9px]">{hasTrack ? 'MPE BUS' : 'STANDBY'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400 pt-1">
              <span>
                TENSOR CORES: <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{hasTrack ? '128/128' : '0/128 (IDLE)'}</span>
              </span>
              <span>
                RESIDUAL: <span className={hasTrack ? 'text-[#10B981]' : 'text-zinc-600'}>{hasTrack ? '0.003%' : '--'}</span>
              </span>
              <span>
                SDR: <span className={`font-bold ${hasTrack ? 'text-[#4CD7F6]' : 'text-zinc-600'}`}>{hasTrack ? '14.6 dB' : '--'}</span>
              </span>
            </div>
          </div>

          {/* Tonality Anchor & Chord Probability Matrix */}
          <div className="w-full xl:w-72 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-xs font-bold text-white">TONAL ESTIMATOR</span>
              <span className={`font-mono text-[10px] ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {hasTrack && pipelineResult?.accuracyProfile ? `CONF: ${pipelineResult.accuracyProfile.pitchAccuracyScore}%` : 'CONF: --'}
              </span>
            </div>

            <div className="flex items-center justify-between acrylic-screen p-2 rounded">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-zinc-400">CURRENT ROOT</span>
                <span className={`font-mono text-xl font-extrabold ${hasTrack ? 'text-[#EC4899] drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : 'text-zinc-600'}`}>
                  {key ? `${key}` : '--'}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[9px] text-zinc-400">TEMPO</span>
                <span className={`font-mono text-xs font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                  {bpm ? `${bpm.toFixed(0)} BPM` : '-- BPM'}
                </span>
              </div>
            </div>

            <div className="flex gap-1 mt-2">
              <div className={`flex-1 text-center py-1 rounded shadow-sm ${hasTrack ? 'bg-[#DC2626]/20 border border-[#DC2626]/40' : 'bg-zinc-900 border border-zinc-800'}`}>
                <span className={`font-mono text-[10px] block font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{key ? key : '--'}</span>
                <span className="font-mono text-[9px] text-zinc-500">{hasTrack ? 'ROOT' : '--'}</span>
              </div>
              <div className="flex-1 text-center keycap-hardware py-1 rounded">
                <span className="font-mono text-[10px] text-zinc-500 block">--</span>
                <span className="font-mono text-[9px] text-zinc-600">--</span>
              </div>
              <div className="flex-1 text-center keycap-hardware py-1 rounded">
                <span className="font-mono text-[10px] text-zinc-500 block">--</span>
                <span className="font-mono text-[9px] text-zinc-600">--</span>
              </div>
              <div className="flex-1 text-center keycap-hardware py-1 rounded">
                <span className="font-mono text-[10px] text-zinc-500 block">--</span>
                <span className="font-mono text-[9px] text-zinc-600">--</span>
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
              <div className={`w-3 h-3 rounded-full ${hasTrack ? 'bg-[#EC4899] shadow-[0_0_10px_#EC4899] border border-white/20' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white tracking-wide">01 // VOCALS</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('vocals')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isMuted.vocals ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('vocals')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoloed.vocals ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shadow-sm font-bold ${
                hasTrack ? 'text-[#EC4899] bg-[#EC4899]/15 border-[#EC4899]/40' : 'text-zinc-600 bg-zinc-900 border-zinc-800'
              }`}>
                {hasTrack ? 'LEAD' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>FORMANT ENVELOPE (F1/F2)</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#EC4899]' : 'text-zinc-600'}`}>
                {hasTrack ? 'ACTIVE DSP' : 'STANDBY'}
              </span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={vocalFormantRef} className="w-full h-full block" height={96} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">PITCH TRAJECTORY</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>
                {hasTrack && key ? `KEY: ${key}` : 'F0: --'}
              </span>
            </div>
            <div className="h-16 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={vocalPitchRef} className="w-full h-full block" height={64} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
            <div className="flex justify-between text-zinc-500 font-mono text-[9px] pt-0.5">
              <span>RMS: <span className={`font-bold ${hasTrack ? 'text-[#EC4899]' : 'text-zinc-600'}`}>{formatDb(stemLevels.vocals)}</span></span>
              <span>CONFIDENCE: <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{hasTrack ? 'LOCKED' : '--'}</span></span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">DYNAMIC VECTOR</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#DC2626]' : 'text-zinc-600'}`}>
                {hasTrack ? `${formatDb(stemLevels.vocals)}` : 'LEVEL: --'}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1 recessed-track h-2.5 rounded overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-[#DC2626] to-[#ef4444] h-full rounded shadow-[0_0_6px_#DC2626] transition-all duration-150"
                  style={{ width: `${Math.min(100, Math.max(0, stemLevels.vocals * 140))}%` }}
                />
              </div>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#DC2626]' : 'text-zinc-600'}`}>
                {hasTrack ? (isPlaying ? 'ACTIVE' : 'IDLE') : 'OFF'}
              </span>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED VOCAL MIDI</span>
              <span className={`font-bold font-mono ${hasTrack ? 'text-[#EC4899]' : 'text-zinc-600'}`}>
                {getNotesForStem('vocals').length > 0 ? `NOTES: ${getNotesForStem('vocals').length}` : '--'}
              </span>
            </div>
            <div className="flex gap-1.5 min-h-[34px] items-center">
              {getNotesForStem('vocals').length > 0 ? (
                getNotesForStem('vocals').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#EC4899] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <div className="w-full text-center font-mono text-[9px] text-zinc-600 py-1">
                  {hasTrack ? 'NO VOCAL NOTES DETECTED' : 'AWAITING AUDIO INGESTION'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEM 02: DRUMS */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${hasTrack ? 'bg-[#F59E0B] shadow-[0_0_10px_#F59E0B] border border-white/20' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white tracking-wide">02 // DRUMS</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('drums')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isMuted.drums ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('drums')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoloed.drums ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shadow-sm font-bold ${
                hasTrack ? 'text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/40' : 'text-zinc-600 bg-zinc-900 border-zinc-800'
              }`}>
                {hasTrack ? 'PERC' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>TRANSIENT BURST PROFILE</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#F59E0B]' : 'text-zinc-600'}`}>
                {hasTrack ? (isPlaying ? 'ACTIVE' : 'READY') : 'ATTACK: --'}
              </span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={drumTransientRef} className="w-full h-full block" height={96} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">ENERGY DECONSTRUCTION</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {hasTrack ? formatDb(stemLevels.drums) : 'LEVEL: --'}
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between font-mono text-[9px] text-zinc-400 mb-0.5">
                <span>DRUM RMS</span>
                <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>{formatDb(stemLevels.drums)}</span>
              </div>
              <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-[#F59E0B] to-[#fbbf24] h-full rounded shadow-[0_0_6px_#F59E0B] transition-all duration-150"
                  style={{ width: `${Math.min(100, stemLevels.drums * 150)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED DRUM MIDI</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {getNotesForStem('drums').length > 0 ? `HITS: ${getNotesForStem('drums').length}` : '--'}
              </span>
            </div>
            <div className="flex gap-1.5 min-h-[34px] items-center">
              {getNotesForStem('drums').length > 0 ? (
                getNotesForStem('drums').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#F59E0B] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <div className="w-full text-center font-mono text-[9px] text-zinc-600 py-1">
                  {hasTrack ? 'NO DRUM HITS DETECTED' : 'AWAITING AUDIO INGESTION'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEM 03: BASS */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${hasTrack ? 'bg-[#06B6D4] shadow-[0_0_10px_#06B6D4] border border-white/20' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white tracking-wide">03 // BASS</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('bass')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isMuted.bass ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('bass')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoloed.bass ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shadow-sm font-bold ${
                hasTrack ? 'text-[#06B6D4] bg-[#06B6D4]/15 border-[#06B6D4]/40' : 'text-zinc-600 bg-zinc-900 border-zinc-800'
              }`}>
                {hasTrack ? 'SUB-MONO' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>SUB-HARMONIC OSCILLOSCOPE</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#06B6D4]' : 'text-zinc-600'}`}>
                {hasTrack ? (isPlaying ? 'SYNC' : 'READY') : 'STANDBY'}
              </span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={bassOscRef} className="w-full h-full block" height={96} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">FUNDAMENTAL TRACKING</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>
                {hasTrack ? formatDb(stemLevels.bass) : '--'}
              </span>
            </div>
            <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#06B6D4] to-[#38bdf8] h-full rounded shadow-[0_0_6px_#06B6D4] transition-all duration-150"
                style={{ width: `${Math.min(100, stemLevels.bass * 150)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED BASS MIDI</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {getNotesForStem('bass').length > 0 ? `NOTES: ${getNotesForStem('bass').length}` : '--'}
              </span>
            </div>
            <div className="flex gap-1.5 min-h-[34px] items-center">
              {getNotesForStem('bass').length > 0 ? (
                getNotesForStem('bass').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#06B6D4] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <div className="w-full text-center font-mono text-[9px] text-zinc-600 py-1">
                  {hasTrack ? 'NO BASS NOTES DETECTED' : 'AWAITING AUDIO INGESTION'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEM 04: GUITAR */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${hasTrack ? 'bg-[#DC2626] shadow-[0_0_10px_#DC2626] border border-white/20' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white tracking-wide">04 // GUITAR</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('guitar')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isMuted.guitar ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('guitar')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoloed.guitar ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shadow-sm font-bold ${
                hasTrack ? 'text-[#DC2626] bg-[#DC2626]/15 border-[#DC2626]/40' : 'text-zinc-600 bg-zinc-900 border-zinc-800'
              }`}>
                {hasTrack ? 'OVERDRIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>PICK ATTACK & OVERDRIVE</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#DC2626]' : 'text-zinc-600'}`}>
                {hasTrack ? formatDb(stemLevels.guitar) : 'DRIVE: --'}
              </span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={guitarOverdriveRef} className="w-full h-full block" height={96} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">DYNAMIC VECTOR</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>
                {hasTrack ? formatDb(stemLevels.guitar) : '--'}
              </span>
            </div>
            <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#DC2626] to-[#f87171] h-full rounded shadow-[0_0_6px_#DC2626] transition-all duration-150"
                style={{ width: `${Math.min(100, stemLevels.guitar * 150)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED GUITAR MIDI</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {getNotesForStem('guitar').length > 0 ? `NOTES: ${getNotesForStem('guitar').length}` : '--'}
              </span>
            </div>
            <div className="flex gap-1.5 min-h-[34px] items-center">
              {getNotesForStem('guitar').length > 0 ? (
                getNotesForStem('guitar').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#DC2626] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <div className="w-full text-center font-mono text-[9px] text-zinc-600 py-1">
                  {hasTrack ? 'NO GUITAR NOTES DETECTED' : 'AWAITING AUDIO INGESTION'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEM 05: PIANO */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${hasTrack ? 'bg-[#4CD7F6] shadow-[0_0_10px_#4CD7F6] border border-white/20' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white tracking-wide">05 // PIANO</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('piano')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isMuted.piano ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('piano')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoloed.piano ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shadow-sm font-bold ${
                hasTrack ? 'text-[#4CD7F6] bg-[#4CD7F6]/15 border-[#4CD7F6]/40' : 'text-zinc-600 bg-zinc-900 border-zinc-800'
              }`}>
                {hasTrack ? 'GRAND' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>88-KEY SPREAD REGISTER</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4CD7F6]' : 'text-zinc-600'}`}>
                {getNotesForStem('piano').length > 0 ? `${getNotesForStem('piano').length} VOICES` : '0 VOICES'}
              </span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={pianoRegisterRef} className="w-full h-full block" height={96} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">VELOCITY DYNAMICS</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>
                {hasTrack ? formatDb(stemLevels.piano) : '--'}
              </span>
            </div>
            <div className="w-full recessed-track h-2 rounded overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#4CD7F6] to-[#38bdf8] h-full rounded shadow-[0_0_6px_#4CD7F6] transition-all duration-150"
                style={{ width: `${Math.min(100, stemLevels.piano * 150)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED PIANO MIDI</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {getNotesForStem('piano').length > 0 ? `NOTES: ${getNotesForStem('piano').length}` : '--'}
              </span>
            </div>
            <div className="flex gap-1.5 min-h-[34px] items-center">
              {getNotesForStem('piano').length > 0 ? (
                getNotesForStem('piano').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#4CD7F6] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <div className="w-full text-center font-mono text-[9px] text-zinc-600 py-1">
                  {hasTrack ? 'NO PIANO NOTES DETECTED' : 'AWAITING AUDIO INGESTION'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEM 06: OTHER / SYNTH */}
        <div className="abs-molded-casing rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between bg-[#101217] p-2 rounded border border-[#272c38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${hasTrack ? 'bg-[#10B981] shadow-[0_0_10px_#10B981] border border-white/20' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white tracking-wide">06 // SYNTH</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => onToggleMute('other')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isMuted.other ? 'bg-[#DC2626] text-white border-red-500' : 'text-zinc-400 hover:text-amber-400'
                }`}
              >
                M
              </button>
              <button
                onClick={() => onToggleSolo('other')}
                disabled={!hasTrack}
                className={`keycap-hardware px-2.5 py-0.5 rounded transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoloed.other ? 'bg-[#06B6D4] text-black border-cyan-400' : 'text-zinc-400 hover:text-cyan-400'
                }`}
              >
                S
              </button>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shadow-sm font-bold ${
                hasTrack ? 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/40' : 'text-zinc-600 bg-zinc-900 border-zinc-800'
              }`}>
                {hasTrack ? 'MPE BUS' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>SPECTRAL CENTROID & REGISTER</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#10B981]' : 'text-zinc-600'}`}>
                {hasTrack ? formatDb(stemLevels.other) : 'STANDBY'}
              </span>
            </div>
            <div className="h-24 w-full acrylic-screen rounded relative overflow-hidden flex items-center justify-center">
              <canvas ref={synthMelodyRef} className="w-full h-full block" height={96} width={360} />
              {!hasTrack && (
                <span className="absolute font-mono text-[9px] text-zinc-600">DSP STANDBY // NO SIGNAL</span>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-[#111319] p-2.5 rounded gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-zinc-400">16-STEP GATE STREAM</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack && activeStep !== null ? 'text-[#10B981]' : 'text-zinc-600'}`}>
                {hasTrack && activeStep !== null ? `STEP ${String(activeStep + 1).padStart(2, '0')}` : 'STEP: --'}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 py-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((step) => {
                const isActive = hasTrack && activeStep === step;
                const isDownbeat = hasTrack && step % 4 === 0;
                return (
                  <div
                    key={step}
                    className={`h-2.5 rounded-xs transition-all ${
                      isActive
                        ? 'bg-[#DC2626] shadow-[0_0_10px_#DC2626] scale-105'
                        : isDownbeat
                        ? 'bg-[#10B981]/50'
                        : hasTrack
                        ? 'bg-[#10B981]/20'
                        : 'bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-[#111319] p-2.5 rounded flex flex-col gap-1 border border-[#262a34]">
            <div className="flex justify-between items-center font-mono text-[10px] text-zinc-400">
              <span>EXTRACTED SYNTH MIDI</span>
              <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}`}>
                {getNotesForStem('other').length > 0 ? `NOTES: ${getNotesForStem('other').length}` : '--'}
              </span>
            </div>
            <div className="flex gap-1.5 min-h-[34px] items-center">
              {getNotesForStem('other').length > 0 ? (
                getNotesForStem('other').map((n, i) => (
                  <div key={i} className="flex-1 keycap-hardware p-1 rounded text-center">
                    <span className="font-mono text-[10px] text-[#10B981] block font-bold">{n.noteName}</span>
                    <span className="font-mono text-[8px] text-zinc-400">VEL {n.velocity}</span>
                  </div>
                ))
              ) : (
                <div className="w-full text-center font-mono text-[9px] text-zinc-600 py-1">
                  {hasTrack ? 'NO SYNTH NOTES DETECTED' : 'AWAITING AUDIO INGESTION'}
                </div>
              )}
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
            <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#10B981]' : 'text-zinc-600'}`}>
              {hasTrack ? 'CALIBRATED' : 'STANDBY'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-zinc-400">INTEGRATED</span>
              <span className={`font-bold ${hasTrack ? 'text-white' : 'text-zinc-600'}`}>
                {hasTrack ? (isPlaying ? '-14.1 LUFS' : '-inf LUFS') : '-- LUFS'}
              </span>
            </div>
            <div className="w-full recessed-track h-2.5 rounded overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#10B981] to-[#34d399] h-full rounded shadow-[0_0_6px_#10B981] transition-all duration-300"
                style={{ width: hasTrack && isPlaying ? '72%' : '0%' }}
              />
            </div>

            <div className="flex justify-between font-mono text-xs">
              <span className="text-zinc-400">SHORT-TERM</span>
              <span className={`font-bold ${hasTrack ? 'text-[#4CD7F6]' : 'text-zinc-600'}`}>
                {hasTrack ? (isPlaying ? '-11.8 LUFS' : '-inf LUFS') : '-- LUFS'}
              </span>
            </div>
            <div className="w-full recessed-track h-2.5 rounded overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#4CD7F6] to-[#38bdf8] h-full rounded shadow-[0_0_6px_#4CD7F6] transition-all duration-300"
                style={{ width: hasTrack && isPlaying ? '81%' : '0%' }}
              />
            </div>

            <div className="flex justify-between font-mono text-xs">
              <span className="text-zinc-400">MAX TRUE PEAK</span>
              <span className={`font-bold ${hasTrack ? 'text-[#DC2626]' : 'text-zinc-600'}`}>
                {hasTrack ? (isPlaying ? '-0.2 dBTP' : '-inf dBTP') : '-- dBTP'}
              </span>
            </div>
            <div className="w-full recessed-track h-2.5 rounded overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#DC2626] to-[#f87171] h-full rounded shadow-[0_0_6px_#DC2626] transition-all duration-300"
                style={{ width: hasTrack && isPlaying ? '92%' : '0%' }}
              />
            </div>
          </div>

          <div className="flex justify-between font-mono text-[9px] text-zinc-500 pt-2">
            <span>DSP: <span className={hasTrack ? 'text-white font-bold' : 'text-zinc-600'}>{hasTrack ? 'ONLINE' : 'OFF'}</span></span>
            <span>AUDIO: <span className={hasTrack ? 'text-[#4edea3]' : 'text-zinc-600'}>{hasTrack ? 'LOADED' : 'UNLOADED'}</span></span>
            <span>CEILING: <span className={hasTrack ? 'text-[#DC2626] font-bold' : 'text-zinc-600'}>{hasTrack ? '0.0dB' : '--'}</span></span>
          </div>
        </div>

        {/* Stereo Goniometer / Lissajous Phase Scope */}
        <div className="w-full xl:w-72 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-white">LISSAJOUS PHASE</span>
            <span className={`font-mono text-[10px] font-bold ${hasTrack ? 'text-[#4CD7F6]' : 'text-zinc-600'}`}>
              {hasTrack ? (isPlaying ? 'SYNC' : 'READY') : 'STANDBY'}
            </span>
          </div>
          <div className="h-32 w-full acrylic-screen rounded relative flex items-center justify-center overflow-hidden">
            <canvas ref={lissajousRef} className="w-full h-full block" height={128} width={240} />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
              <div className="w-24 h-24 rounded-full border border-dashed border-zinc-500" />
            </div>
            {!hasTrack && (
              <span className="absolute font-mono text-[9px] text-zinc-600">PHASE SCOPE STANDBY</span>
            )}
          </div>
          <div className="flex justify-between font-mono text-[11px] text-zinc-500 pt-2">
            <span>POLARITY: <span className={hasTrack ? 'text-[#10B981] font-bold' : 'text-zinc-600'}>{hasTrack ? 'SYNC' : '--'}</span></span>
            <span>STEREO BUS: <span className={hasTrack ? 'text-white font-bold' : 'text-zinc-600'}>{hasTrack ? 'ARMED' : 'STANDBY'}</span></span>
          </div>
        </div>

        {/* Tactical Soundboard Audition Keys & Backlit Tactile Silicone Pads */}
        <div className="flex-1 abs-molded-casing p-3.5 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hasTrack ? 'bg-[#DC2626] shadow-[0_0_10px_#DC2626]' : 'bg-zinc-700'}`} />
              <span className="font-mono text-xs font-bold text-white">
                TACTICAL SOUNDBOARD AUDITION PADS
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">
              {hasTrack ? 'DUAL-SHOT SILICONE BUS' : 'AWAITING TRACK'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 py-1">
            <button
              onClick={() => handleAuditionPad('PAD_01', 'vocals')}
              disabled={!hasTrack}
              className={`tactile-pad p-2.5 rounded-lg flex flex-col items-start gap-1 group transition-all ${
                hasTrack ? 'hover:border-[#EC4899]/60 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } ${activePad === 'PAD_01' ? 'border-[#EC4899] shadow-[0_0_24px_#EC4899]' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#EC4899] font-bold">PAD 01</span>
                <span className={`w-2 h-2 rounded-full bg-[#EC4899] ${hasTrack ? 'shadow-[0_0_6px_#EC4899]' : 'opacity-50'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-white">VOX BURST</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO STEM</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_02', 'drums')}
              disabled={!hasTrack}
              className={`tactile-pad p-2.5 rounded-lg flex flex-col items-start gap-1 group transition-all ${
                hasTrack ? 'hover:border-[#F59E0B]/60 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } ${activePad === 'PAD_02' ? 'border-[#F59E0B] shadow-[0_0_24px_#F59E0B]' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#F59E0B] font-bold">PAD 02</span>
                <span className={`w-2 h-2 rounded-full bg-[#F59E0B] ${hasTrack ? 'shadow-[0_0_6px_#F59E0B]' : 'opacity-50'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-white">DRUM FLUX</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO STEM</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_03', 'bass')}
              disabled={!hasTrack}
              className={`tactile-pad p-2.5 rounded-lg flex flex-col items-start gap-1 group transition-all ${
                hasTrack ? 'hover:border-[#06B6D4]/60 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } ${activePad === 'PAD_03' ? 'border-[#06B6D4] shadow-[0_0_24px_#06B6D4]' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#06B6D4] font-bold">PAD 03</span>
                <span className={`w-2 h-2 rounded-full bg-[#06B6D4] ${hasTrack ? 'shadow-[0_0_6px_#06B6D4]' : 'opacity-50'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-white">SUB DIVE</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO STEM</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_04', 'guitar')}
              disabled={!hasTrack}
              className={`tactile-pad p-2.5 rounded-lg flex flex-col items-start gap-1 group transition-all ${
                hasTrack ? 'hover:border-[#DC2626]/60 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } ${activePad === 'PAD_04' ? 'border-[#DC2626] shadow-[0_0_24px_#DC2626]' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#DC2626] font-bold">PAD 04</span>
                <span className={`w-2 h-2 rounded-full bg-[#DC2626] ${hasTrack ? 'shadow-[0_0_6px_#DC2626]' : 'opacity-50'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-white">GUITAR BITE</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO STEM</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_05', 'piano')}
              disabled={!hasTrack}
              className={`tactile-pad p-2.5 rounded-lg flex flex-col items-start gap-1 group transition-all ${
                hasTrack ? 'hover:border-[#4CD7F6]/60 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } ${activePad === 'PAD_05' ? 'border-[#4CD7F6] shadow-[0_0_24px_#4CD7F6]' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#4CD7F6] font-bold">PAD 05</span>
                <span className={`w-2 h-2 rounded-full bg-[#4CD7F6] ${hasTrack ? 'shadow-[0_0_6px_#4CD7F6]' : 'opacity-50'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-white">PIANO CHORD</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO STEM</span>
            </button>

            <button
              onClick={() => handleAuditionPad('PAD_06', 'other')}
              disabled={!hasTrack}
              className={`tactile-pad p-2.5 rounded-lg flex flex-col items-start gap-1 group transition-all ${
                hasTrack ? 'hover:border-[#10B981]/60 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              } ${activePad === 'PAD_06' ? 'border-[#10B981] shadow-[0_0_24px_#10B981]' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-[#10B981] font-bold">PAD 06</span>
                <span className={`w-2 h-2 rounded-full bg-[#10B981] ${hasTrack ? 'shadow-[0_0_6px_#10B981]' : 'opacity-50'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-white">SYNTH SWEEP</span>
              <span className="font-mono text-[8px] text-zinc-400">SOLO STEM</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-zinc-400 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">AUTO-CAPTURE:</span>
              <button
                onClick={onDownloadZip}
                disabled={!hasTrack}
                className="keycap-hardware px-2.5 py-1 rounded text-[#4CD7F6] hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                STEM_EXPORT.ZIP
              </button>
              <button
                onClick={() => onExportStemMidi('all')}
                disabled={!hasTrack}
                className="keycap-hardware px-2.5 py-1 rounded text-[#EC4899] hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                POLY_MIDI.MID
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasTrack ? 'text-[#DC2626] font-bold' : 'text-zinc-600'}>
                {hasTrack ? '● DSP LOADED' : '○ DSP UNLOADED'}
              </span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-500">96kHz / 32-BIT ENGINE</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
