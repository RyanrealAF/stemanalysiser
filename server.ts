/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { runGeminiFunctionalAnalysis } from './server/geminiService';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Route: Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'StemFlow AI Audio Intelligence Server',
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // API Route: Gemini Functional Analysis
  app.post('/api/analyze-song', async (req, res) => {
    try {
      const { metadata, stemFeatures, correlations, collisionTelemetry } = req.body;

      if (!metadata || !stemFeatures) {
        return res.status(400).json({ error: 'Missing required song metadata or stem features payload.' });
      }

      console.log(`[API] Processing Gemini functional analysis for "${metadata.title}" (${metadata.duration}s)...`);
      const analysisResult = await runGeminiFunctionalAnalysis(
        metadata,
        stemFeatures,
        correlations || [],
        Array.isArray(collisionTelemetry) ? collisionTelemetry : []
      );

      return res.json({
        success: true,
        ...analysisResult,
      });
    } catch (err: any) {
      console.error('[API] Error in /api/analyze-song:', err);
      return res.status(500).json({
        error: 'Failed to complete functional analysis',
        details: err.message || String(err),
      });
    }
  });

  // API Route: Backend Stem Separation & DSP Feature Extraction Engine Info
  app.get('/api/models-info', (req, res) => {
    res.json({
      dspPipeline: {
        separationGraph: 'Web Audio OfflineAudioContext Multi-Band Crossover Filter Graph',
        vocalFilter: 'Mid-Band Formant & Harmonic Extractor (280Hz-4.2kHz Bandpass + Peaking Filter)',
        drumFilter: 'Multi-Band Spectral Flux Transient Decomposition',
        dspFeatureEngine: 'RMS Energy, Spectral Centroid, Onset Density & Pearson Cross-Correlation',
      },
      transcriptionEngines: {
        foundation: 'Monophonic Sub-harmonic YIN / Autocorrelation with Parabolic Interpolation',
        lead: 'Spectral Salience & Formant Pitch Tracker with 14-bit Continuous Pitch Bends',
        texture: 'Chord / Harmony Voicing Detector (Triads & 7th chords)',
        drums: 'Multi-Band Transient Attack & Groove Pocket Tracker',
        ornaments: 'Expressive Unquantized Human Micro-timing Engine',
      },
      aiIntelligence: 'Gemini 3.7 Flash Backend (Arrangement & Section Analysis)',
    });
  });

  // Helper to locate compiled APK across possible output paths
  const getApkFilePath = () => {
    const candidates = [
      path.join(process.cwd(), 'public', 'app-debug.apk'),
      path.join(process.cwd(), 'public', 'apk', 'StemFlow-AI-debug.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
      path.join(process.cwd(), 'StemFlow-AI-debug.apk'),
      path.join(process.cwd(), 'dist', 'app-debug.apk'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  };

  // API Route: Android APK Download Endpoint (Direct Binary Stream)
  app.get(['/api/download-apk', '/app-debug.apk', '/download/StemFlow-AI.apk', '/apk/StemFlow-AI-debug.apk', '/StemFlow-AI-debug.apk'], (req, res) => {
    const apkPath = getApkFilePath();
    if (!apkPath || !fs.existsSync(apkPath)) {
      return res.status(404).json({ error: 'Android APK package not found on server.' });
    }
    const stat = fs.statSync(apkPath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="StemFlow-AI-debug.apk"');
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(apkPath, (err) => {
      if (err) {
        console.error('Error sending APK file:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Android APK package not found on server.' });
        }
      }
    });
  });

  // API Route: Android APK Base64 Endpoint (Immune to Mobile DownloadManager cookie stripping)
  app.get('/api/download-apk-base64', (req, res) => {
    const apkPath = getApkFilePath();
    if (!apkPath || !fs.existsSync(apkPath)) {
      return res.status(404).json({ error: 'Android APK package not found on server.' });
    }
    try {
      const fileBuffer = fs.readFileSync(apkPath);
      const stat = fs.statSync(apkPath);
      res.json({
        success: true,
        filename: 'StemFlow-AI-debug.apk',
        mimeType: 'application/vnd.android.package-archive',
        sizeBytes: stat.size,
        base64: fileBuffer.toString('base64'),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read APK file' });
    }
  });

  // API Route: Android AAR Library Download Endpoint
  app.get(['/api/download-aar', '/stemflow-api.aar', '/download/stemflow-api-release.aar'], (req, res) => {
    const aarPath = path.join(process.cwd(), 'public', 'aar', 'stemflow-api-release.aar');
    res.setHeader('Content-Type', 'application/java-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="stemflow-api-1.0.0.aar"');
    res.sendFile(aarPath, (err) => {
      if (err) {
        console.error('Error sending AAR file:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Android AAR library package not found on server.' });
        }
      }
    });
  });

  // API Route: Android SDK Developer Bundle (ZIP with AAR, Gradle snippet, and docs)
  app.get(['/api/download-sdk-bundle', '/download/stemflow-android-sdk.zip'], (req, res) => {
    const zipPath = path.join(process.cwd(), 'public', 'stemflow-android-sdk.zip');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="stemflow-android-sdk.zip"');
    res.sendFile(zipPath, (err) => {
      if (err) {
        console.error('Error sending SDK bundle:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Android SDK bundle package not found on server.' });
        }
      }
    });
  });

  // API Route: Android Native Package & SDK Status
  app.get('/api/android-status', (req, res) => {
    const apkPath = path.join(process.cwd(), 'public', 'app-debug.apk');
    const aarPath = path.join(process.cwd(), 'public', 'aar', 'stemflow-api-release.aar');
    const bundlePath = path.join(process.cwd(), 'public', 'stemflow-android-sdk.zip');

    const apkExists = fs.existsSync(apkPath);
    const aarExists = fs.existsSync(aarPath);
    const bundleExists = fs.existsSync(bundlePath);

    const apkStats = apkExists ? fs.statSync(apkPath) : null;
    const aarStats = aarExists ? fs.statSync(aarPath) : null;
    const bundleStats = bundleExists ? fs.statSync(bundlePath) : null;

    res.json({
      status: 'ready',
      packaged: apkExists && aarExists,
      apk: {
        fileName: 'StemFlow-AI-debug.apk',
        downloadUrl: '/api/download-apk',
        sizeBytes: apkStats ? apkStats.size : 0,
        sizeFormatted: apkStats ? (apkStats.size / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB',
        sha256: 'b803bf706952203adbbb63d86f5925c23b2be5d7753fe86daf7d9aa1f59537d8',
      },
      aarLibrary: {
        fileName: 'stemflow-api-1.0.0.aar',
        downloadUrl: '/api/download-aar',
        sizeBytes: aarStats ? aarStats.size : 0,
        sizeFormatted: aarStats ? (aarStats.size / 1024).toFixed(1) + ' KB' : '0 KB',
        sha256: 'dc1623e8158ae5f240d6a17571a9a8c48617b6fd9553c88c9040ca0a04783e81',
      },
      sdkBundle: {
        fileName: 'stemflow-android-sdk.zip',
        downloadUrl: '/api/download-sdk-bundle',
        sizeBytes: bundleStats ? bundleStats.size : 0,
        sizeFormatted: bundleStats ? (bundleStats.size / 1024).toFixed(1) + ' KB' : '0 KB',
        sha256: 'b83486a8b734d4592db636161b99d9451e602c803139c67a5184eaa1cc95677c',
      },
      packageName: 'com.stemflow.ai',
      nativeModule: 'com.stemflow.ai.StemFlowPlugin',
      androidSdkModule: 'com.stemflow.ai:stemflow-api:1.0.0',
      minSdkVersion: 24,
      targetSdkVersion: 35,
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware for development vs Static file serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StemFlow AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
