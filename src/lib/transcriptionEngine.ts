/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GrooveTemplate, MidiNote, SectionAnalysis, StemFeatureData, StemRole, StemType, TranscriptionMethod } from '../types';
import { estimateFundamentalPitch, computeRms } from './audioDsp';

/**
 * Performs signal-driven audio-to-MIDI transcription across all 6 HTDemucs stems
 */
export function transcribeAudioStemsToMidiNotes(
  stemBuffers: Record<StemType, AudioBuffer>,
  songDuration: number,
  bpm: number
): MidiNote[] {
  const rawNotes: MidiNote[] = [];
  let noteIdCounter = 1;

  // 1. DRUMS STEM TRANSCRIPTION (Spectral Flux Onset Detection)
  if (stemBuffers.drums) {
    const drumBuffer = stemBuffers.drums;
    const channelData = drumBuffer.getChannelData(0);
    const sampleRate = drumBuffer.sampleRate;
    const hopSize = Math.floor(sampleRate * 0.015); // 15ms hop
    const numHops = Math.floor(channelData.length / hopSize);

    let prevRms = 0;
    const onsetFluxes: { time: number; sampleIndex: number; flux: number; rms: number }[] = [];

    for (let h = 0; h < numHops; h++) {
      const s0 = h * hopSize;
      const s1 = Math.min(channelData.length, s0 + hopSize);
      const rms = computeRms(channelData, s0, s1);
      const flux = Math.max(0, rms - prevRms);
      prevRms = rms;
      if (flux > 0.008 && rms > 0.015) {
        onsetFluxes.push({
          time: Number((s0 / sampleRate).toFixed(3)),
          sampleIndex: s0,
          flux,
          rms,
        });
      }
    }

    let lastOnsetTime = -0.08;
    for (const onset of onsetFluxes) {
      if (onset.time - lastOnsetTime < 0.06) continue; // 60ms refractory period
      lastOnsetTime = onset.time;

      const s0 = onset.sampleIndex;
      const s1 = Math.min(channelData.length, s0 + Math.floor(sampleRate * 0.03));

      let zc = 0;
      for (let i = s0; i < s1 - 1; i++) {
        const val = channelData[i];
        const nextVal = channelData[i + 1];
        if ((val >= 0 && nextVal < 0) || (val < 0 && nextVal >= 0)) zc++;
      }

      const zcr = (zc / Math.max(1, s1 - s0)) * (sampleRate / 2);
      let pitch = 38;
      let noteName = 'D1';

      if (zcr < 600) {
        pitch = 36; // Kick drum
        noteName = 'C1';
      } else if (zcr > 3200) {
        pitch = 42; // Closed Hi-Hat
        noteName = 'F#1';
      } else {
        pitch = 38; // Snare
        noteName = 'D1';
      }

      const velocity = Math.min(127, Math.max(40, Math.round(30 + onset.rms * 250)));

      rawNotes.push({
        id: `note-${noteIdCounter++}`,
        stem: 'drums',
        pitch,
        noteName,
        startTime: onset.time,
        endTime: Number((onset.time + 0.15).toFixed(3)),
        duration: 0.15,
        velocity,
        confidence: Number(Math.min(0.99, 0.6 + onset.flux * 5).toFixed(2)),
        method: 'onset_drum_tracking',
        role: 'percussion',
        section: 'intro',
        quantized: false,
      });
    }
  }

  // Helper for monophonic pitch tracking (Bass, Vocals, Guitar)
  const transcribeMonophonicStem = (
    stem: StemType,
    minPitch: number,
    maxPitch: number,
    minFreqHz: number,
    maxFreqHz: number,
    role: StemRole,
    method: TranscriptionMethod
  ) => {
    const buffer = stemBuffers[stem];
    if (!buffer) return;

    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const hopSize = Math.floor(sampleRate * 0.02); // 20ms hop
    const windowSize = Math.floor(sampleRate * 0.08); // 80ms window
    const numHops = Math.floor((channelData.length - windowSize) / hopSize);

    let activeNoteStart = -1;
    let activePitch = -1;
    let activePitches: number[] = [];
    let activeConfidences: number[] = [];
    let activeEnergies: number[] = [];

    const finalizeNote = (timeSec: number) => {
      if (activeNoteStart < 0 || activePitches.length === 0) return;
      const noteEnd = Number((timeSec + 0.04).toFixed(3));
      const noteDur = Number(Math.max(0.08, noteEnd - activeNoteStart).toFixed(3));

      const sortedPitches = [...activePitches].sort((a, b) => a - b);
      const medianPitch = sortedPitches[Math.floor(sortedPitches.length / 2)];
      const avgConf = activeConfidences.reduce((a, b) => a + b, 0) / activeConfidences.length;
      const avgRms = activeEnergies.reduce((a, b) => a + b, 0) / activeEnergies.length;
      const velocity = Math.min(127, Math.max(45, Math.round(35 + avgRms * 220)));

      rawNotes.push({
        id: `note-${noteIdCounter++}`,
        stem,
        pitch: medianPitch,
        noteName: midiPitchToNoteName(medianPitch),
        startTime: activeNoteStart,
        endTime: noteEnd,
        duration: noteDur,
        velocity,
        confidence: Number(Math.min(0.99, avgConf).toFixed(2)),
        method,
        role,
        section: 'intro',
        quantized: false,
      });

      activeNoteStart = -1;
      activePitches = [];
      activeConfidences = [];
      activeEnergies = [];
    };

    for (let h = 0; h < numHops; h++) {
      const s0 = h * hopSize;
      const s1 = s0 + windowSize;
      const timeSec = Number((s0 / sampleRate).toFixed(3));
      const rms = computeRms(channelData, s0, s1);

      if (rms < 0.015) {
        if (activeNoteStart >= 0 && activePitches.length >= 2) {
          finalizeNote(timeSec);
        } else {
          activeNoteStart = -1;
          activePitches = [];
        }
        continue;
      }

      const pitchRes = estimateFundamentalPitch(channelData, s0, s1, sampleRate, minFreqHz, maxFreqHz);

      if (pitchRes.confidence > 0.32 && pitchRes.pitchMidi >= minPitch && pitchRes.pitchMidi <= maxPitch) {
        const roundedPitch = pitchRes.pitchMidi;

        if (activeNoteStart < 0) {
          activeNoteStart = timeSec;
          activePitch = roundedPitch;
          activePitches = [roundedPitch];
          activeConfidences = [pitchRes.confidence];
          activeEnergies = [rms];
        } else if (Math.abs(roundedPitch - activePitch) <= 1.5) {
          activePitches.push(roundedPitch);
          activeConfidences.push(pitchRes.confidence);
          activeEnergies.push(rms);
        } else {
          if (activePitches.length >= 2) {
            finalizeNote(timeSec);
          }
          activeNoteStart = timeSec;
          activePitch = roundedPitch;
          activePitches = [roundedPitch];
          activeConfidences = [pitchRes.confidence];
          activeEnergies = [rms];
        }
      } else {
        if (activeNoteStart >= 0 && activePitches.length >= 2) {
          finalizeNote(timeSec);
        } else {
          activeNoteStart = -1;
          activePitches = [];
        }
      }
    }
  };

  transcribeMonophonicStem('bass', 28, 60, 30, 300, 'foundation', 'monophonic_autocorrelation');
  transcribeMonophonicStem('vocals', 52, 88, 120, 1000, 'lead', 'polyphonic_salience');
  transcribeMonophonicStem('guitar', 45, 84, 90, 800, 'lead', 'polyphonic_salience');

  const transcribePolyphonicStem = (stem: StemType, role: StemRole) => {
    const buffer = stemBuffers[stem];
    if (!buffer) return;

    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const hopSize = Math.floor(sampleRate * 0.25);
    const windowSize = Math.floor(sampleRate * 0.35);
    const numHops = Math.floor((channelData.length - windowSize) / hopSize);

    for (let h = 0; h < numHops; h++) {
      const s0 = h * hopSize;
      const s1 = s0 + windowSize;
      const timeSec = Number((s0 / sampleRate).toFixed(3));
      const rms = computeRms(channelData, s0, s1);

      if (rms < 0.02) continue;

      const primaryPitchRes = estimateFundamentalPitch(channelData, s0, s1, sampleRate, 100, 1000);
      if (primaryPitchRes.confidence > 0.3) {
        const root = primaryPitchRes.pitchMidi;
        const chordPitches = [root, root + 4, root + 7].map((p) => Math.min(108, Math.max(21, p)));

        for (const pitch of chordPitches) {
          rawNotes.push({
            id: `note-${noteIdCounter++}`,
            stem,
            pitch,
            noteName: midiPitchToNoteName(pitch),
            startTime: timeSec,
            endTime: Number((timeSec + 0.45).toFixed(3)),
            duration: 0.45,
            velocity: Math.min(127, Math.round(40 + rms * 200)),
            confidence: Number(primaryPitchRes.confidence.toFixed(2)),
            method: 'chord_harmony_detect',
            role,
            section: 'intro',
            quantized: false,
          });
        }
      }
    }
  };

  transcribePolyphonicStem('piano', 'texture');
  transcribePolyphonicStem('other', 'texture');

  return rawNotes.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Returns human-readable musical note name (e.g. 60 -> "C4", 61 -> "C#4")
 */
export function midiPitchToNoteName(pitch: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  const name = noteNames[pitch % 12];
  return `${name}${octave}`;
}

/**
 * Assigns transcription method based on stem role and musical section function
 */
export function determineRoutingMethod(stem: StemType, role: StemRole, isOrnamentSection: boolean): TranscriptionMethod {
  if (stem === 'drums') {
    return 'onset_drum_tracking';
  }
  if (isOrnamentSection || role === 'ornament') {
    return 'ornament_expressive';
  }
  if (role === 'foundation' || stem === 'bass') {
    return 'monophonic_autocorrelation';
  }
  if (stem === 'piano') {
    return 'chord_harmony_detect';
  }
  if (stem === 'guitar') {
    return role === 'lead' ? 'polyphonic_salience' : 'chord_harmony_detect';
  }
  if (role === 'lead' || stem === 'vocals') {
    return 'polyphonic_salience';
  }
  if (role === 'texture' || stem === 'other') {
    return 'chord_harmony_detect';
  }
  return 'polyphonic_salience';
}

/**
 * Quantizes a timestamp to the closest musical grid subdivision with optional swing and pocket offset
 * Strictness: 0 (keep original) to 1.0 (100% hard snap)
 */
export function quantizeTime(
  timeSec: number,
  bpm: number,
  subdivision: 8 | 16 | 32 = 16,
  strictness: number = 0.9,
  groove?: GrooveTemplate
): number {
  const safeBpm = Math.max(20, Math.min(300, bpm));
  const beatDuration = 60 / safeBpm;
  const gridStepSec = beatDuration / (subdivision / 4); // 16th note = 0.25 beat

  // Base mathematical grid
  const slotIndex = Math.round(timeSec / gridStepSec);
  let targetGridTime = slotIndex * gridStepSec;

  // Apply audio-extracted groove swing if applicable
  if (groove && subdivision === 16) {
    const sixteenthInBeat = Math.abs(slotIndex % 4);
    if (sixteenthInBeat === 1 || sixteenthInBeat === 3) {
      // Swung 16th notes
      const swingOffsetSec = (groove.swingFactor - 0.5) * (gridStepSec * 1.5);
      targetGridTime += swingOffsetSec;
    }
    // Apply micro-timing pocket offset (snare push/pull in seconds)
    if (groove.microTimingOffsetMs !== 0) {
      targetGridTime += groove.microTimingOffsetMs / 1000;
    }
  }

  // Interpolate between original time and target grid time based on strictness
  const finalTime = timeSec + (targetGridTime - timeSec) * Math.max(0, Math.min(1, strictness));
  return Number(finalTime.toFixed(4));
}

/**
 * Performs adaptive alignment, dynamic quantization, harmonic validation, and cross-stem cleanup
 */
export function processMidiAlignmentAndCleanup(
  rawNotes: MidiNote[],
  sections: SectionAnalysis[],
  bpm: number,
  stemFeatures: Record<StemType, StemFeatureData>,
  groove?: GrooveTemplate,
  keyScalePitches?: number[]
): {
  cleanedNotes: MidiNote[];
  purgedNotes: MidiNote[];
  allNotes: MidiNote[];
} {
  const processedNotes: MidiNote[] = [];
  const purgedNotes: MidiNote[] = [];

  for (const note of rawNotes) {
    // 1. Identify which section this note falls into
    const section = sections.find((s) => note.startTime >= s.startTime && note.startTime < s.endTime) || sections[0];
    const sectionStrictness = (section?.quantizationStrictness ?? 80) / 100;
    const isOrnament = note.role === 'ornament' || note.method === 'ornament_expressive';
    const isDrop = section?.section === 'drop';

    // 2. Determine effective quantization strictness
    const effectiveStrictness = isOrnament ? 0.15 : (isDrop ? 0.98 : sectionStrictness);

    // 3. Perform Alignment & Groove Quantization
    const origStart = note.startTime;
    const origEnd = note.endTime;
    const duration = Math.max(0.06, origEnd - origStart);

    let quantizedStart = origStart;
    let quantizedEnd = origEnd;

    if (effectiveStrictness > 0.05) {
      quantizedStart = quantizeTime(origStart, bpm, 16, effectiveStrictness, groove);
      const quantizedDuration = quantizeTime(duration, bpm, 16, effectiveStrictness * 0.65);
      quantizedEnd = quantizedStart + Math.max(0.06, quantizedDuration);
    }

    // 4. Cross-Stem Cleanup & Harmonic Validation
    const featureData = stemFeatures[note.stem];
    let isBleedOrGhost = false;
    let cleanupReason = '';

    if (featureData && featureData.timeline.length > 0) {
      // Find nearest feature timeline points for note duration
      const relevantPoints = featureData.timeline.filter(
        (p) => p.time >= origStart - 0.25 && p.time <= origEnd + 0.25
      );

      const maxEnergyInWindow = relevantPoints.length > 0
        ? Math.max(...relevantPoints.map((p) => p.energy))
        : 0.5;

      const avgEnergyOverall = featureData.averageEnergy || 0.1;
      const energyThreshold = Math.max(0.015, avgEnergyOverall * 0.12);

      // Condition A: False positive pitch in silent or low-energy stem window
      if (maxEnergyInWindow < energyThreshold && note.stem !== 'drums') {
        isBleedOrGhost = true;
        cleanupReason = `Stem energy (${maxEnergyInWindow.toFixed(3)}) below silence threshold (${energyThreshold.toFixed(3)}) — rejected cross-stem spill.`;
      }

      // Condition B: Bass sub-octave jitter or vocal bleed in bass channel
      if (note.stem === 'bass' && note.pitch > 62 && maxEnergyInWindow < avgEnergyOverall * 0.4) {
        isBleedOrGhost = true;
        cleanupReason = `High pitch (${midiPitchToNoteName(note.pitch)}) in bass stem with low energy — rejected bleed artifact.`;
      }

      // Condition C: Stray low-confidence drum onsets
      if (note.stem === 'drums' && note.confidence < 0.25) {
        isBleedOrGhost = true;
        cleanupReason = 'Onset peak transient confidence below 0.25 threshold.';
      }
    }

    // 5. Harmonic Scale Validation (flag out-of-scale notes if harmonic tension is low)
    let inKeyConfidence = 1.0;
    if (keyScalePitches && keyScalePitches.length > 0 && note.stem !== 'drums') {
      const pitchClass = note.pitch % 12;
      const isInKey = keyScalePitches.includes(pitchClass);
      const sectionTension = section?.harmonicTension || 40;

      if (!isInKey) {
        // If tension is high, it's likely an intentional jazz/blues passing note
        if (sectionTension < 45 && note.confidence < 0.75) {
          isBleedOrGhost = true;
          cleanupReason = `Dissonant note ${midiPitchToNoteName(note.pitch)} out of detected scale in low-tension section (${sectionTension}%).`;
        } else {
          inKeyConfidence = 0.65;
        }
      }
    }

    const processedNote: MidiNote = {
      ...note,
      startTime: quantizedStart,
      endTime: quantizedEnd,
      duration: Number((quantizedEnd - quantizedStart).toFixed(4)),
      quantized: effectiveStrictness > 0.05,
      originalStart: origStart,
      originalEnd: origEnd,
      wasCleanedUp: isBleedOrGhost,
      cleanupReason: isBleedOrGhost ? cleanupReason : undefined,
      inKeyConfidence,
    };

    if (isBleedOrGhost) {
      purgedNotes.push(processedNote);
    } else {
      processedNotes.push(processedNote);
    }
  }

  // 6. Monophonic Voice-Leading Cleanup (prevent overlapping notes in bass and monophonic lead)
  const sortedCleaned = [...processedNotes].sort((a, b) => a.startTime - b.startTime);
  const monophonicStems: StemType[] = ['bass'];

  for (const stem of monophonicStems) {
    const stemNotes = sortedCleaned.filter((n) => n.stem === stem);
    for (let i = 0; i < stemNotes.length - 1; i++) {
      const current = stemNotes[i];
      const next = stemNotes[i + 1];
      if (current.endTime > next.startTime) {
        current.endTime = Number((next.startTime - 0.01).toFixed(4));
        current.duration = Number((current.endTime - current.startTime).toFixed(4));
      }
    }
  }

  return {
    cleanedNotes: sortedCleaned,
    purgedNotes,
    allNotes: [...sortedCleaned, ...purgedNotes],
  };
}
