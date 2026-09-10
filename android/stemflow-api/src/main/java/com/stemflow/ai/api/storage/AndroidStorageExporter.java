package com.stemflow.ai.api.storage;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Robust Android storage exporter supporting Scoped Storage (API 29+ MediaStore)
 * and legacy storage access.
 */
public class AndroidStorageExporter {

    public static class ExportResult {
        public boolean success;
        public String filePath;
        public String uriString;
        public long byteCount;
        public String mimeType;

        public ExportResult(boolean success, String filePath, String uriString, long byteCount, String mimeType) {
            this.success = success;
            this.filePath = filePath;
            this.uriString = uriString;
            this.byteCount = byteCount;
            this.mimeType = mimeType;
        }
    }

    /**
     * Exports MIDI bytes to user's device storage (Downloads or Music folder).
     */
    public static ExportResult saveMidiFile(Context context, byte[] midiBytes, String filename) throws IOException {
        String cleanName = sanitizeFilename(filename);
        if (!cleanName.toLowerCase().endsWith(".mid")) {
            cleanName += ".mid";
        }
        String mimeType = "audio/midi";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, cleanName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/StemFlowAI");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            ContentResolver resolver = context.getContentResolver();
            Uri collectionUri = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri itemUri = resolver.insert(collectionUri, values);

            if (itemUri == null) {
                throw new IOException("Failed to create MediaStore entry for MIDI file");
            }

            try (OutputStream os = resolver.openOutputStream(itemUri)) {
                if (os == null) throw new IOException("Unable to open output stream for MediaStore Uri");
                os.write(midiBytes);
                os.flush();
            }

            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(itemUri, values, null, null);

            return new ExportResult(true, itemUri.toString(), itemUri.toString(), midiBytes.length, mimeType);
        } else {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File stemFlowDir = new File(downloadsDir, "StemFlowAI");
            if (!stemFlowDir.exists()) stemFlowDir.mkdirs();

            File targetFile = new File(stemFlowDir, cleanName);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(midiBytes);
                fos.flush();
            }
            return new ExportResult(true, targetFile.getAbsolutePath(), Uri.fromFile(targetFile).toString(), midiBytes.length, mimeType);
        }
    }

    /**
     * Exports WAV bytes to user's device Music folder.
     */
    public static ExportResult saveWavFile(Context context, byte[] wavBytes, String filename) throws IOException {
        String cleanName = sanitizeFilename(filename);
        if (!cleanName.toLowerCase().endsWith(".wav")) {
            cleanName += ".wav";
        }
        String mimeType = "audio/wav";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Audio.Media.DISPLAY_NAME, cleanName);
            values.put(MediaStore.Audio.Media.MIME_TYPE, mimeType);
            values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/StemFlowAI");
            values.put(MediaStore.Audio.Media.IS_PENDING, 1);

            ContentResolver resolver = context.getContentResolver();
            Uri collectionUri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri itemUri = resolver.insert(collectionUri, values);

            if (itemUri == null) {
                throw new IOException("Failed to create MediaStore entry for WAV stem");
            }

            try (OutputStream os = resolver.openOutputStream(itemUri)) {
                if (os == null) throw new IOException("Unable to open output stream for WAV Uri");
                os.write(wavBytes);
                os.flush();
            }

            values.clear();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            resolver.update(itemUri, values, null, null);

            return new ExportResult(true, itemUri.toString(), itemUri.toString(), wavBytes.length, mimeType);
        } else {
            File musicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
            File stemFlowDir = new File(musicDir, "StemFlowAI");
            if (!stemFlowDir.exists()) stemFlowDir.mkdirs();

            File targetFile = new File(stemFlowDir, cleanName);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(wavBytes);
                fos.flush();
            }
            return new ExportResult(true, targetFile.getAbsolutePath(), Uri.fromFile(targetFile).toString(), wavBytes.length, mimeType);
        }
    }

    /**
     * Saves JSON analysis report to disk.
     */
    public static ExportResult saveJsonReport(Context context, String jsonContent, String filename) throws IOException {
        String cleanName = sanitizeFilename(filename);
        if (!cleanName.toLowerCase().endsWith(".json")) {
            cleanName += ".json";
        }
        byte[] bytes = jsonContent.getBytes(StandardCharsets.UTF_8);
        return saveMidiFile(context, bytes, cleanName);
    }

    private static String sanitizeFilename(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "stemflow_export_" + System.currentTimeMillis();
        }
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
