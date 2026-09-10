# StemFlow AI — Multi-Stem Separation & Packaged Android API

**Official Git Repository**: [https://github.com/RyanrealAF/stemanalysiser](https://github.com/RyanrealAF/stemanalysiser)

StemFlow AI is a high-accuracy audio stem separation, feature extraction, and multi-track MIDI transcription system paired with a production-ready, packaged Android API (`com.stemflow.ai.api`).

---

## 🚀 Quick Links

- **Repository**: [https://github.com/RyanrealAF/stemanalysiser](https://github.com/RyanrealAF/stemanalysiser)
- **Clone URL**: `git clone https://github.com/RyanrealAF/stemanalysiser.git`
- **Android API Module**: [`android/stemflow-api`](https://github.com/RyanrealAF/stemanalysiser/tree/main/android/stemflow-api)
- **CI/CD Build Workflow**: [`.github/workflows/build-apk.yaml`](https://github.com/RyanrealAF/stemanalysiser/blob/main/.github/workflows/build-apk.yaml)
- **Architecture Specification**: [`STEMFLOW_AI_ARCHITECTURE.md`](./STEMFLOW_AI_ARCHITECTURE.md)

---

## 📱 Packaged Android API (`com.stemflow.ai.api`)

The project includes an Android API library (`.aar`) in `android/stemflow-api/` for real-time mobile audio recording, FFT spectral analysis, lossless WAV generation, and standard Type 1 MIDI serialization.

### 1. Add to Android Project

```groovy
// settings.gradle
include ':app'
include ':stemflow-api'
project(':stemflow-api').projectDir = new File(rootDir, 'android/stemflow-api')
```

Or drop `stemflow-api-1.0.0.aar` directly into your `libs/` folder:

```groovy
// app/build.gradle
dependencies {
    implementation files('libs/stemflow-api-1.0.0.aar')
    implementation 'com.google.code.gson:gson:2.10.1'
}
```

### 2. Available Android API Classes

- `com.stemflow.ai.api.StemFlowApi`: Master singleton API client for Android audio capture and analysis dispatch.
- `com.stemflow.ai.api.audio.AndroidAudioEngine`: Real-time low-latency audio capture via `AudioRecord` with Hann-windowed FFT.
- `com.stemflow.ai.api.audio.FastFourierTransform`: Radix-2 Cooley-Tukey FFT for spectral centroid calculation.
- `com.stemflow.ai.api.audio.WavWriter`: Lossless 16-bit 44.1 kHz PCM RIFF/WAVE serializer.
- `com.stemflow.ai.api.midi.MidiFileWriter`: Standard MIDI File (SMF Type 1) binary serializer with variable-length quantity (VLQ) encoding and pitch bends.
- `com.stemflow.ai.api.storage.AndroidStorageExporter`: Scoped storage writer for Android 10+ (`MediaStore.Downloads`).
- `com.stemflow.ai.api.client.StemFlowClient`: Thread-pooled client for connecting to Gemini stem analysis backend endpoints.

---

## ⚙️ Web & Server Running Locally

```bash
# Install dependencies
npm install

# Start Express server + Vite development environment
npm run dev

# Compile production bundle
npm run build
```

---

## 📦 Verified Binaries & Artifacts

- **Android Standalone App**: `public/apk/StemFlow-AI-debug.apk` (4.42 MB, SHA-256: `b803bf706952203adbbb63d86f5925c23b2be5d7753fe86daf7d9aa1f59537d8`)
- **Android Archive Library**: `public/aar/stemflow-api-release.aar` (46.5 KB)
- **SDK Developer Bundle**: `public/stemflow-android-sdk.zip` (50.0 KB)
