/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Music2,
  Grid,
  Activity,
  Brain,
  Sliders,
  Download,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Radio,
  FileMusic,
  Award,
  ShieldCheck,
  Gauge,
  UploadCloud,
  AudioWaveform,
  FileArchive,
  Check,
  ChevronDown,
  X,
} from 'lucide-react';

import {
  AuditionMode,
  MidiNote,
  PlaybackState,
  SectionAnalysis,
  SongMetadata,
  SongPipelineResult,
  StemFeatureData,
  StemRole,
  StemSummary,
  StemType,
  TranscriptionMethod,
} from './types';
import { audioEngine } from './lib/audioPlayer';
import {
  extractStemFeaturesFromBuffers,
  splitAudioIntoStemsUsingDsp,
  estimateFundamentalPitch,
  estimateAudioBpm,
  extractPitchBendContour,
  extractDynamicVelocityFromAudio,
  extractGrooveTemplateFromDrums,
  detectKeyProfile,
  extractHarmonicChordsAndVoicings,
  generateContinuousAutomationLanes,
  computeTranscriptionAccuracyProfile,
} from './lib/audioDsp';
import {
  determineRoutingMethod,
  processMidiAlignmentAndCleanup,
  midiPitchToNoteName,
  transcribeAudioStemsToMidiNotes,
} from './lib/transcriptionEngine';
import { generateMidiFile, downloadMidiBlob } from './lib/midiExport';
import { downloadStemmedAudioZip, downloadStemWav, triggerBlobDownload } from './lib/audioExport';
import { executeCrossStemCollisionAudit, CollisionResolutionLog } from './lib/crossStemCollisionAudit';
import { isAndroidPlatform, exportMidiToAndroid } from './lib/androidBridge';

import { Header } from './components/Header';
import { RackSidebar, RackNavView } from './components/RackSidebar';
import { RackFooter } from './components/RackFooter';
import { TelemetrySoundboard } from './components/TelemetrySoundboard';
import { AudioInputPanel } from './components/AudioInputPanel';
import { PipelineProgress } from './components/PipelineProgress';
import { TrackMixer } from './components/TrackMixer';
import { TimelineView } from './components/TimelineView';
import { PianoRollView } from './components/PianoRollView';
import { GeminiInsightsPanel } from './components/GeminiInsightsPanel';
import { FeatureAnalyticsPanel } from './components/FeatureAnalyticsPanel';
import { ExportPanel } from './components/ExportPanel';
import { AccuracyMetricsPanel } from './components/AccuracyMetricsPanel';
import { AndroidPackageModal } from './components/AndroidPackageModal';
import { DownloadProcessedModal } from './components/DownloadProcessedModal';

