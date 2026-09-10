/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { MidiNote, StemType } from '../types';

export interface AndroidAudioCapabilities {
  hasLowLatencyAudio: boolean;
  hasProAudio: boolean;
  hasMicrophone: boolean;
  nativeSampleRate: number;
  nativeOptimalBufferSize: number;
  platform: 'android' | 'web';
}

export interface AndroidExportResult {
  success: boolean;
  filePath?: string;
  uriString?: string;
  byteCount?: number;
  error?: string;
}

export interface AndroidRecordingResult {
  success: boolean;
  sampleCount: number;
  sampleRate: number;
  durationSec: number;
  rmsDb: number;
  wavBase64: string;
}

export interface StemFlowPluginInterface {
  getDeviceAudioCapabilities(): Promise<AndroidAudioCapabilities>;
  startNativeRecording(): Promise<{ success: boolean; sampleRate: number }>;
  stopNativeRecording(): Promise<AndroidRecordingResult>;
  exportMidi(options: {
    notes: any[];
    bpm: number;
    title: string;
    stem?: string;
  }): Promise<AndroidExportResult>;
  exportWav(options: {
    wavBase64: string;
    filename: string;
  }): Promise<AndroidExportResult>;
  checkServerHealth(options?: { baseUrl?: string }): Promise<{
    status: string;
    service: string;
    geminiKeyConfigured: boolean;
    timestamp: string;
  }>;
  addListener(
    eventName: 'audioLevelUpdate',
    listenerFunc: (data: { rmsDb: number; centroidHz: number; chunkLength: number }) => void
  ): Promise<any>;
}

// Register the custom native plugin
const StemFlowPlugin = registerPlugin<StemFlowPluginInterface>('StemFlow');

/**
 * Returns true if running natively on an Android device or emulator under Capacitor.
 */
export function isAndroidPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Queries Android device hardware audio specifications (pro-audio flag, low latency flag, native buffer size).
 */
export async function getAndroidAudioCapabilities(): Promise<AndroidAudioCapabilities> {
  if (isAndroidPlatform()) {
    try {
      return await StemFlowPlugin.getDeviceAudioCapabilities();
    } catch (err) {
      console.warn('Native getDeviceAudioCapabilities failed, falling back to web capabilities:', err);
    }
  }

  // Web fallback capabilities
  const audioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const sampleRate = audioCtx ? new audioCtx().sampleRate : 44100;
  return {
    hasLowLatencyAudio: true,
    hasProAudio: false,
    hasMicrophone: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    nativeSampleRate: sampleRate,
    nativeOptimalBufferSize: 512,
    platform: 'web',
  };
}

/**
 * Exports Type 1 Standard MIDI directly to Android MediaStore / Downloads using native Android API.
 */
export async function exportMidiToAndroid(
  notes: MidiNote[],
  bpm: number,
  title: string,
  stem?: StemType
): Promise<AndroidExportResult> {
  if (!isAndroidPlatform()) {
    throw new Error('exportMidiToAndroid is only available on Android native platform');
  }

  return await StemFlowPlugin.exportMidi({
    notes,
    bpm,
    title,
    stem: stem || undefined,
  });
}

/**
 * Exports WAV audio directly to Android MediaStore / Music using native Android API.
 */
export async function exportWavToAndroid(
  wavBase64: string,
  filename: string
): Promise<AndroidExportResult> {
  if (!isAndroidPlatform()) {
    throw new Error('exportWavToAndroid is only available on Android native platform');
  }

  return await StemFlowPlugin.exportWav({
    wavBase64,
    filename,
  });
}

/**
 * Initiates native hardware AudioRecord capture on Android.
 */
export async function startAndroidRecording(): Promise<{ success: boolean; sampleRate: number }> {
  if (!isAndroidPlatform()) {
    throw new Error('startAndroidRecording is only available on Android native platform');
  }
  return await StemFlowPlugin.startNativeRecording();
}

/**
 * Stops native hardware recording and retrieves the encoded WAV audio.
 */
export async function stopAndroidRecording(): Promise<AndroidRecordingResult> {
  if (!isAndroidPlatform()) {
    throw new Error('stopAndroidRecording is only available on Android native platform');
  }
  return await StemFlowPlugin.stopNativeRecording();
}

/**
 * Subscribes to live hardware audio level updates from Android AudioRecord.
 */
export async function listenToAndroidAudioLevels(
  callback: (data: { rmsDb: number; centroidHz: number; chunkLength: number }) => void
) {
  if (!isAndroidPlatform()) return null;
  return await StemFlowPlugin.addListener('audioLevelUpdate', callback);
}
