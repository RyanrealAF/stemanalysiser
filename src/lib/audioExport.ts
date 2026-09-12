/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { StemType } from '../types';

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV format (Lossless).
 */
export function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = Linear PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataByteLength = numSamples * blockAlign;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const outBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(outBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');

  // "fmt " Sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, format, true); // AudioFormat 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" Sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Interleave and write 16-bit PCM samples with high-speed Int16Array buffer
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  const int16View = new Int16Array(outBuffer, 44, numSamples * numChannels);
  let p = 0;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = channelData[ch][i];
      const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
      int16View[p++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
  }

  return new Uint8Array(outBuffer);
}

export interface ExtraZipFile {
  filename: string;
  data: Uint8Array | string;
}

/**
 * Compiles separated audio stems into a compressed ZIP file using JSZip.
 * Uses STORE compression for instantaneous bundling without CPU/memory lockup.
 */
export async function createStemmedAudioZip(
  stemBuffers: Record<StemType, AudioBuffer>,
  songTitle: string,
  extraFiles: ExtraZipFile[] = []
): Promise<Blob> {
  const zip = new JSZip();
  const titleSlug = (songTitle || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const folder = zip.folder(`${titleSlug}_stems_package`) || zip;

  const stemKeys: { type: StemType; label: string; desc: string }[] = [
    { type: 'vocals', label: 'vocals', desc: 'Spectral Salience Lead & Formant Melodic Track' },
    { type: 'bass', label: 'bass', desc: 'Monophonic Sub-Harmonic YIN F0 Bass Track' },
    { type: 'drums', label: 'drums', desc: 'Multi-Band Spectral Flux Transient Percussion Track' },
    { type: 'guitar', label: 'guitar', desc: 'Polyphonic Strum Salience & Pluck Harmonic Track' },
    { type: 'piano', label: 'piano', desc: 'Acoustic Soundboard & Multi-Voice Triad Piano Track' },
    { type: 'other', label: 'other', desc: 'Ambient Synthesizers, Brass & Atmospheric FX Track' },
  ];

  for (const s of stemKeys) {
    const buffer = stemBuffers[s.type];
    if (buffer) {
      const wavBytes = audioBufferToWav(buffer);
      folder.file(`${titleSlug}_${s.label}.wav`, wavBytes);
    }
  }

  // Include any extra files such as MIDI or analysis JSON
  for (const extra of extraFiles) {
    folder.file(extra.filename, extra.data);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
  });
}

/**
 * Triggers an immediate browser download for a Blob file with safety guards against iframe sandbox errors.
 */
export function triggerBlobDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch {
        // silent cleanup guard
      }
    }, 1500);
    return true;
  } catch (err) {
    console.warn('Browser sandbox or download policy prevented direct auto-download:', err);
    return false;
  }
}

/**
 * Automatically creates and triggers download of stemmed audio ZIP package.
 */
export async function downloadStemmedAudioZip(
  stemBuffers: Record<StemType, AudioBuffer>,
  songTitle: string,
  extraFiles: ExtraZipFile[] = []
): Promise<{ filename: string; blob: Blob }> {
  const blob = await createStemmedAudioZip(stemBuffers, songTitle, extraFiles);
  const titleSlug = (songTitle || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const filename = `${titleSlug}_stems_wav.zip`;
  triggerBlobDownload(blob, filename);
  return { filename, blob };
}

/**
 * Directly downloads an individual stem AudioBuffer as a 16-bit PCM WAV file.
 */
export function downloadStemWav(buffer: AudioBuffer, filename: string): boolean {
  try {
    const wavBytes = audioBufferToWav(buffer);
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return triggerBlobDownload(blob, filename);
  } catch (err) {
    console.error('Failed to export individual stem WAV:', err);
    return false;
  }
}
