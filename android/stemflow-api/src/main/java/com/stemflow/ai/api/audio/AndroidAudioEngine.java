package com.stemflow.ai.api.audio;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native Android hardware audio recording and real-time DSP feature extraction engine.
 */
public class AndroidAudioEngine {
    private static final int DEFAULT_SAMPLE_RATE = 44100;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;

    private final Context context;
    private final int sampleRate;
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private final AtomicBoolean isRecording = new AtomicBoolean(false);
    private PcmAudioBuffer capturedBuffer;

    public interface AudioCaptureListener {
        void onAudioChunk(short[] chunk, int length, double currentRmsDb, double spectralCentroidHz);
        void onError(String errorMessage);
    }

    public AndroidAudioEngine(Context context) {
        this(context, DEFAULT_SAMPLE_RATE);
    }

    public AndroidAudioEngine(Context context, int sampleRate) {
        this.context = context.getApplicationContext();
        this.sampleRate = sampleRate;
    }

    public boolean isRecording() {
        return isRecording.get();
    }

    public int getSampleRate() {
        return sampleRate;
    }

    /**
     * Starts background recording and live audio feature extraction.
     */
    @SuppressLint("MissingPermission")
    public synchronized void startRecording(final AudioCaptureListener listener) {
        if (isRecording.get()) {
            if (listener != null) listener.onError("Audio recording is already in progress");
            return;
        }

        int minBufferSize = AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT);
        if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
            if (listener != null) listener.onError("Hardware does not support sample rate: " + sampleRate);
            return;
        }

        int bufferSize = Math.max(minBufferSize * 2, 4096);
        int audioSource = MediaRecorder.AudioSource.MIC;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            audioSource = MediaRecorder.AudioSource.UNPROCESSED;
        }

        try {
            audioRecord = new AudioRecord(audioSource, sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT, bufferSize);
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                // Fallback to standard MIC source if UNPROCESSED is unsupported
                audioRecord.release();
                audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT, bufferSize);
                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    if (listener != null) listener.onError("Failed to initialize AudioRecord hardware");
                    return;
                }
            }

            capturedBuffer = new PcmAudioBuffer(sampleRate, 1, sampleRate * 10);
            audioRecord.startRecording();
            isRecording.set(true);

            final int readChunkSize = 2048;
            recordingThread = new Thread(() -> {
                short[] readBuffer = new short[readChunkSize];
                while (isRecording.get()) {
                    int readResult = audioRecord.read(readBuffer, 0, readChunkSize);
                    if (readResult > 0) {
                        capturedBuffer.append(readBuffer, readResult);

                        if (listener != null) {
                            // Compute live metrics
                            double sumSquare = 0.0;
                            for (int i = 0; i < readResult; i++) {
                                double norm = readBuffer[i] / 32768.0;
                                sumSquare += norm * norm;
                            }
                            double rms = Math.sqrt(sumSquare / readResult);
                            double rmsDb = (rms > 1e-7) ? (20.0 * Math.log10(rms)) : -120.0;
                            double centroidHz = FastFourierTransform.computeSpectralCentroid(readBuffer, sampleRate);

                            listener.onAudioChunk(readBuffer, readResult, rmsDb, centroidHz);
                        }
                    } else if (readResult < 0) {
                        if (listener != null) {
                            listener.onError("AudioRecord read error code: " + readResult);
                        }
                        break;
                    }
                }
            }, "StemFlowAudioRecordThread");

            recordingThread.start();
        } catch (Exception e) {
            isRecording.set(false);
            if (listener != null) listener.onError("Audio capture initialization exception: " + e.getMessage());
        }
    }

    /**
     * Halts recording and returns the captured audio buffer.
     */
    public synchronized PcmAudioBuffer stopRecording() {
        if (!isRecording.get()) {
            return capturedBuffer;
        }

        isRecording.set(false);
        if (recordingThread != null) {
            try {
                recordingThread.join(1000);
            } catch (InterruptedException ignored) {}
            recordingThread = null;
        }

        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception ignored) {}
            audioRecord = null;
        }

        return capturedBuffer;
    }

    /**
     * Interrogates the device for professional low-latency audio capabilities.
     */
    public DeviceAudioCapabilities queryDeviceAudioCapabilities() {
        DeviceAudioCapabilities caps = new DeviceAudioCapabilities();
        PackageManager pm = context.getPackageManager();

        caps.hasLowLatencyAudio = pm.hasSystemFeature(PackageManager.FEATURE_AUDIO_LOW_LATENCY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            caps.hasProAudio = pm.hasSystemFeature(PackageManager.FEATURE_AUDIO_PRO);
        }
        caps.hasMicrophone = pm.hasSystemFeature(PackageManager.FEATURE_MICROPHONE);

        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
            String nativeSampleRateStr = am.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE);
            String nativeBufferSizeStr = am.getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER);
            try {
                if (nativeSampleRateStr != null) caps.nativeSampleRate = Integer.parseInt(nativeSampleRateStr);
                if (nativeBufferSizeStr != null) caps.nativeOptimalBufferSize = Integer.parseInt(nativeBufferSizeStr);
            } catch (NumberFormatException ignored) {}
        }

        return caps;
    }

    public static class DeviceAudioCapabilities {
        public boolean hasLowLatencyAudio = false;
        public boolean hasProAudio = false;
        public boolean hasMicrophone = true;
        public int nativeSampleRate = 44100;
        public int nativeOptimalBufferSize = 256;
    }
}
