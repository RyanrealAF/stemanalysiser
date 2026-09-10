package com.stemflow.ai.api.audio;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Encodes 16-bit PCM audio samples into uncompressed RIFF/WAVE standard files.
 */
public class WavWriter {

    /**
     * Writes 16-bit PCM samples to a WAV file on disk.
     */
    public static void writeWavFile(File file, short[] samples, int sampleRate, int numChannels) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(file)) {
            writeWavToStream(fos, samples, sampleRate, numChannels);
        }
    }

    /**
     * Encodes 16-bit PCM samples into an in-memory WAV byte array.
     */
    public static byte[] encodeToWavBytes(short[] samples, int sampleRate, int numChannels) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream(44 + samples.length * 2);
        writeWavToStream(baos, samples, sampleRate, numChannels);
        return baos.toByteArray();
    }

    /**
     * Writes the complete 44-byte WAV header and PCM audio stream to an OutputStream.
     */
    public static void writeWavToStream(OutputStream os, short[] samples, int sampleRate, int numChannels) throws IOException {
        int bitsPerSample = 16;
        int subChunk2Size = samples.length * 2;
        int chunkSize = 36 + subChunk2Size;
        int byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        int blockAlign = numChannels * (bitsPerSample / 8);

        // 1. RIFF chunk descriptor
        os.write(new byte[] { 'R', 'I', 'F', 'F' });
        writeLittleEndianInt(os, chunkSize);
        os.write(new byte[] { 'W', 'A', 'V', 'E' });

        // 2. fmt sub-chunk
        os.write(new byte[] { 'f', 'm', 't', ' ' });
        writeLittleEndianInt(os, 16); // Subchunk1Size = 16 for PCM
        writeLittleEndianShort(os, (short) 1); // AudioFormat 1 = PCM
        writeLittleEndianShort(os, (short) numChannels);
        writeLittleEndianInt(os, sampleRate);
        writeLittleEndianInt(os, byteRate);
        writeLittleEndianShort(os, (short) blockAlign);
        writeLittleEndianShort(os, (short) bitsPerSample);

        // 3. data sub-chunk
        os.write(new byte[] { 'd', 'a', 't', 'a' });
        writeLittleEndianInt(os, subChunk2Size);

        // 4. PCM audio samples
        byte[] buffer = new byte[4096];
        int bufIdx = 0;
        for (short sample : samples) {
            buffer[bufIdx++] = (byte) (sample & 0xFF);
            buffer[bufIdx++] = (byte) ((sample >> 8) & 0xFF);
            if (bufIdx >= buffer.length) {
                os.write(buffer, 0, bufIdx);
                bufIdx = 0;
            }
        }
        if (bufIdx > 0) {
            os.write(buffer, 0, bufIdx);
        }
        os.flush();
    }

    private static void writeLittleEndianInt(OutputStream os, int value) throws IOException {
        os.write(value & 0xFF);
        os.write((value >> 8) & 0xFF);
        os.write((value >> 16) & 0xFF);
        os.write((value >> 24) & 0xFF);
    }

    private static void writeLittleEndianShort(OutputStream os, short value) throws IOException {
        os.write(value & 0xFF);
        os.write((value >> 8) & 0xFF);
    }
}
