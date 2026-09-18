# StemFlow Neural Engine

This directory contains the actual audio-analysis engine. The browser does not perform stem separation anymore.

Pipeline:

Audio file -> Demucs htdemucs_6s -> six WAV stems -> Basic Pitch on melodic stems + spectral drum transcription -> individual MIDI -> combined MIDI -> ZIP

Install:

1. Python 3.10+
2. ffmpeg on PATH
3. `python -m pip install -r inference/requirements.txt`

Run manually:

`python inference/process_song.py input.wav output.zip`

The first Demucs run downloads the model weights. The six-source `htdemucs_6s` model produces drums, bass, vocals, other, guitar, and piano. The model is real neural inference, not a browser filter graph.

For higher separation quality, the environment variables can select a different Demucs model where its source layout is compatible:

`STEMFLOW_DEMUCS_MODEL=htdemucs_6s`

`STEMFLOW_DEMUCS_SHIFTS=2`

`STEMFLOW_DEMUCS_SEGMENT=7`

The engine intentionally does not claim a synthetic accuracy percentage. `analysis.json` records the actual engine and known limitations.

Basic Pitch is used because it is a lightweight neural AMT model that supports polyphonic transcription and pitch bends. It works best when given one instrument at a time, which is exactly why separation happens first.
