# StemFlow AI — Packaged Android API SDK

The **StemFlow AI Android API** (`com.stemflow.ai.api`) is a native Android library that provides:
1. **Multi-Track Standard MIDI (SMF Type 1) Binary Serialization** (`MidiFileWriter`): Mathematical generation of Type 1 MIDI files containing dedicated tracks for all 6 stems (Vocals, Bass, Drums, Guitar, Piano, Other) with 14-bit Pitch Bend, dynamic velocity, and CC automation lanes (CC1, CC11, CC64, CC74).
2. **Native PCM Audio Recording & Real-Time DSP** (`AndroidAudioEngine`, `FastFourierTransform`): Direct hardware capture via Android `AudioRecord` with Hann-windowed Radix-2 Cooley-Tukey FFT Spectral Centroid extraction and decibel RMS metering.
3. **Lossless WAV Serialization** (`WavWriter`): 44-byte RIFF/WAVE header binary generation for uncompressed 16-bit 44.1 kHz PCM stem exports.
4. **Android MediaStore & Scoped Storage Exporter** (`AndroidStorageExporter`): Automatic handling of Android 10+ (API 29–36) `MediaStore.Downloads` and `MediaStore.Audio.Media` with `IS_PENDING` isolation.
5. **Gemini Arrangement Client** (`StemFlowClient`): High-efficiency HTTP client with thread pools, connecting to StemFlow AI orchestration endpoints (`/api/analyze-song`, `/api/health`, `/api/models-info`).

---

## 1. Gradle Installation

Add the `:stemflow-api` module to your Android app's `settings.gradle`:

```groovy
include ':app'
include ':stemflow-api'
project(':stemflow-api').projectDir = new File('./stemflow-api')
```

And in your `app/build.gradle`:

```groovy
dependencies {
    implementation project(':stemflow-api')
}
```

---

## 2. Android Manifest Permissions

Add the following permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<!-- Scoped Storage permissions for writing MIDI/WAV to MediaStore -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

<uses-feature android:name="android.hardware.microphone" android:required="false" />
```

---

## 3. Java Quickstart

### 3.1 Initialize the SDK

```java
import com.stemflow.ai.api.StemFlowApi;

// In your Application or Activity onCreate:
StemFlowApi stemFlow = StemFlowApi.init(context, "https://your-stemflow-server.run.app");
```

### 3.2 Query Device Low-Latency Audio Capabilities

```java
AndroidAudioEngine.DeviceAudioCapabilities caps = stemFlow.queryAudioCapabilities();
Log.d("StemFlow", "Low Latency Audio: " + caps.hasLowLatencyAudio);
Log.d("StemFlow", "Pro Audio Flag: " + caps.hasProAudio);
Log.d("StemFlow", "Native Sample Rate: " + caps.nativeSampleRate);
Log.d("StemFlow", "Optimal Buffer Frames: " + caps.nativeOptimalBufferSize);
```

### 3.3 Record Native Audio with Real-Time DSP Feature Extraction

```java
stemFlow.getAudioEngine().startRecording(new AndroidAudioEngine.AudioCaptureListener() {
    @Override
    public void onAudioChunk(short[] chunk, int length, double currentRmsDb, double spectralCentroidHz) {
        // Real-time audio meter update
        Log.d("StemFlow", String.format("RMS: %.1f dB | Centroid: %.0f Hz", currentRmsDb, spectralCentroidHz));
    }

    @Override
    public void onError(String errorMessage) {
        Log.e("StemFlow", "Recording error: " + errorMessage);
    }
});

// To stop recording and retrieve PCM buffer:
PcmAudioBuffer buffer = stemFlow.getAudioEngine().stopRecording();
Log.d("StemFlow", "Captured duration: " + buffer.getDurationSec() + " seconds");
```

### 3.4 Generate and Save Type 1 MIDI File

```java
List<MidiNote> notes = new ArrayList<>();
notes.add(new MidiNote("note-1", StemType.BASS, 36, 0.0, 0.5, 100, false, "staccato"));
notes.add(new MidiNote("note-2", StemType.VOCALS, 60, 0.5, 1.2, 95, false, "legato"));

// Exports directly to Android MediaStore Downloads folder
AndroidStorageExporter.ExportResult result = stemFlow.exportMidiToDevice(
    notes,
    120.0,      // BPM
    null,       // null exports all stems into separate tracks
    "song_transcription.mid"
);

Log.d("StemFlow", "Saved MIDI at: " + result.uriString);
```

### 3.5 Dispatch Gemini Musical Analysis

```java
SongMetadata metadata = new SongMetadata("Midnight Groove", "StemFlow Artist", 118.0, "F Minor", 32.0, 44100, 2);
SongAnalysisRequest request = new SongAnalysisRequest(metadata, stemFeaturesList, correlationsList, collisionList);

stemFlow.analyzeSong(request, new ApiCallback<SongAnalysisResponse>() {
    @Override
    public void onSuccess(SongAnalysisResponse response) {
        Log.d("StemFlow", "Executive Summary: " + response.getExecutiveSummary());
        for (SectionAnalysis section : response.getSections()) {
            Log.d("StemFlow", section.getName() + " Tension: " + section.getHarmonicTensionScore());
        }
    }

    @Override
    public void onError(Throwable error) {
        Log.e("StemFlow", "Analysis failed", error);
    }
});
```

---

## 4. Kotlin Quickstart

```kotlin
// Initialize
val stemFlow = StemFlowApi.init(context, "https://your-stemflow-server.run.app")

// Query Hardware
val caps = stemFlow.queryAudioCapabilities()
println("Native buffer size: ${caps.nativeOptimalBufferSize}")

// Export MIDI
val exportResult = stemFlow.exportMidiToDevice(midiNotes, 120.0, null, "track.mid")
println("File exported to: ${exportResult.uriString}")
```
