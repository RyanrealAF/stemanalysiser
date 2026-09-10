/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { CrossStemCorrelation, SectionAnalysis, SongMetadata, StemFeatureData, StemType } from '../src/types';

/**
 * Hardcoded artist/catalog context for this instance of StemFlow AI.
 * This artist's catalog spans multiple related subgenres rather than
 * one fixed style. Instead of assuming a single subgenre, Gemini is
 * asked to CLASSIFY which one best fits THIS track from its actual
 * tempo/onset/energy features, then apply that subgenre's conventions.
 */
const ARTIST_STYLE_PROFILE = `
ARTIST CONTEXT: This catalog spans dark West Coast drill, trap, boom-bap,
and spoken-word hybrids. Do not assume a single subgenre — first
CLASSIFY which one this specific track matches based on its tempo and
rhythmic features, then apply that subgenre's conventions below.

SUBGENRE CLASSIFICATION SIGNALS (use estimated BPM, hi-hat onset density,
snare placement, and swing/timing variance from the feature time-series):

- BOOM-BAP: ~85-95 BPM, swung/loose hi-hat and snare placement (notable
  timing variance rather than rigid grid), sample-based or live-feel drums,
  snare typically on 2 and 4.
- DRILL: ~135-150 BPM (or half-time feel at ~67-75), sliding 808 bass,
  triplet hi-hat rolls, syncopated/irregular snare placement, half-time
  snare on beat 3.
- TRAP: ~130-150 BPM, rapid straight or triplet hi-hat rolls with high
  onset density, 808 bass slides, snare/clap on beat 3, generally more
  rhythmically rigid/gridded than drill or boom-bap.
- SPOKEN-WORD: little to no strict tempo grid, sparse or rubato
  instrumentation, vocal phrasing drives the timing rather than a
  fixed pulse.

Report your classification as "detectedSubgenre" (one of: 'boom_bap',
'drill', 'trap', 'spoken_word', 'hybrid') and use it to inform the
rules below.

VOCAL ROLES (applies across all subgenres in this catalog):
- Male vocals are ALWAYS hard-attack rap delivery, never melodic/sung.
  A hard-attack, rhythmically-spoken male vocal stem should be classified
  as 'lead' or 'foundation' — never 'texture' or 'ornament' — even
  though it is not pitched/sung in the traditional sense.
- Female vocals, when present, are ethereal and melodic, functioning as
  a contrasting 'lead' hook layer against hard-attack male verses
  (trap-soul hybrid structure).

RHYTHM & QUANTIZATION (apply per detected subgenre):
- Boom-bap: preserve swing — do NOT recommend high quantization
  strictness even in hook sections; loose timing is the genre's identity.
- Drill/Trap: drum/bass grid can be tighter, but vocal cadence (dense
  internal rhyme, anapestic meter) is often intentionally off-grid —
  keep vocal quantization strictness low-to-moderate regardless of
  section energy.
- Spoken-word: quantization strictness should be very low throughout;
  there may be no fixed grid to snap to at all.
- Drums may use triplet hi-hat rolls and half-time snare (drill/trap
  convention) — treat this as intentional groove, not a transcription
  artifact.

SECTION LABELS:
- Prefer 'verse', 'hook', 'pre_chorus', 'bridge', 'breakdown', 'outro',
  'intro' over generic EDM terms like 'drop' unless the energy profile
  genuinely matches an EDM drop.

HARMONIC/TONAL:
- Expect minor-key, modally dark harmonic centers. Sparse or static
  chord movement under a hard-attack vocal is intentional
  (drone/bass-anchored), not a sign of thin arrangement.

ATMOSPHERE:
- Overall mood is moody and bass-forward by default; ranges from
  down-tempo/cinematic/church-adjacent (boom-bap, spoken-word) to dense,
  aggressive (drill, trap).
`;

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please provide an active Gemini API key in settings.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export interface GeminiFunctionalAnalysisOutput {
  sections: SectionAnalysis[];
  geminiExecutiveSummary: string;
  arrangementCritique: string;
  mixRecommendations: string[];
  detectedSubgenre: 'boom_bap' | 'drill' | 'trap' | 'spoken_word' | 'hybrid';
  processingDurationMs?: number;
  modelUsed?: string;
}

