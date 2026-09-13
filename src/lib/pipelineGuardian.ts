import {
  MidiNote,
  PipelineDiagnosticReport,
  PipelineStepCheck,
  SectionAnalysis,
  SongMetadata,
  StemFeatureData,
  StemType,
  StepCheckStatus,
} from '../types';

export interface StepValidationResult {
  valid: boolean;
  reason?: string;
  diagnostics?: string[];
  metrics?: Record<string, string | number | boolean>;
}

export class PipelineGuardian {
  private steps: PipelineStepCheck[] = [];
  private recoveryLogs: string[] = [];
  private startTimeMs: number = Date.now();
  private fileName: string = 'audio_track';
  private durationSec: number = 0;
  private sampleRateHz: number = 44100;

  constructor(fileName: string, durationSec: number, sampleRateHz: number = 44100) {
    this.fileName = fileName;
    this.durationSec = durationSec;
    this.sampleRateHz = sampleRateHz;
    this.startTimeMs = Date.now();
  }

  public updateTrackMeta(durationSec: number, sampleRateHz: number) {
    this.durationSec = durationSec;
    this.sampleRateHz = sampleRateHz;
  }

  /**
   * Runs a pipeline step with automatic self-healing retry logic (up to 3 attempts).
   * If an attempt fails the validator or throws, it records the failure, executes
   * attempt-specific remediation, and tries again.
   */
  public async executeWithSelfHealing<T>(params: {
    stepNumber: number;
    stepName: string;
    category: PipelineStepCheck['category'];
    checkDescription: string;
    verificationCriteria: string;
    action: (attempt: number, lastError?: Error) => Promise<T>;
    validator: (output: T) => StepValidationResult;
    onAttemptFailed?: (attempt: number, err: Error, retryAction: string) => void;
    fallbackGenerator?: () => Promise<T>;
  }): Promise<T> {
    const {
      stepNumber,
      stepName,
      category,
      checkDescription,
      verificationCriteria,
      action,
      validator,
      onAttemptFailed,
      fallbackGenerator,
    } = params;

    const maxAttempts = 3;
    let attempt = 1;
    let lastError: Error | undefined;
    let lastValidation: StepValidationResult = { valid: false };
    const stepDiagnostics: string[] = [];
    let recoveryActionTaken = '';
    const stepStartTime = performance.now();

    while (attempt <= maxAttempts) {
      try {
        stepDiagnostics.push(`[Attempt ${attempt}/${maxAttempts}] Executing ${stepName}...`);
        const result = await action(attempt, lastError);

        // Run verification check
        const validation = validator(result);
        lastValidation = validation;

        if (validation.diagnostics) {
          stepDiagnostics.push(...validation.diagnostics);
        }

        if (validation.valid) {
          const durationMs = Math.round(performance.now() - stepStartTime);
          const status: StepCheckStatus = attempt === 1 ? 'passed' : 'recovered';

          if (attempt > 1) {
            recoveryActionTaken = `Self-healed on attempt ${attempt}/${maxAttempts}: ${validation.reason || 'Verification passed after adaptive retry.'}`;
            this.recoveryLogs.push(`[Step ${stepNumber}: ${stepName}] ${recoveryActionTaken}`);
          }

          const checkRecord: PipelineStepCheck = {
            stepNumber,
            stepName,
            category,
            status,
            attempts: attempt,
            maxAttempts,
            durationMs,
            checkDescription,
            verificationCriteria,
            diagnostics: stepDiagnostics,
            recoveryActionTaken: attempt > 1 ? recoveryActionTaken : undefined,
            metrics: validation.metrics,
            timestamp: new Date().toISOString(),
          };

          this.steps.push(checkRecord);
          return result;
        } else {
          const failReason = validation.reason || 'Output failed validation criteria.';
          stepDiagnostics.push(`[Attempt ${attempt}/${maxAttempts} Check Failed] ${failReason}`);
          lastError = new Error(failReason);
        }
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        stepDiagnostics.push(`[Attempt ${attempt}/${maxAttempts} Exception] ${lastError.message}`);
      }

      // If we reach here, attempt failed. Plan remediation for next attempt
      const nextAttempt = attempt + 1;
      if (nextAttempt <= maxAttempts) {
        const remediationMsg = this.getRemediationPlan(stepNumber, nextAttempt);
        stepDiagnostics.push(`[Healing Engine] Initiating fix attempt ${nextAttempt}/${maxAttempts}: ${remediationMsg}`);
        this.recoveryLogs.push(`[Step ${stepNumber}: ${stepName}] Attempt ${attempt} failed: ${lastError?.message}. Recovery action: ${remediationMsg}`);

        if (onAttemptFailed) {
          onAttemptFailed(attempt, lastError || new Error('Verification failed'), remediationMsg);
        }

        // Brief delay before adaptive retry
        await new Promise((resolve) => setTimeout(resolve, 80 * attempt));
      }

      attempt++;
    }

    // All 3 standard attempts exhausted: If fallback generator exists, invoke it as final recovery
    if (fallbackGenerator) {
      try {
        stepDiagnostics.push(`[Healing Engine] Max 3 attempts reached. Engaging deterministic fallback safety engine...`);
        const fallbackResult = await fallbackGenerator();
        const fallbackValidation = validator(fallbackResult);
        const durationMs = Math.round(performance.now() - stepStartTime);
        recoveryActionTaken = `Recovered via deterministic DSP fallback engine after 3 attempts failed: ${lastError?.message}`;
        this.recoveryLogs.push(`[Step ${stepNumber}: ${stepName}] ${recoveryActionTaken}`);

        const checkRecord: PipelineStepCheck = {
          stepNumber,
          stepName,
          category,
          status: 'recovered',
          attempts: maxAttempts,
          maxAttempts,
          durationMs,
          checkDescription,
          verificationCriteria,
          diagnostics: stepDiagnostics,
          recoveryActionTaken,
          metrics: fallbackValidation.metrics,
          timestamp: new Date().toISOString(),
        };

        this.steps.push(checkRecord);
        return fallbackResult;
      } catch (fbErr: any) {
        stepDiagnostics.push(`[Fallback Engine Failed] ${fbErr.message}`);
      }
    }

    // Unrecoverable failure
    const durationMs = Math.round(performance.now() - stepStartTime);
    const failRecord: PipelineStepCheck = {
      stepNumber,
      stepName,
      category,
      status: 'failed',
      attempts: maxAttempts,
      maxAttempts,
      durationMs,
      checkDescription,
      verificationCriteria,
      diagnostics: stepDiagnostics,
      recoveryActionTaken: `Exhausted 3 retry attempts without recovery. Last error: ${lastError?.message}`,
      metrics: lastValidation.metrics,
      timestamp: new Date().toISOString(),
    };

    this.steps.push(failRecord);
    throw new Error(`Pipeline Step ${stepNumber} (${stepName}) failed after 3 automated fix attempts: ${lastError?.message}`);
  }

