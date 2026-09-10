package com.stemflow.ai.api;

import android.content.Context;
import com.stemflow.ai.api.audio.AndroidAudioEngine;
import com.stemflow.ai.api.audio.PcmAudioBuffer;
import com.stemflow.ai.api.audio.WavWriter;
import com.stemflow.ai.api.client.ApiCallback;
import com.stemflow.ai.api.client.StemFlowClient;
import com.stemflow.ai.api.midi.MidiFileWriter;
import com.stemflow.ai.api.model.MidiNote;
import com.stemflow.ai.api.model.SongAnalysisRequest;
import com.stemflow.ai.api.model.SongAnalysisResponse;
import com.stemflow.ai.api.model.StemType;
import com.stemflow.ai.api.storage.AndroidStorageExporter;

import java.io.IOException;
import java.util.List;

/**
 * Main SDK entry point and façade for StemFlow AI on Android.
 */
public class StemFlowApi {
    private static volatile StemFlowApi instance;

    private final Context context;
    private final StemFlowClient client;
    private final AndroidAudioEngine audioEngine;

    public static class Builder {
        private final Context context;
        private String serverBaseUrl = "http://10.0.2.2:3000";
        private int sampleRate = 44100;

        public Builder(Context context) {
            this.context = context.getApplicationContext();
        }

        public Builder setServerBaseUrl(String serverBaseUrl) {
            this.serverBaseUrl = serverBaseUrl;
            return this;
        }

        public Builder setSampleRate(int sampleRate) {
            this.sampleRate = sampleRate;
            return this;
        }

        public StemFlowApi build() {
            StemFlowClient client = new StemFlowClient.Builder()
                .setBaseUrl(serverBaseUrl)
                .build();
            AndroidAudioEngine audioEngine = new AndroidAudioEngine(context, sampleRate);
            return new StemFlowApi(context, client, audioEngine);
        }
    }

    private StemFlowApi(Context context, StemFlowClient client, AndroidAudioEngine audioEngine) {
        this.context = context;
        this.client = client;
        this.audioEngine = audioEngine;
    }

    public static synchronized StemFlowApi init(Context context, String serverBaseUrl) {
        if (instance == null) {
            instance = new Builder(context).setServerBaseUrl(serverBaseUrl).build();
        }
        return instance;
    }

    public static StemFlowApi getInstance() {
        if (instance == null) {
            throw new IllegalStateException("StemFlowApi must be initialized with StemFlowApi.init(context, baseUrl) before use.");
        }
        return instance;
    }

    public Context getContext() {
        return context;
    }

    public StemFlowClient getClient() {
        return client;
    }

    public AndroidAudioEngine getAudioEngine() {
        return audioEngine;
    }

    /**
     * Queries device audio hardware capabilities (low-latency audio, native sample rate).
     */
    public AndroidAudioEngine.DeviceAudioCapabilities queryAudioCapabilities() {
        return audioEngine.queryDeviceAudioCapabilities();
    }

    /**
     * Dispatches song analysis to the Gemini LLM orchestration server.
     */
    public void analyzeSong(SongAnalysisRequest request, ApiCallback<SongAnalysisResponse> callback) {
        client.analyzeSong(request, callback);
    }

    /**
     * Serializes MIDI notes to Standard MIDI Format Type 1 and saves directly to Android storage.
     */
    public AndroidStorageExporter.ExportResult exportMidiToDevice(List<MidiNote> notes, double bpm, StemType stem, String filename) throws IOException {
        byte[] midiBytes = MidiFileWriter.generateType1Midi(notes, bpm, stem);
        return AndroidStorageExporter.saveMidiFile(context, midiBytes, filename);
    }

    /**
     * Serializes 16-bit PCM audio samples to WAV and saves directly to Android storage.
     */
    public AndroidStorageExporter.ExportResult exportWavToDevice(short[] samples, int sampleRate, int numChannels, String filename) throws IOException {
        byte[] wavBytes = WavWriter.encodeToWavBytes(samples, sampleRate, numChannels);
        return AndroidStorageExporter.saveWavFile(context, wavBytes, filename);
    }
}