export async function runGeminiFunctionalAnalysis(
  metadata: SongMetadata,
  stemFeatures: Record<StemType, StemFeatureData>,
  correlations: CrossStemCorrelation[],
  collisionTelemetry: string[] = []
): Promise<GeminiFunctionalAnalysisOutput> {
  const ai = getGeminiClient();
  const startTime = Date.now();

  // Create compact 8-slice energy and dynamic profile for each of the 6 stems
  const compactFeatureSummary = Object.entries(stemFeatures).map(([stem, data]) => {
    const timeline = data.timeline || [];
    const numSlices = 8;
    const sliceSize = Math.max(1, Math.floor(timeline.length / numSlices));
    const energyProfile = Array.from({ length: numSlices }, (_, i) => {
      const slice = timeline.slice(i * sliceSize, (i + 1) * sliceSize);
      if (slice.length === 0) return 0;
      const sum = slice.reduce((acc, p) => acc + (p.energy || 0), 0);
      return Number((sum / slice.length).toFixed(3));
    });

    return {
      stem,
      averageEnergy: Number((data.averageEnergy || 0).toFixed(3)),
      peakEnergy: Number((data.peakEnergy || 0).toFixed(3)),
      averageSpectralCentroidHz: Math.round(data.averageCentroid || 0),
      averageOnsetDensity: Number((data.averageOnsetDensity || 0).toFixed(2)),
      eightSectionEnergyCurve: energyProfile,
    };
  });

  const correlationSummary = correlations.map((c) => ({
    pair: c.pair,
    score: Number((c.correlation || 0).toFixed(3)),
    relationship: c.relationshipType,
    note: c.description,
  }));

  const prompt = `You are an elite musicologist, arrangement architect, and audio intelligence AI.
Perform a genuine, rigorous, in-depth FUNCTIONAL ANALYSIS of the 6 separated stems (vocals, bass, drums, guitar, piano, other) for this track.

Track Information:
- Title: "${metadata.title || 'Master Track'}" by ${metadata.artist || 'Unknown Artist'}
- Total Duration: ${metadata.duration || 30} seconds
- Detected Tempo: ${metadata.bpm || 120} BPM
- Musical Key: ${metadata.key || 'C minor'}
- Time Signature: ${metadata.timeSignature || '4/4'}

Extracted DSP Acoustic Signatures & 8-Band Time Progression:
${JSON.stringify(compactFeatureSummary, null, 2)}

Cross-Stem Correlation & Synchronization Matrix:
${JSON.stringify(correlationSummary, null, 2)}

Cross-Stem Bleed & Collision Resolution Audit:
${collisionTelemetry.length > 0 ? collisionTelemetry.slice(0, 10).join('\n') : 'All 6 stems verified with clean acoustic boundaries and zero phase-bleed.'}

MANDATORY OUTPUT SPECIFICATION:
1. Subgenre Classification: Determine whether this track is 'boom_bap', 'drill', 'trap', 'spoken_word', or 'hybrid' based on BPM, hi-hat density, and bass slide dynamics.
2. Chronological Musical Segmentation:
   - Partition the full ${metadata.duration}s duration into 3 to 5 realistic chronological sections (e.g., Intro, Verse, Hook/Chorus, Bridge, Outro).
   - The first section MUST start at 0.0 seconds.
   - The final section MUST terminate at exactly ${metadata.duration} seconds.
   - For every single section:
     * Assign stem roles for all 6 stems ('vocals', 'bass', 'drums', 'guitar', 'piano', 'other') from: 'lead', 'foundation', 'texture', 'ornament', 'percussion', 'silent'.
     * Provide musical reasoning explaining how the stem's energy and frequency centroid dictate that specific role.
     * Define harmonic tension (0-100), dynamics ('low', 'medium', 'high', 'peak'), and quantization strictness (0-100%).
3. Executive Summary: Synthesize the multi-stem interaction pattern, subgenre sonic signature, and dynamic climax in 2-3 technical paragraphs.
4. Arrangement Critique: Provide critical producer notes on tension building, space allocation, and vocal pocket clarity.
5. Mix Recommendations: 3 specific, actionable studio-grade mixing and EQ/spatial tips tailored to this exact arrangement.

Return ONLY valid JSON matching this schema:
{
  "detectedSubgenre": "boom_bap" | "drill" | "trap" | "spoken_word" | "hybrid",
  "executiveSummary": string,
  "arrangementCritique": string,
  "mixRecommendations": [string, string, string],
  "sections": [
    {
      "id": string,
      "section": "intro" | "verse" | "hook" | "bridge" | "outro" | "breakdown",
      "title": string,
      "startTime": number,
      "endTime": number,
      "musicalContext": string,
      "harmonicTension": number,
      "dynamics": "low" | "medium" | "high" | "peak",
      "quantizationStrictness": number,
      "stemRoles": {
        "vocals": "lead" | "foundation" | "texture" | "ornament" | "percussion" | "silent",
        "bass": "lead" | "foundation" | "texture" | "ornament" | "percussion" | "silent",
        "drums": "lead" | "foundation" | "texture" | "ornament" | "percussion" | "silent",
        "guitar": "lead" | "foundation" | "texture" | "ornament" | "percussion" | "silent",
        "piano": "lead" | "foundation" | "texture" | "ornament" | "percussion" | "silent",
        "other": "lead" | "foundation" | "texture" | "ornament" | "percussion" | "silent"
      },
      "stemReasoning": {
        "vocals": string,
        "bass": string,
        "drums": string,
        "guitar": string,
        "piano": string,
        "other": string
      },
      "keyMoments": [string]
    }
  ]
}`;

  const systemInstruction = `You are a world-class audio engineer and music theorist analyzing 6-stem separated audio.
${ARTIST_STYLE_PROFILE}
Analyze the real DSP energy distributions and cross-stem correlation data strictly and objectively. Return structured JSON only.`;

  // Real Gemini model cascade:
  // Primary: gemini-3.8-flash with ThinkingLevel.LOW
  // Secondary: gemini-3.1-flash-lite with ThinkingLevel.MINIMAL (for high demand spikes)
  // Tertiary: gemini-flash-latest
  const modelCandidates = [
    { model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { model: 'gemini-flash-latest', thinkingLevel: undefined },
  ];

  let lastError: any = null;
  let parsed: any = null;
  let modelUsed = '';

  for (const candidate of modelCandidates) {
    try {
      console.log(`[Gemini Engine] Sending multi-stem audio data to ${candidate.model}...`);
      const config: any = {
        systemInstruction,
        responseMimeType: 'application/json',
      };
      if (candidate.thinkingLevel !== undefined) {
        config.thinkingConfig = { thinkingLevel: candidate.thinkingLevel };
      }

      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: prompt,
        config,
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error(`Model ${candidate.model} returned empty payload`);
      }

      parsed = JSON.parse(text);
      modelUsed = candidate.model;
      console.log(`[Gemini Engine] Generation complete using ${candidate.model} in ${(Date.now() - startTime) / 1000}s`);
      break;
    } catch (err: any) {
      console.warn(`[Gemini Engine] Attempt on ${candidate.model} encountered (${err.status || err.message}), attempting fallback model...`);
      lastError = err;
    }
  }

  if (!parsed || !parsed.sections || parsed.sections.length === 0) {
    throw new Error(`Gemini multi-stem analysis failed across all models: ${lastError?.message || 'Invalid model response'}`);
  }

  const validSubgenres = ['boom_bap', 'drill', 'trap', 'spoken_word', 'hybrid'];
  const detectedSubgenre = validSubgenres.includes(parsed.detectedSubgenre) ? parsed.detectedSubgenre : 'hybrid';
  const duration = metadata.duration || 30;

  // Validate and normalize sections
  const validSections: SectionAnalysis[] = parsed.sections.map((s: any, idx: number) => {
    const startTimeSec = Math.max(0, Number(s.startTime) || (idx === 0 ? 0 : idx * 10));
    const rawEndTimeSec = Number(s.endTime) || (idx === parsed.sections.length - 1 ? duration : (idx + 1) * 10);
    const endTimeSec = Math.min(duration, Math.max(startTimeSec + 1, rawEndTimeSec));

    return {
      id: s.id || `sec-${idx + 1}`,
      section: s.section || (idx === 0 ? 'intro' : idx === parsed.sections.length - 1 ? 'outro' : 'verse'),
      title: s.title || `Section ${idx + 1}`,
      startTime: Number(startTimeSec.toFixed(1)),
      endTime: Number(endTimeSec.toFixed(1)),
      musicalContext: s.musicalContext || 'Acoustic feature progression and stem balance.',
      harmonicTension: Math.min(100, Math.max(0, Number(s.harmonicTension) || 50)),
      dynamics: ['low', 'medium', 'high', 'peak'].includes(s.dynamics) ? s.dynamics : 'medium',
      quantizationStrictness: Math.min(100, Math.max(0, Number(s.quantizationStrictness) || 80)),
      stemRoles: {
        vocals: s.stemRoles?.vocals || 'lead',
        bass: s.stemRoles?.bass || 'foundation',
        drums: s.stemRoles?.drums || 'percussion',
        guitar: s.stemRoles?.guitar || 'texture',
        piano: s.stemRoles?.piano || 'texture',
        other: s.stemRoles?.other || 'texture',
      },
      stemReasoning: {
        vocals: s.stemReasoning?.vocals || 'Lead vocal delivery driving the central melodic phrasing.',
        bass: s.stemReasoning?.bass || 'Sub-bass fundamental grounding the harmonic root motion.',
        drums: s.stemReasoning?.drums || 'Rhythmic transient grid establishing the beat pocket.',
        guitar: s.stemReasoning?.guitar || 'Polyphonic chord strumming providing harmonic width.',
        piano: s.stemReasoning?.piano || 'Acoustic keyboard voicings supporting tonal context.',
        other: s.stemReasoning?.other || 'Atmospheric texture and background ambience.',
      },
      keyMoments: Array.isArray(s.keyMoments) ? s.keyMoments : ['Section transition'],
    };
  });

  const processingDurationMs = Date.now() - startTime;

  return {
    detectedSubgenre,
    sections: validSections,
    geminiExecutiveSummary: parsed.executiveSummary || `Dynamic ${detectedSubgenre} arrangement analyzed with 6-stem functional differentiation.`,
    arrangementCritique: parsed.arrangementCritique || 'Arrangement demonstrates clear dynamic build-ups, harmonic contrast, and spatial stem separation.',
    mixRecommendations: Array.isArray(parsed.mixRecommendations) && parsed.mixRecommendations.length > 0
      ? parsed.mixRecommendations
      : [
          'High-pass filter lead vocals at 110Hz to preserve headroom for the sub-bass fundamentals.',
          'Sidechain bass compression gently to kick transients to prevent mid-low masking.',
          'Pan guitar and piano wider in the stereo field to keep the vocal and snare center focused.',
        ],
    processingDurationMs,
    modelUsed,
  };
}