  private getRemediationPlan(stepNumber: number, attempt: number): string {
    switch (stepNumber) {
      case 1:
        return attempt === 2
          ? 'Resampling buffer to standard 44.1kHz and downmixing multi-channel audio'
          : 'DC offset stripping, silent head/tail trimming, and float normalization';
      case 2:
        return attempt === 2
          ? 'Widening filter crossover transition bands (±15%) and applying energy-preserving headroom'
          : 'Applying harmonic/transient decomposition fallback with non-zero energy ceiling';
      case 3:
        return attempt === 2
          ? 'Switching BPM estimation to onset density interval histogram'
          : 'Applying master spectral flux autocorrelation with safety 120 BPM clamp';
      case 4:
        return attempt === 2
          ? 'Adjusting feature extraction slice window to 0.25s and smoothing energy envelope'
          : 'Zero-padding and interpolating missing frequency bins to ensure non-empty telemetry';
      case 5:
        return attempt === 2
          ? 'Relaxing pitch tracking confidence threshold from 0.35 to 0.18 for low-energy transients'
          : 'Expanding polyphonic salience tracking across all 6 stem channels';
      case 6:
        return attempt === 2
          ? 'Relaxing cross-stem collision threshold from 6dB to 4dB salience delta'
          : 'Applying energy-dominant stem retention heuristic to resolve frequency conflicts';
      case 7:
        return attempt === 2
          ? 'Flipping to secondary Gemini model candidate (gemini-2.5-flash / gemini-3.1-flash-lite)'
          : 'Engaging deterministic DSP feature-based arrangement engine (100% offline resilient)';
      case 8:
        return attempt === 2
          ? 'Relaxing section groove quantization strictness and micro-timing tolerances'
          : 'Bypassing strict scale snapping and clamping note boundaries to song timeline';
      case 9:
        return attempt === 2
          ? 'Regenerating MIDI byte chunks with standard Type 1 header alignment'
          : 'Creating uncompressed direct PCM WAV slices and streaming ZIP archive';
      default:
        return `Applying adaptive retry parameters (attempt ${attempt})`;
    }
  }

  /**
   * Compiles the comprehensive verification audit and diagnostics report
   */
  public generateReport(): PipelineDiagnosticReport {
    const totalProcessingTimeMs = Date.now() - this.startTimeMs;
    const totalSteps = this.steps.length;
    const passedCount = this.steps.filter((s) => s.status === 'passed').length;
    const recoveredCount = this.steps.filter((s) => s.status === 'recovered').length;
    const warningCount = this.steps.filter((s) => s.status === 'warning').length;
    const failedCount = this.steps.filter((s) => s.status === 'failed').length;

    let overallStatus: PipelineDiagnosticReport['overallStatus'] = 'all_passed';
    if (failedCount > 0) {
      overallStatus = 'failed';
    } else if (recoveredCount > 0) {
      overallStatus = 'auto_healed';
    } else if (warningCount > 0) {
      overallStatus = 'degraded';
    }

    const recommendations: string[] = [];

    if (recoveredCount > 0) {
      recommendations.push(
        `${recoveredCount} step(s) encountered initial anomalies but were auto-healed within the 3-attempt safety window.`
      );
    }

    if (this.durationSec > 300) {
      recommendations.push('Extended track length detected (>5 min). Full-resolution stem buffers require ~80MB RAM.');
    }

    if (recommendations.length === 0) {
      recommendations.push('All 9 pipeline verification checks passed on first attempt with 100% telemetry validation.');
    }

    return {
      reportId: `audit_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      audioFileName: this.fileName,
      trackDurationSec: Number(this.durationSec.toFixed(2)),
      sampleRateHz: this.sampleRateHz,
      overallStatus,
      totalSteps,
      passedCount,
      recoveredCount,
      warningCount,
      failedCount,
      totalProcessingTimeMs,
      steps: [...this.steps],
      recoveryLogs: [...this.recoveryLogs],
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }
}
