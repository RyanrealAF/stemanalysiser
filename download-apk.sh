#!/bin/bash

# Download StemFlow AI APK

APK_URL="https://github.com/RyanrealAF/stemanalysiser/raw/main/public/apk/StemFlow-AI-debug.apk"
OUTPUT_FILE="StemFlow-AI-debug.apk"

echo "Downloading StemFlow AI APK..."
curl -L -o "$OUTPUT_FILE" "$APK_URL"

if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "✅ Download complete!"
    echo "File: $OUTPUT_FILE"
    echo "Size: $FILE_SIZE"
else
    echo "❌ Download failed"
    exit 1
fi
