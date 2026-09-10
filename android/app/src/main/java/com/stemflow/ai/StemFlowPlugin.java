package com.stemflow.ai;

import android.Manifest;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.stemflow.ai.api.StemFlowApi;
import com.stemflow.ai.api.audio.AndroidAudioEngine;
import com.stemflow.ai.api.audio.PcmAudioBuffer;
import com.stemflow.ai.api.audio.WavWriter;
import com.stemflow.ai.api.client.ApiCallback;
import com.stemflow.ai.api.client.StemFlowClient;
import com.stemflow.ai.api.midi.MidiFileWriter;
import com.stemflow.ai.api.model.HealthResponse;
import com.stemflow.ai.api.model.MidiNote;
import com.stemflow.ai.api.model.SongAnalysisRequest;
import com.stemflow.ai.api.model.SongAnalysisResponse;
import com.stemflow.ai.api.model.SongMetadata;
import com.stemflow.ai.api.model.StemType;
import com.stemflow.ai.api.storage.AndroidStorageExporter;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Capacitor native bridge plugin exposing the packaged StemFlow Android API to JavaScript/TypeScript.
 */
@CapacitorPlugin(
    name = "StemFlow",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class StemFlowPlugin extends Plugin {
    private static final String TAG = "StemFlowPlugin";
    private AndroidAudioEngine audioEngine;
    private StemFlowClient apiClient;

    @Override
    public void load() {
        super.load();
        audioEngine = new AndroidAudioEngine(getContext(), 44100);
        apiClient = new StemFlowClient.Builder()
            .setBaseUrl("http://10.0.2.2:3000")
            .build();
    }

    /**
     * Interrogates the Android device for low-latency audio hardware and audio buffer specs.
     */
    @PluginMethod
    public void getDeviceAudioCapabilities(PluginCall call) {
        try {
            AndroidAudioEngine.DeviceAudioCapabilities caps = audioEngine.queryDeviceAudioCapabilities();
            JSObject ret = new JSObject();
            ret.put("hasLowLatencyAudio", caps.hasLowLatencyAudio);
            ret.put("hasProAudio", caps.hasProAudio);
            ret.put("hasMicrophone", caps.hasMicrophone);
            ret.put("nativeSampleRate", caps.nativeSampleRate);
            ret.put("nativeOptimalBufferSize", caps.nativeOptimalBufferSize);
            ret.put("platform", "android");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get audio capabilities", e);
            call.reject("Failed to query audio capabilities: " + e.getMessage());
        }
    }

    /**
     * Starts hardware AudioRecord capturing 16-bit PCM audio.
     */
    @PluginMethod
    public void startNativeRecording(PluginCall call) {
        if (!getPermissionState("microphone").equals(com.getcapacitor.PermissionState.GRANTED)) {
            call.reject("Microphone permission not granted");
            return;
        }

        try {
            audioEngine.startRecording(new AndroidAudioEngine.AudioCaptureListener() {
                @Override
                public void onAudioChunk(short[] chunk, int length, double currentRmsDb, double spectralCentroidHz) {
                    JSObject event = new JSObject();
                    event.put("rmsDb", currentRmsDb);
                    event.put("centroidHz", spectralCentroidHz);
                    event.put("chunkLength", length);
                    notifyListeners("audioLevelUpdate", event);
                }

                @Override
                public void onError(String errorMessage) {
                    JSObject errEvent = new JSObject();
                    errEvent.put("error", errorMessage);
                    notifyListeners("recordingError", errEvent);
                }
            });

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("sampleRate", audioEngine.getSampleRate());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start audio recording: " + e.getMessage());
        }
    }

    /**
     * Halts hardware recording and returns the raw PCM buffer metadata and base64 audio.
     */
    @PluginMethod
    public void stopNativeRecording(PluginCall call) {
        try {
            PcmAudioBuffer buffer = audioEngine.stopRecording();
            if (buffer == null) {
                call.reject("No audio buffer was recorded");
                return;
            }

            short[] rawSamples = buffer.getRawSamples();
            byte[] wavBytes = WavWriter.encodeToWavBytes(rawSamples, buffer.getSampleRate(), buffer.getChannels());
            String base64Wav = Base64.encodeToString(wavBytes, Base64.NO_WRAP);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("sampleCount", buffer.getSize());
            ret.put("sampleRate", buffer.getSampleRate());
            ret.put("durationSec", buffer.getDurationSec());
            ret.put("rmsDb", buffer.calculateRmsDb());
            ret.put("wavBase64", base64Wav);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop recording: " + e.getMessage());
        }
    }

    /**
     * Exports a Standard MIDI Format (SMF Type 1) file directly to Android MediaStore/Downloads.
     */
    @PluginMethod
    public void exportMidi(PluginCall call) {
        try {
            JSArray notesArray = call.getArray("notes");
            double bpm = call.getDouble("bpm", 120.0);
            String title = call.getString("title", "stemflow_transcription");
            String stemStr = call.getString("stem");

            StemType targetStem = stemStr != null ? StemType.fromString(stemStr) : null;
            List<MidiNote> notes = new ArrayList<>();

            if (notesArray != null) {
                for (int i = 0; i < notesArray.length(); i++) {
                    JSONObject noteJson = notesArray.getJSONObject(i);
                    MidiNote note = MidiNote.fromJsonObject(noteJson);
                    if (note != null) {
                        notes.add(note);
                    }
                }
            }

            byte[] midiBytes = MidiFileWriter.generateType1Midi(notes, bpm, targetStem);
            String filename = title.toLowerCase().replaceAll("[^a-z0-9_-]", "_") + ".mid";

            AndroidStorageExporter.ExportResult result = AndroidStorageExporter.saveMidiFile(
                getContext(),
                midiBytes,
                filename
            );

            JSObject ret = new JSObject();
            ret.put("success", result.success);
            ret.put("filePath", result.filePath);
            ret.put("uriString", result.uriString);
            ret.put("byteCount", result.byteCount);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error exporting MIDI on Android", e);
            call.reject("MIDI export error: " + e.getMessage());
        }
    }

    /**
     * Exports a lossless WAV file directly to Android MediaStore/Music.
     */
    @PluginMethod
    public void exportWav(PluginCall call) {
        try {
            String wavBase64 = call.getString("wavBase64");
            String filename = call.getString("filename", "stem.wav");

            if (wavBase64 == null || wavBase64.isEmpty()) {
                call.reject("Missing required wavBase64 data");
                return;
            }

            byte[] wavBytes = Base64.decode(wavBase64, Base64.DEFAULT);
            AndroidStorageExporter.ExportResult result = AndroidStorageExporter.saveWavFile(
                getContext(),
                wavBytes,
                filename
            );

            JSObject ret = new JSObject();
            ret.put("success", result.success);
            ret.put("filePath", result.filePath);
            ret.put("uriString", result.uriString);
            ret.put("byteCount", result.byteCount);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("WAV export error: " + e.getMessage());
        }
    }

    /**
     * Queries the StemFlow AI Server health status from native networking stack.
     */
    @PluginMethod
    public void checkServerHealth(PluginCall call) {
        String customBaseUrl = call.getString("baseUrl");
        StemFlowClient client = apiClient;
        if (customBaseUrl != null && !customBaseUrl.isEmpty()) {
            client = new StemFlowClient.Builder().setBaseUrl(customBaseUrl).build();
        }

        client.checkHealth(new ApiCallback<HealthResponse>() {
            @Override
            public void onSuccess(HealthResponse result) {
                JSObject ret = new JSObject();
                ret.put("status", result.getStatus());
                ret.put("service", result.getService());
                ret.put("geminiKeyConfigured", result.isGeminiKeyConfigured());
                ret.put("timestamp", result.getTimestamp());
                call.resolve(ret);
            }

            @Override
            public void onError(Throwable throwable) {
                call.reject("Health check failed: " + throwable.getMessage());
            }
        });
    }
}
