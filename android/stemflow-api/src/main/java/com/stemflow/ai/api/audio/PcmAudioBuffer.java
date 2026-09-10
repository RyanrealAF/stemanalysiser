package com.stemflow.ai.api.audio;

import java.util.Arrays;

/**
 * High-performance container for 16-bit signed PCM audio samples.
 */
public class PcmAudioBuffer {
    private short[] samples;
    private int size;
    private final int sampleRate;
    private final int channels;

    public PcmAudioBuffer(int sampleRate, int channels) {
        this(sampleRate, channels, 44100 * 2); // default 2 seconds initial capacity
    }

    public PcmAudioBuffer(int sampleRate, int channels, int initialCapacity) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.samples = new short[Math.max(initialCapacity, 1024)];
        this.size = 0;
    }

    public synchronized void append(short[] newSamples, int length) {
        ensureCapacity(size + length);
        System.arraycopy(newSamples, 0, samples, size, length);
        size += length;
    }

    private void ensureCapacity(int minCapacity) {
        if (minCapacity > samples.length) {
            int newCap = Math.max(samples.length * 2, minCapacity);
            samples = Arrays.copyOf(samples, newCap);
        }
    }

    public int getSampleRate() { return sampleRate; }
    public int getChannels() { return channels; }
    public int getSize() { return size; }
    public double getDurationSec() {
        return (double) size / (sampleRate * channels);
    }

    public short[] getRawSamples() {
        return Arrays.copyOf(samples, size);
    }

    /**
     * Converts to normalized float array [-1.0f, +1.0f].
     */
    public float[] toFloatArray() {
        float[] floats = new float[size];
        for (int i = 0; i < size; i++) {
            floats[i] = samples[i] / 32768.0f;
        }
        return floats;
    }

    /**
     * Converts to raw 16-bit little-endian byte array.
     */
    public byte[] toByteArray() {
        byte[] bytes = new byte[size * 2];
        for (int i = 0; i < size; i++) {
            short s = samples[i];
            bytes[i * 2] = (byte) (s & 0xFF);
            bytes[i * 2 + 1] = (byte) ((s >> 8) & 0xFF);
        }
        return bytes;
    }

    /**
     * Calculates the Root-Mean-Square (RMS) energy over the buffer.
     */
    public double calculateRms() {
        if (size == 0) return 0.0;
        double sumSquare = 0.0;
        for (int i = 0; i < size; i++) {
            double normalized = samples[i] / 32768.0;
            sumSquare += normalized * normalized;
        }
        return Math.sqrt(sumSquare / size);
    }

    /**
     * Calculates RMS in decibels relative to full scale (dBFS).
     */
    public double calculateRmsDb() {
        double rms = calculateRms();
        if (rms <= 1e-7) return -120.0;
        return 20.0 * Math.log10(rms);
    }
}
