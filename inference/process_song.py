#!/usr/bin/env python3
"""
StemFlow neural audio -> stems -> MIDI engine.

This is deliberately a headless engine. The web UI is only a transport/control surface.
Separation is performed by a real Demucs neural model and melodic transcription by
Spotify Basic Pitch. Drum MIDI uses onset/spectral classification because Basic Pitch
is not a drum transcription model.

Expected external dependency:
  ffmpeg must be installed and available on PATH.

Environment:
  STEMFLOW_DEMUCS_MODEL=htdemucs_6s
  STEMFLOW_DEMUCS_SHIFTS=1
  STEMFLOW_DEMUCS_SEGMENT=7
  STEMFLOW_DEMUCS_OVERLAP=0.25
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Dict

import librosa
import numpy as np
from basic_pitch import ICASSP_2022_MODEL_PATH
from basic_pitch.inference import Model, predict
import mido


STEMS = ("vocals", "bass", "drums", "guitar", "piano", "other")
MIDI_CHANNELS = {
    "vocals": 0,
    "bass": 1,
    "drums": 9,
    "guitar": 2,
    "piano": 3,
    "other": 4,
}
PITCH_RANGES = {
    "vocals": (70.0, 1400.0),
    "bass": (28.0, 400.0),
    "guitar": (65.0, 1600.0),
    "piano": (27.0, 5000.0),
    "other": (35.0, 6000.0),
}


def log(stage: str, message: str) -> None:
    print(json.dumps({"stage": stage, "message": message}), flush=True)


def run_checked(command: list[str]) -> None:
    log("command", " ".join(command))
    completed = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if completed.returncode != 0:
        tail = completed.stdout[-8000:]
        raise RuntimeError(f"Command failed ({completed.returncode}): {tail}")


def find_demucs_output(root: Path, input_path: Path, model: str) -> Path:
    expected = root / model / input_path.stem
    if expected.exists():
        return expected

    candidates = list(root.glob("**/vocals.wav"))
    if candidates:
        return candidates[0].parent
    raise FileNotFoundError("Demucs completed but no separated stems were found.")


def choose_basic_pitch_model() -> Model:
    # Prefer the package's ONNX model so the inference environment does not need
    # the heavyweight TensorFlow runtime.
    try:
        onnx_path = Path(ICASSP_2022_MODEL_PATH).parent / "nmp.onnx"
        if onnx_path.exists():
            return Model(onnx_path)
    except Exception:
        pass
    return Model(ICASSP_2022_MODEL_PATH)


def transcribe_basic_pitch(
    audio_path: Path,
    output_path: Path,
    model: Model,
    minimum_frequency: float,
    maximum_frequency: float,
) -> Dict[str, float]:
    model_output, midi_data, note_events = predict(
        str(audio_path),
        model,
        onset_threshold=0.45,
        frame_threshold=0.30,
        minimum_note_length=60,
        minimum_frequency=minimum_frequency,
        maximum_frequency=maximum_frequency,
        multiple_pitch_bends=True,
        melodia_trick=True,
    )
    midi_data.write(str(output_path))
    return {
        "notes": float(len(note_events)),
        "events": float(len(note_events)),
    }


def band_energy(y: np.ndarray, sr: int, low: float, high: float) -> float:
    spec = np.abs(librosa.stft(y, n_fft=2048, hop_length=256, center=True))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    mask = (freqs >= low) & (freqs < high)
    if not np.any(mask):
        return 0.0
    return float(np.mean(spec[mask]))


def transcribe_drums(audio_path: Path, output_path: Path) -> Dict[str, float]:
    y, sr = librosa.load(str(audio_path), sr=None, mono=True)
    if y.size == 0:
        raise RuntimeError("Drum stem is empty.")

    hop = 256
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, aggregate=np.median)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop,
        units="frames",
        backtrack=True,
    )

    midi = mido.MidiFile(type=1, ticks_per_beat=480)
    track = mido.MidiTrack()
    track.append(mido.MetaMessage("track_name", name="Drums", time=0))

    events = []
    for frame in onset_frames:
        sample = int(frame * hop)
        left = max(0, sample - int(sr * 0.018))
        right = min(y.size, sample + int(sr * 0.045))
        window = y[left:right]
        if window.size < 16:
            continue

        low = band_energy(window, sr, 35, 180)
        mid = band_energy(window, sr, 180, 2500)
        high = band_energy(window, sr, 5000, min(16000, sr / 2 - 1))
        total = max(1e-9, low + mid + high)

        if low / total > 0.48:
            pitch = 36  # kick
        elif high / total > 0.32:
            pitch = 42  # closed hat
        else:
            pitch = 38  # snare / mid percussion

        t = float(librosa.frames_to_time(frame, sr=sr, hop_length=hop))
        strength = float(onset_env[frame]) if frame < len(onset_env) else 0.5
        velocity = int(np.clip(45 + strength * 55, 45, 127))
        events.append((t, pitch, velocity))

    # Basic Pitch-style event timing is seconds. Convert seconds to MIDI ticks
    # against a fixed 120 BPM tempo, preserving absolute timing without forcing
    # the performance onto a grid.
    tempo = mido.bpm2tempo(120)
    previous_tick = 0
    for t, pitch, velocity in events:
        start_tick = int(round(mido.second2tick(t, 480, tempo)))
        delta = max(0, start_tick - previous_tick)
        track.append(mido.Message("note_on", channel=9, note=pitch, velocity=velocity, time=delta))
        track.append(mido.Message("note_off", channel=9, note=pitch, velocity=0, time=24))
        previous_tick = start_tick + 24

    track.append(mido.MetaMessage("end_of_track", time=0))
    midi.tracks.append(track)
    midi.save(str(output_path))
    return {"notes": float(len(events)), "events": float(len(events))}


def build_combined_midi(midi_paths: Dict[str, Path], output_path: Path) -> None:
    combined = mido.MidiFile(type=1, ticks_per_beat=480)
    tempo_track = mido.MidiTrack()
    tempo_track.append(mido.MetaMessage("track_name", name="StemFlow Tempo", time=0))
    tempo_track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(120), time=0))
    combined.tracks.append(tempo_track)

    for stem in STEMS:
        source = mido.MidiFile(str(midi_paths[stem]))
        source_track = source.tracks[0] if source.tracks else mido.MidiTrack()
        track = mido.MidiTrack()
        track.append(mido.MetaMessage("track_name", name=stem.title(), time=0))
        for msg in source_track:
            if msg.type == "track_name" or msg.type == "end_of_track":
                continue
            if msg.is_meta:
                track.append(msg.copy())
            elif msg.type in {"note_on", "note_off", "control_change", "pitchwheel", "program_change"}:
                track.append(msg.copy(channel=MIDI_CHANNELS[stem]))
        combined.tracks.append(track)

    combined.save(str(output_path))


def write_analysis(output_dir: Path, input_path: Path, metrics: Dict[str, object]) -> Path:
    analysis_path = output_dir / "analysis.json"
    analysis_path.write_text(
        json.dumps(
            {
                "engine": "StemFlow Neural Engine",
                "input": input_path.name,
                "separator": os.environ.get("STEMFLOW_DEMUCS_MODEL", "htdemucs_6s"),
                "transcription": "Spotify Basic Pitch + spectral drum onset classifier",
                "metrics": metrics,
                "limitations": [
                    "Source separation is model-based and therefore contains residual bleed/artifacts.",
                    "Guitar and piano quality depends strongly on the source mix; htdemucs_6s is an experimental six-source Demucs model.",
                    "Drum MIDI is onset/classification based rather than a dedicated neural drum transcription model.",
                    "No MIDI quantization is applied by this engine."
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return analysis_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output_zip")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_zip = Path(args.output_zip).resolve()
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    model_name = os.environ.get("STEMFLOW_DEMUCS_MODEL", "htdemucs_6s")
    shifts = os.environ.get("STEMFLOW_DEMUCS_SHIFTS", "1")
    segment = os.environ.get("STEMFLOW_DEMUCS_SEGMENT", "7")
    overlap = os.environ.get("STEMFLOW_DEMUCS_OVERLAP", "0.25")

    with tempfile.TemporaryDirectory(prefix="stemflow-") as work:
        workdir = Path(work)
        separated_root = workdir / "separated"
        midi_root = workdir / "midi"
        midi_root.mkdir()

        log("separation", f"Running real Demucs model {model_name}.")
        run_checked([
            sys.executable, "-m", "demucs",
            "-n", model_name,
            "--segment", segment,
            "--overlap", overlap,
            "--shifts", shifts,
            "-o", str(separated_root),
            str(input_path),
        ])
        stem_dir = find_demucs_output(separated_root, input_path, model_name)

        for stem in STEMS:
            if not (stem_dir / f"{stem}.wav").exists():
                raise FileNotFoundError(f"Required Demucs stem missing: {stem}.wav")

        log("transcription", "Loading Basic Pitch model once for all melodic stems.")
        bp_model = choose_basic_pitch_model()
        metrics: Dict[str, object] = {}

        midi_paths: Dict[str, Path] = {}
        for stem in STEMS:
            audio_path = stem_dir / f"{stem}.wav"
            midi_path = midi_root / f"{stem}.mid"
            log("transcription", f"Transcribing {stem}.")
            if stem == "drums":
                stem_metrics = transcribe_drums(audio_path, midi_path)
            else:
                lo, hi = PITCH_RANGES[stem]
                stem_metrics = transcribe_basic_pitch(audio_path, midi_path, bp_model, lo, hi)
            midi_paths[stem] = midi_path
            metrics[stem] = stem_metrics

        combined_path = midi_root / "combined.mid"
        build_combined_midi(midi_paths, combined_path)
        analysis_path = write_analysis(workdir, input_path, metrics)

        log("package", "Packaging stems, MIDI, and analysis report.")
        output_zip.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for stem in STEMS:
                zf.write(stem_dir / f"{stem}.wav", f"stems/{stem}.wav")
                zf.write(midi_paths[stem], f"midi/{stem}.mid")
            zf.write(combined_path, "midi/combined.mid")
            zf.write(analysis_path, "analysis.json")

    log("complete", f"Created {output_zip}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"stage": "error", "message": str(exc)}), file=sys.stderr, flush=True)
        raise