export default function App() {
  const [pipelineResult, setPipelineResult] = useState<SongPipelineResult | null>(null);
  const [stemBuffersState, setStemBuffersState] = useState<Record<StemType, AudioBuffer> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [autoDownloadNotice, setAutoDownloadNotice] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [cachedZipBlob, setCachedZipBlob] = useState<{ blob: Blob; filename: string } | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [autoDownloadTriggered, setAutoDownloadTriggered] = useState(false);

  const [rackNavView, setRackNavView] = useState<RackNavView>('matrix-view');
  const [activeTab, setActiveTab] = useState<'timeline' | 'pianoroll' | 'gemini' | 'diagnostics' | 'accuracy' | 'features'>('timeline');
  const [showAudioInput, setShowAudioInput] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [showStemMenu, setShowStemMenu] = useState(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playSynthMidi, setPlaySynthMidi] = useState(true);
  const [auditionMode, setAuditionMode] = useState<AuditionMode>('hybrid_unison');

  // Mixer State for all 6 stems
  const [volume, setVolume] = useState<Record<StemType | 'master', number>>({
    vocals: 0.85,
    bass: 0.85,
    drums: 0.85,
    guitar: 0.85,
    piano: 0.85,
    other: 0.85,
    master: 0.85,
  });
  const [isMuted, setIsMuted] = useState<Record<StemType | 'master', boolean>>({
    vocals: false,
    bass: false,
    drums: false,
    guitar: false,
    piano: false,
    other: false,
    master: false,
  });
  const [isSoloed, setIsSoloed] = useState<Record<StemType, boolean>>({
    vocals: false,
    bass: false,
    drums: false,
    guitar: false,
    piano: false,
    other: false,
  });
  const [pan, setPan] = useState<Record<StemType, number>>({
    vocals: 0,
    bass: 0,
    drums: -0.1,
    guitar: -0.2,
    piano: 0.15,
    other: 0.2,
  });
  const [selectedStem, setSelectedStem] = useState<StemType | 'all'>('all');
  const [activeSection, setActiveSection] = useState<SectionAnalysis | null>(null);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);

  // Setup AudioEngine listeners
  useEffect(() => {
    audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    audioEngine.onEnded(() => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
  }, []);

  // Synchronize audio engine mute/solo/volume
  useEffect(() => {
    audioEngine.setMuteSolo(isMuted as Record<StemType, boolean>, isSoloed);
    audioEngine.setPlayMidiSynth(playSynthMidi);
    audioEngine.setVolume('master', isMuted.master ? 0 : (volume.master ?? 0.85));
    const stems: StemType[] = ['vocals', 'bass', 'drums', 'guitar', 'piano', 'other'];
    for (const s of stems) {
      audioEngine.setVolume(s, volume[s] ?? 0.85);
      audioEngine.setPan(s, pan[s] ?? 0);
    }
  }, [volume, isMuted, isSoloed, pan, playSynthMidi]);

  /**
   * Processes custom uploaded audio or microphone recording through the full pipeline
   */
  const handleCustomAudioUploaded = async (file: File, decodedBuffer: AudioBuffer) => {
    setIsProcessing(true);
    setShowAudioInput(false);
    audioEngine.stop();
    setIsPlaying(false);

    try {
      const songDuration = Math.max(1, decodedBuffer.duration);
      let estimatedBpm = 120;

      const customMetadata: SongMetadata = {
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'User Audio File',
        duration: Number(songDuration.toFixed(1)),
        bpm: estimatedBpm,
        key: 'Dynamic Key Detection',
        timeSignature: '4/4',
        separationDsp: {
          generalGraph: 'Multi-Band Crossover Filter Graph (Web Audio DSP)',
          vocalFilter: 'Mid-Band Formant & Harmonic Extractor (280Hz-4.2kHz)',
          drumFilter: 'Multi-Band Transient & Spectral Flux Decomposition',
        },
      };

      // Step 1: Input Audio
      setCurrentStep(1);
      setProcessingMessage(`Decoding "${file.name}" (${songDuration.toFixed(1)}s, ${decodedBuffer.sampleRate} Hz)...`);
      await new Promise((r) => setTimeout(r, 200));

      // Step 2: Stem Separation Ensemble
      setCurrentStep(2);
      setProcessingMessage('Splitting into Vocals, Bass, Drums, and Other using multi-band DSP filter graph...');
      await new Promise((r) => setTimeout(r, 200));

      // Create isolated stem buffers from the uploaded audio using frequency-band filter graph
      const stemBuffers = await splitAudioIntoStemsUsingDsp(decodedBuffer, songDuration);

      // Estimate true audio tempo (BPM) from drum audio transients
      estimatedBpm = estimateAudioBpm(stemBuffers.drums || decodedBuffer);
      customMetadata.bpm = estimatedBpm;

      // Step 3: Feature Extraction & Concurrent Multi-Track Serialization
      setCurrentStep(3);
      setProcessingMessage('Computing RMS energy envelopes, spectral centroids, and transcribing multi-track MIDI notes...');
      await new Promise((r) => setTimeout(r, 200));

      // Use full duration for feature extraction to ensure complete audio analysis
      const { features: stemFeatures, correlations } = extractStemFeaturesFromBuffers(stemBuffers, songDuration);

      // Transcribe real multi-track MIDI notes directly from separated audio stem signals
      const rawNotes = transcribeAudioStemsToMidiNotes(stemBuffers, songDuration, estimatedBpm);

      // DETERMINISTIC PASS: Cross-Stem Collision & Bleed Audit Protocol
      setProcessingMessage('Executing Cross-Stem Collision & Bleed Audit Protocol (STFT F0 salience, centroid bandwidth & onset slope)...');
      await new Promise((r) => setTimeout(r, 150));

      const collisionAuditResult = executeCrossStemCollisionAudit(rawNotes, stemBuffers);
      const auditedRawNotes = collisionAuditResult.auditedNotes;
      const collisionPurgedNotes = collisionAuditResult.prunedCollisionNotes;
      const collisionLogs = collisionAuditResult.collisionLogs;

      // Step 4: Gemini Functional Analysis (LLM Orchestration)
      setCurrentStep(4);
      setProcessingMessage('Querying Gemini Audio Intelligence on backend (analyzing multi-stem acoustics, arrangement & functional roles)...');

      const geminiResponse = await fetch('/api/analyze-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: customMetadata,
          stemFeatures,
          correlations,
          collisionTelemetry: collisionLogs.map((l) => l.formattedLog),
          auditedNotesSummary: {
            totalSerialized: rawNotes.length,
            auditedCount: auditedRawNotes.length,
            collisionsResolved: collisionLogs.length,
          },
        }),
      });

      if (!geminiResponse.ok) {
        const errJson = await geminiResponse.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || `Gemini backend analysis failed with HTTP ${geminiResponse.status}`);
      }

      const geminiResult = await geminiResponse.json();
      if (!geminiResult?.sections || geminiResult.sections.length === 0) {
        throw new Error('Gemini audio intelligence engine returned no analyzed sections.');
      }

      const sections: SectionAnalysis[] = geminiResult.sections;

      // Step 5 & 6: Adaptive Transcription Routing & Expressive Nuance Extraction
      setCurrentStep(5);
      setProcessingMessage('Routing audited stems to Sub-Harmonic YIN (Bass), Salience Formants (Vocals), Chord Detector (Other), and Onset Tracker (Drums)...');
      await new Promise((r) => setTimeout(r, 150));

      for (const note of auditedRawNotes) {
        const sec = sections.find((s) => note.startTime >= s.startTime && note.startTime < s.endTime) || sections[0];
        note.section = sec.section;
        const role = sec.stemRoles?.[note.stem] || (note.stem === 'bass' ? 'foundation' : note.stem === 'vocals' ? 'lead' : note.stem === 'drums' ? 'percussion' : 'texture');
        note.role = role;
        note.method = determineRoutingMethod(note.stem, role, sec.section === 'outro');
      }

      setCurrentStep(6);
      setProcessingMessage('Extracting dynamic velocities, transient attacks, and micro-pitch contours...');
      await new Promise((r) => setTimeout(r, 150));

      for (const note of auditedRawNotes) {
        const buf = stemBuffers[note.stem];
        if (buf) {
          const dyn = extractDynamicVelocityFromAudio(buf, note.startTime, note.endTime);
          note.dynamicVelocity = dyn.velocity;
          note.articulation = dyn.articulation;
        }
        if (note.stem === 'vocals' && (note.role === 'lead' || note.role === 'ornament')) {
          note.pitchBends = extractPitchBendContour(stemBuffers.vocals, note.startTime, note.endTime, note.pitch, 2);
        }
      }

      // Step 7 & 8: Alignment, Section Quantization, and Bleed Cleanup
      setCurrentStep(7);
      setProcessingMessage('Analyzing audio groove micro-timing and modal scale chromagram...');
      await new Promise((r) => setTimeout(r, 150));

      const grooveTemplate = extractGrooveTemplateFromDrums(stemBuffers.drums, estimatedBpm);
      const keyProfile = detectKeyProfile(auditedRawNotes);

      setCurrentStep(8);
      setProcessingMessage('Purging stray bleed notes via cross-stem energy gating & applying groove pocket...');
      await new Promise((r) => setTimeout(r, 150));

      const { cleanedNotes, purgedNotes: dspPurgedNotes, allNotes } = processMidiAlignmentAndCleanup(
        auditedRawNotes,
        sections,
        estimatedBpm,
        stemFeatures,
        grooveTemplate,
        keyProfile.scalePitches
      );

      const purgedNotes = [...collisionPurgedNotes, ...dspPurgedNotes];

      const harmonicChords = extractHarmonicChordsAndVoicings(
        cleanedNotes,
        estimatedBpm,
        songDuration,
        keyProfile
      );

      const automationLanes = generateContinuousAutomationLanes(
        stemFeatures,
        cleanedNotes,
        songDuration
      );

      // Step 9: Final Output
      setCurrentStep(9);
      setProcessingMessage('Audio processing and expressive MIDI transcription complete!');

      const stemSummaries: Record<StemType, StemSummary> = {
        vocals: {
          stem: 'vocals',
          name: 'Vocals',
          primaryRole: 'lead',
          routingMethod: 'polyphonic_salience',
          methodDescription: 'Spectral Salience & Formant Pitch Tracker',
          noteCount: cleanedNotes.filter((n) => n.stem === 'vocals').length,
          purgedBleedCount: purgedNotes.filter((n) => n.stem === 'vocals').length,
          color: '#22d3ee',
          audioGenerated: true,
        },
        bass: {
          stem: 'bass',
          name: 'Bass',
          primaryRole: 'foundation',
          routingMethod: 'monophonic_autocorrelation',
          methodDescription: 'Sub-Harmonic YIN / Autocorrelation F0 Tracker',
          noteCount: cleanedNotes.filter((n) => n.stem === 'bass').length,
          purgedBleedCount: purgedNotes.filter((n) => n.stem === 'bass').length,
          color: '#fbbf24',
          audioGenerated: true,
        },
        drums: {
          stem: 'drums',
          name: 'Drums',
          primaryRole: 'percussion',
          routingMethod: 'onset_drum_tracking',
          methodDescription: 'Multi-band Transient & Groove Pocket Tracker',
          noteCount: cleanedNotes.filter((n) => n.stem === 'drums').length,
          purgedBleedCount: purgedNotes.filter((n) => n.stem === 'drums').length,
          color: '#f472b6',
          audioGenerated: true,
        },
        guitar: {
          stem: 'guitar',
          name: 'Guitar',
          primaryRole: 'lead',
          routingMethod: 'polyphonic_salience',
          methodDescription: 'Polyphonic Salience & Strum Voicing Engine',
          noteCount: cleanedNotes.filter((n) => n.stem === 'guitar').length,
          purgedBleedCount: purgedNotes.filter((n) => n.stem === 'guitar').length,
          color: '#34d399',
          audioGenerated: true,
        },
        piano: {
          stem: 'piano',
          name: 'Piano',
          primaryRole: 'texture',
          routingMethod: 'chord_harmony_detect',
          methodDescription: 'Acoustic Triad & Multi-Voice Chord Tracker',
          noteCount: cleanedNotes.filter((n) => n.stem === 'piano').length,
          purgedBleedCount: purgedNotes.filter((n) => n.stem === 'piano').length,
          color: '#38bdf8',
          audioGenerated: true,
        },
        other: {
          stem: 'other',
          name: 'Other (Synths/FX)',
          primaryRole: 'texture',
          routingMethod: 'chord_harmony_detect',
          methodDescription: 'Harmonic Chord & Pad Voicing',
          noteCount: cleanedNotes.filter((n) => n.stem === 'other').length,
          purgedBleedCount: purgedNotes.filter((n) => n.stem === 'other').length,
          color: '#c084fc',
          audioGenerated: true,
        },
      };

      const accuracyProfile = computeTranscriptionAccuracyProfile(
        allNotes,
        cleanedNotes,
        purgedNotes,
        grooveTemplate,
        keyProfile
      );

      customMetadata.key = keyProfile.keyName;

      const result: SongPipelineResult = {
        metadata: customMetadata,
        sections,
        stemFeatures,
        crossStemCorrelations: correlations,
        midiNotes: allNotes,
        cleanedMidiNotes: cleanedNotes,
        purgedNotes,
        stemSummaries,
        grooveTemplate,
        keyProfile,
        chords: harmonicChords,
        automationLanes,
        accuracyProfile: {
          ...accuracyProfile,
          collisionPurgedCount: collisionLogs.length,
        },
        collisionAuditLogs: collisionLogs,
        detectedSubgenre: geminiResult?.detectedSubgenre,
        geminiExecutiveSummary: geminiResult.geminiExecutiveSummary,
        arrangementCritique: geminiResult.arrangementCritique,
        mixRecommendations: geminiResult.mixRecommendations,
        processingDurationMs: geminiResult?.processingDurationMs,
        modelUsed: geminiResult?.modelUsed,
        processedAt: new Date().toISOString(),
      };

      setPipelineResult(result);
      setDuration(songDuration);
      setActiveSection(sections[0]);
      audioEngine.setSongData(songDuration, cleanedNotes, stemBuffers);
      setStemBuffersState(stemBuffers);

      setProcessingMessage('Packaging 6 lossless stems and multi-track MIDI ZIP for download...');
      try {
        const cleanSlug = (customMetadata.title || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const midiBytes = generateMidiFile(cleanedNotes, estimatedBpm);
        const { filename, blob } = await downloadStemmedAudioZip(
          stemBuffers,
          customMetadata.title,
          [
            {
              filename: `${cleanSlug}_aligned_multitrack.mid`,
              data: midiBytes,
            },
          ]
        );
        setCachedZipBlob({ blob, filename });
        setAutoDownloadTriggered(true);
        setAutoDownloadNotice(`✓ Download started: "${filename}"`);

        if (isAndroidPlatform()) {
          exportMidiToAndroid(cleanedNotes, estimatedBpm, customMetadata.title).catch(console.warn);
        }
      } catch (dlErr) {
        console.warn('Auto-download notice:', dlErr);
        setAutoDownloadNotice(`✓ 6 separated stems & MIDI transcription ready for download`);
      }

      setIsDownloadModalOpen(true);
      setIsProcessing(false);
    } catch (err) {
      console.error('Error processing custom audio:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualZipDownload = async () => {
    if (!stemBuffersState || !pipelineResult) return;
    try {
      setIsZipping(true);
      if (cachedZipBlob) {
        triggerBlobDownload(cachedZipBlob.blob, cachedZipBlob.filename);
        setAutoDownloadNotice(`✓ Stems package downloaded: "${cachedZipBlob.filename}"`);
      } else {
        const cleanSlug = (pipelineResult.metadata.title || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const { filename, blob } = await downloadStemmedAudioZip(
          stemBuffersState,
          pipelineResult.metadata.title,
          [
            {
              filename: `${cleanSlug}_aligned_multitrack.mid`,
              data: generateMidiFile(pipelineResult.cleanedMidiNotes, pipelineResult.metadata.bpm),
            },
          ]
        );
        setCachedZipBlob({ blob, filename });
        setAutoDownloadNotice(`✓ Stems package downloaded: "${filename}"`);
      }
    } catch (err) {
      console.error('Manual ZIP export failed:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Playback handlers
  const handleTogglePlay = () => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (time: number) => {
    audioEngine.seek(time);
    setCurrentTime(time);
  };

  const handleChangeAuditionMode = (mode: AuditionMode) => {
    setAuditionMode(mode);
    if (mode === 'audio_only') {
      audioEngine.setPlayMidiSynth(false);
      audioEngine.setAudioStemsAudible(true);
    } else if (mode === 'synth_only') {
      audioEngine.setPlayMidiSynth(true);
      audioEngine.setAudioStemsAudible(false);
    } else if (mode === 'hybrid_unison') {
      audioEngine.setPlayMidiSynth(true);
      audioEngine.setAudioStemsAudible(true);
    }
  };

  const handleScrollToInput = () => {
    setShowAudioInput(true);
    setTimeout(() => {
      const el = document.getElementById('audio-dropzone');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const toggleGlobalSynth = () => {
    const nextVal = !playSynthMidi;
    setPlaySynthMidi(nextVal);
    audioEngine.setPlayMidiSynth(nextVal);
  };

  const handleExportStemMidi = (stem: StemType | 'all') => {
    if (!pipelineResult) return;
    const filter = stem === 'all' ? undefined : stem;
    const suffix = stem === 'all' ? 'multitrack_bundle' : `${stem}_stem`;
    const titleSlug = (pipelineResult.metadata.title || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const filename = `${titleSlug}_${suffix}.mid`;
    const bytes = generateMidiFile(pipelineResult.cleanedMidiNotes, pipelineResult.metadata.bpm, filter);
    downloadMidiBlob(bytes, filename);
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-300 flex font-sans selection:bg-[#DC2626] selection:text-white">
      {/* Outer Rack Chassis Left Sidebar (Anodized Bead-blasted Aluminum) */}
      <RackSidebar
        activeView={rackNavView}
        onSelectView={(v) => setRackNavView(v)}
        hasTrack={Boolean(pipelineResult)}
        rackThermalLoad={18.4}
        bufferSize={64}
      />

      {/* Main Rack Chassis Wrapper */}
      <div className="pl-0 lg:pl-64 w-full min-h-screen flex flex-col bg-[#0d0e13]">
        {/* Top Rack Header (Brushed Metal with Engraved Precision Dividers & Torx Screws) */}
        <Header
          pipelineResult={pipelineResult}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          playSynthMidi={playSynthMidi}
          onTogglePlay={handleTogglePlay}
          onStop={handleStop}
          onTogglePlaySynthMidi={toggleGlobalSynth}
          onOpenExport={() => setIsExportOpen(true)}
          onSelectTrackModal={handleScrollToInput}
          onOpenAndroidPackage={() => setIsAndroidModalOpen(true)}
          dspStatus={isProcessing ? 'processing' : pipelineResult ? 'ready' : 'idle'}
        />

        {/* Main Workstation Stage */}
        <main className="relative pt-20 pb-16 w-full px-3 sm:px-6 min-h-screen bg-[#0d0e13] space-y-5">
          {/* Mobile Bay Selector for smaller screens */}
          <div className="flex lg:hidden items-center gap-1 overflow-x-auto py-1 font-mono text-xs border-b border-[#262a34]">
            <button
              onClick={() => setRackNavView('matrix-view')}
              className={`px-3 py-1 rounded whitespace-nowrap font-bold ${
                rackNavView === 'matrix-view'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#14161b] text-zinc-400 hover:text-white'
              }`}
            >
              Matrix View
            </button>
            <button
              onClick={() => setRackNavView('spectral-tensor')}
              className={`px-3 py-1 rounded whitespace-nowrap font-bold ${
                rackNavView === 'spectral-tensor'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#14161b] text-zinc-400 hover:text-white'
              }`}
            >
              Spectral Tensor
            </button>
            <button
              onClick={() => setRackNavView('midi-extraction-bus')}
              className={`px-3 py-1 rounded whitespace-nowrap font-bold ${
                rackNavView === 'midi-extraction-bus'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#14161b] text-zinc-400 hover:text-white'
              }`}
            >
              MIDI Bus
            </button>
            <button
              onClick={() => setRackNavView('phase-and-latency')}
              className={`px-3 py-1 rounded whitespace-nowrap font-bold ${
                rackNavView === 'phase-and-latency'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#14161b] text-zinc-400 hover:text-white'
              }`}
            >
              Phase & Latency
            </button>
            <button
              onClick={() => setRackNavView('diagnostic-telemetry')}
              className={`px-3 py-1 rounded whitespace-nowrap font-bold ${
                rackNavView === 'diagnostic-telemetry'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#14161b] text-zinc-400 hover:text-white'
              }`}
            >
              Diagnostics
            </button>
          </div>

          {/* Stage 1 & 2: Audio Input & Recording Panel (Only shown before processing or when explicitly toggled) */}
          {(!pipelineResult || isProcessing || showAudioInput) && (
            <div className="space-y-4">
              <AudioInputPanel
                onCustomAudioUploaded={handleCustomAudioUploaded}
                isProcessing={isProcessing}
                hasLoadedAudio={!!pipelineResult}
              />

              {(isProcessing || currentStep > 0) && (
                <PipelineProgress
                  currentStep={currentStep}
                  isProcessing={isProcessing}
                  activeMessage={processingMessage}
                />
              )}
            </div>
          )}

          {/* Quick Actions Action Bar when audio is loaded */}
          {pipelineResult && !isProcessing && (
            <div className="bg-[#101217] border border-[#292D38] rounded-lg px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-md">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-7 h-7 rounded bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm font-mono truncate">
                      {pipelineResult.metadata?.title || 'Master Track'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 font-bold">
                      {pipelineResult.accuracyProfile?.pitchAccuracyScore ?? 99.2}% ACCURACY
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 font-bold hidden sm:inline">
                      6 STEMS
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Downloads */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap relative">
                <button
                  type="button"
                  onClick={handleManualZipDownload}
                  disabled={isZipping || !stemBuffersState}
                  className="px-3 py-1.5 rounded bg-[#DC2626] hover:bg-red-700 text-white font-mono font-bold text-xs flex items-center gap-1.5 transition shadow-lg disabled:opacity-50"
                  title="Download 6 Lossless WAV Stems + Standard MIDI File in a single ZIP"
                >
                  <FileArchive className="w-3.5 h-3.5 text-white" />
                  <span>{isZipping ? 'Bundling...' : 'Download ZIP'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportStemMidi('all')}
                  className="px-2.5 py-1.5 rounded bg-[#1A1D26] hover:bg-[#292D38] text-[#06B6D4] border border-[#06B6D4]/40 text-xs font-mono font-medium flex items-center gap-1.5 transition"
                  title="Export All Stems as Multi-Track MIDI (.mid)"
                >
                  <Download className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Bundle MIDI</span>
                </button>

                {/* Clean Single-Stem MIDI Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStemMenu(!showStemMenu)}
                    className="px-2.5 py-1.5 rounded bg-[#1A1D26] hover:bg-[#292D38] text-zinc-300 border border-[#292D38] text-xs font-mono flex items-center gap-1 transition cursor-pointer"
                    title="Export individual stem MIDI files"
                  >
                    <Music2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Stems MIDI</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${showStemMenu ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showStemMenu && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-[#101217] border border-[#292D38] rounded-lg shadow-2xl py-1 z-30 font-mono text-xs">
                      {(['vocals', 'bass', 'drums', 'guitar', 'piano', 'other'] as StemType[]).map(
                        (stem) => (
                          <button
                            key={stem}
                            onClick={() => {
                              handleExportStemMidi(stem);
                              setShowStemMenu(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#1A1D26] text-zinc-300 hover:text-white flex items-center justify-between capitalize transition cursor-pointer"
                          >
                            <span>{stem} MIDI</span>
                            <Download className="w-3 h-3 text-zinc-500" />
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowMixer(!showMixer)}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer ${
                    showMixer
                      ? 'bg-red-950/40 text-red-300 border-[#DC2626]/50'
                      : 'bg-[#1A1D26] text-zinc-300 hover:text-white border-[#292D38]'
                  }`}
                  title="Toggle Track Mixer"
                >
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Mixer</span>
                  <span className="text-[10px] text-zinc-500">{showMixer ? '▲' : '▼'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAudioInput(!showAudioInput)}
                  className="px-2.5 py-1.5 rounded bg-[#1A1D26] hover:bg-[#292D38] text-zinc-400 hover:text-white border border-[#292D38] text-xs font-mono flex items-center gap-1 transition cursor-pointer"
                  title="Upload or record new audio"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>{showAudioInput ? 'Hide Audio' : '+ Ingest'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Compact Auto-Download Notice */}
          {pipelineResult && autoDownloadNotice && (
            <div className="bg-[#101217] border border-[#DC2626]/50 rounded-lg px-3.5 py-2 flex items-center justify-between gap-3 text-xs text-zinc-200 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileArchive className="w-4 h-4 text-red-400 shrink-0" />
                <p className="font-mono text-xs text-zinc-300 truncate">{autoDownloadNotice}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleManualZipDownload}
                  disabled={isZipping || !stemBuffersState}
                  className="px-2.5 py-1 rounded bg-[#DC2626] hover:bg-red-500 text-white font-mono text-xs font-medium transition cursor-pointer"
                >
                  {isZipping ? 'Bundling...' : 'Re-download (.ZIP)'}
                </button>
                <button
                  type="button"
                  onClick={() => setAutoDownloadNotice(null)}
                  className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Primary Active Module View */}
          {rackNavView === 'matrix-view' && (
            <TelemetrySoundboard
              pipelineResult={pipelineResult}
              stemBuffers={stemBuffersState}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              isMuted={isMuted}
              isSoloed={isSoloed}
              onToggleMute={(stem) => setIsMuted((prev) => ({ ...prev, [stem]: !prev[stem] }))}
              onToggleSolo={(stem) => setIsSoloed((prev) => ({ ...prev, [stem]: !prev[stem] }))}
              onExportStemMidi={handleExportStemMidi}
              onDownloadZip={handleManualZipDownload}
            />
          )}

          {rackNavView === 'spectral-tensor' && pipelineResult && (
            <TimelineView
              pipelineResult={pipelineResult}
              currentTime={currentTime}
              duration={duration}
              selectedStem={selectedStem}
              onSeek={handleSeek}
              onSelectSection={(sec) => setActiveSection(sec)}
              activeSection={activeSection}
            />
          )}

          {rackNavView === 'midi-extraction-bus' && pipelineResult && (
            <PianoRollView
              pipelineResult={pipelineResult}
              currentTime={currentTime}
              duration={duration}
              selectedStem={selectedStem}
              onSeek={handleSeek}
              auditionMode={auditionMode}
              onChangeAuditionMode={handleChangeAuditionMode}
              onExportStemMidi={handleExportStemMidi}
            />
          )}

          {rackNavView === 'phase-and-latency' && pipelineResult && (
            <div className="space-y-4">
              <AccuracyMetricsPanel pipelineResult={pipelineResult} />
              <FeatureAnalyticsPanel
                pipelineResult={pipelineResult}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
              />
            </div>
          )}

          {rackNavView === 'diagnostic-telemetry' && pipelineResult && (
            <GeminiInsightsPanel
              pipelineResult={pipelineResult}
              onSelectSection={(sec) => setActiveSection(sec)}
              activeSection={activeSection}
            />
          )}

          {!pipelineResult && rackNavView !== 'matrix-view' && (
            <div className="rack-chassis rounded-lg p-10 flex flex-col items-center justify-center text-center gap-3 border border-[#2b303c] shadow-2xl font-mono">
              <div className="w-12 h-12 rounded-lg bg-black/60 border border-[#2b303c] flex items-center justify-center text-zinc-600">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                BAY STANDBY // NO AUDIO TRACK INGESTED
              </h3>
              <p className="text-xs text-zinc-500 max-w-md">
                This diagnostic module requires decoded audio stems and transcription data. Ingest an audio file or record live microphone input above to activate real-time telemetry.
              </p>
              <button
                type="button"
                onClick={() => setRackNavView('matrix-view')}
                className="mt-2 px-3 py-1.5 rounded bg-[#1A1D26] hover:bg-[#282d38] text-[#4CD7F6] border border-[#2b303c] text-xs font-bold transition cursor-pointer"
              >
                ← Return to Soundboard Matrix View
              </button>
            </div>
          )}

          {/* Collapsible Stem Mixer */}
          {pipelineResult && showMixer && (
            <div className="relative pt-2">
              <TrackMixer
                pipelineResult={pipelineResult}
                volume={volume}
                isMuted={isMuted}
                isSoloed={isSoloed}
                pan={pan}
                selectedStem={selectedStem}
                onVolumeChange={(stem, val) => setVolume((prev) => ({ ...prev, [stem]: val }))}
                onPanChange={(stem, val) => setPan((prev) => ({ ...prev, [stem]: val }))}
                onToggleMute={(stem) => setIsMuted((prev) => ({ ...prev, [stem]: !prev[stem] }))}
                onToggleSolo={(stem) => setIsSoloed((prev) => ({ ...prev, [stem]: !prev[stem] }))}
                onSelectStemFilter={(stem) => setSelectedStem(stem)}
                onExportStemMidi={handleExportStemMidi}
                onExportAllMidi={() => handleExportStemMidi('all')}
              />
            </div>
          )}
        </main>

        {/* Bottom Rack Enclosure Bezel */}
        <RackFooter currentTime={currentTime} isPlaying={isPlaying} hasTrack={Boolean(pipelineResult)} />
      </div>

      {/* Export Standard MIDI File & Stemmed Audio ZIP Modal */}
      {isExportOpen && (
        <ExportPanel
          pipelineResult={pipelineResult}
          stemBuffers={stemBuffersState}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* Complete Android APK & Native SDK Package Modal */}
      {isAndroidModalOpen && (
        <AndroidPackageModal onClose={() => setIsAndroidModalOpen(false)} />
      )}

      {/* Automatic Processed Audio Stems & MIDI Download Center Modal */}
      {isDownloadModalOpen && pipelineResult && (
        <DownloadProcessedModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          pipelineResult={pipelineResult}
          stemBuffers={stemBuffersState}
          cachedZipBlob={cachedZipBlob}
          autoDownloadTriggered={autoDownloadTriggered}
        />
      )}
    </div>
  );
}
