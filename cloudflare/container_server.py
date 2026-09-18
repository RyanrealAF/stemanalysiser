#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
PORT = 8080


def json_response(handler: BaseHTTPRequestHandler, payload: dict, status: int = 200) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def safe_filename(value: str | None) -> str:
    raw = urllib.parse.unquote(value or "input-audio")
    name = Path(raw).name
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)
    return safe or "input-audio"


class Handler(BaseHTTPRequestHandler):
    server_version = "StemFlowNeural/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print("[Container]", fmt % args, flush=True)

    def do_GET(self) -> None:
        if self.path == "/health":
            json_response(self, {
                "status": "ok",
                "service": "StemFlow Neural Container",
                "engine": os.environ.get("STEMFLOW_DEMUCS_MODEL", "htdemucs_6s"),
            })
            return

        if self.path == "/api/health":
            json_response(self, {
                "status": "ok",
                "service": "StemFlow Neural Container",
                "engine": os.environ.get("STEMFLOW_DEMUCS_MODEL", "htdemucs_6s"),
            })
            return

        if self.path == "/api/models-info":
            json_response(self, {
                "engine": "StemFlow Neural Engine",
                "separator": os.environ.get("STEMFLOW_DEMUCS_MODEL", "htdemucs_6s"),
                "transcription": "Spotify Basic Pitch + spectral drum onset classifier",
                "output": ["vocals", "bass", "drums", "guitar", "piano", "other"],
                "accuracyScore": None,
            })
            return

        json_response(self, {"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if self.path != "/api/process-audio":
            json_response(self, {"error": "Not found"}, 404)
            return

        length_header = self.headers.get("Content-Length")
        if not length_header:
            json_response(self, {"error": "Content-Length is required."}, 411)
            return

        try:
            content_length = int(length_header)
        except ValueError:
            json_response(self, {"error": "Invalid Content-Length."}, 400)
            return

        if content_length <= 0:
            json_response(self, {"error": "Empty audio upload."}, 400)
            return

        if content_length > MAX_UPLOAD_BYTES:
            json_response(self, {"error": "Audio file exceeds the 1 GB upload limit."}, 413)
            return

        filename = safe_filename(self.headers.get("X-Filename"))
        suffix = Path(filename).suffix or ".wav"

        with tempfile.TemporaryDirectory(prefix="stemflow-request-") as work:
            workdir = Path(work)
            input_path = workdir / f"input{suffix}"
            output_zip = workdir / "stemflow-results.zip"

            remaining = content_length
            with input_path.open("wb") as output:
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise RuntimeError("Upload ended before Content-Length was satisfied.")
                    output.write(chunk)
                    remaining -= len(chunk)

            command = [
                "python",
                "/app/inference/process_song.py",
                str(input_path),
                str(output_zip),
            ]

            env = os.environ.copy()
            env.setdefault("STEMFLOW_DEMUCS_MODEL", "htdemucs_6s")
            env.setdefault("STEMFLOW_DEMUCS_SHIFTS", "1")
            env.setdefault("STEMFLOW_DEMUCS_SEGMENT", "7")
            env.setdefault("STEMFLOW_DEMUCS_OVERLAP", "0.25")
            env["PYTHONUNBUFFERED"] = "1"

            print(f"[Container] Processing {filename} ({content_length} bytes)", flush=True)

            completed = subprocess.run(
                command,
                env=env,
                stdout=None,
                stderr=None,
                check=False,
            )

            if completed.returncode != 0 or not output_zip.exists():
                json_response(self, {
                    "error": "Neural audio processing failed.",
                    "exitCode": completed.returncode,
                }, 500)
                return

            size = output_zip.stat().st_size
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header(
                "Content-Disposition",
                f'attachment; filename="{Path(filename).stem}_stemflow.zip"',
            )
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()

            with output_zip.open("rb") as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)


if __name__ == "__main__":
    print(f"[Container] StemFlow neural server listening on :{PORT}", flush=True)
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
