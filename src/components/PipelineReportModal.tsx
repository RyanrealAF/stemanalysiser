import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Copy,
  Check,
  Terminal,
  Clock,
  Activity,
  ChevronDown,
  ChevronRight,
  Download,
  Flame,
} from 'lucide-react';
import { PipelineDiagnosticReport, PipelineStepCheck } from '../types';

interface PipelineReportModalProps {
  report: PipelineDiagnosticReport;
  isOpen: boolean;
  onClose: () => void;
}

export const PipelineReportModal: React.FC<PipelineReportModalProps> = ({
  report,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const handleCopyReport = async () => {
    try {
      const formattedJson = JSON.stringify(report, null, 2);
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy report to clipboard', e);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = `# StemFlow AI - Pipeline Health & Verification Audit Report
Generated: ${report.generatedAt}
Report ID: ${report.reportId}
Audio Track: ${report.audioFileName} (${report.trackDurationSec}s @ ${report.sampleRateHz}Hz)
Overall Health Status: ${report.overallStatus.toUpperCase()}
Total Steps: ${report.totalSteps} | Passed First Try: ${report.passedCount} | Auto-Healed: ${report.recoveredCount} | Warnings: ${report.warningCount} | Failures: ${report.failedCount}
Total Processing Time: ${report.totalProcessingTimeMs} ms

---

## Step-by-Step Verification Audit
${report.steps
  .map(
    (s) => `### Step ${s.stepNumber}: ${s.stepName}
- Status: ${s.status.toUpperCase()} (${s.attempts}/${s.maxAttempts} attempts)
- Duration: ${s.durationMs} ms
- Category: ${s.category}
- Verification Criteria: ${s.verificationCriteria}
- Check Description: ${s.checkDescription}
${s.recoveryActionTaken ? `- Self-Healing Remediation: ${s.recoveryActionTaken}` : ''}
${s.metrics ? `- Telemetry Metrics: ${JSON.stringify(s.metrics)}` : ''}

Diagnostics Log:
${s.diagnostics.map((d) => `  * ${d}`).join('\n')}
`
  )
  .join('\n---\n')}

## Recovery & Auto-Healing Log
${
  report.recoveryLogs.length > 0
    ? report.recoveryLogs.map((log) => `- ${log}`).join('\n')
    : '- No recoveries required. All pipeline checks passed on first execution.'
}

## DSP & Mix Recommendations
${report.recommendations.map((r) => `- ${r}`).join('\n')}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline_audit_report_${report.reportId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = () => {
    switch (report.overallStatus) {
      case 'all_passed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold tracking-wide">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            100% HEALTHY (ALL CHECKS PASSED)
          </span>
        );
      case 'auto_healed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold tracking-wide">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '4s' }} />
            AUTO-HEALED ({report.recoveredCount} RETRIED & FIXED)
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            VALIDATED WITH TOLERANCE
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 text-xs font-mono font-bold tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            PIPELINE ANOMALY DETECTED
          </span>
        );
    }
  };

  const getStepStatusIcon = (step: PipelineStepCheck) => {
    switch (step.status) {
      case 'passed':
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        );
      case 'recovered':
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" title={`Auto-healed on attempt ${step.attempts}/3`}>
            <RefreshCw className="w-3.5 h-3.5" />
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <AlertTriangle className="w-4 h-4" />
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400 border border-red-500/40">
            <AlertTriangle className="w-4 h-4" />
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#111319] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#161820]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-[#DC2626]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white font-mono">
                  Pipeline Health & Verification Audit Report
                </h2>
                <span className="text-[11px] font-mono text-zinc-500">ID: {report.reportId}</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                Real-time validation checks & 3-attempt automated self-healing telemetry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#181A22] border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Passed (Attempt 1)</span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {report.passedCount} <span className="text-xs text-zinc-500">/ {report.totalSteps}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#181A22] border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono mb-1">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto-Healed (≤ 3 Tries)</span>
              </div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {report.recoveredCount}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#181A22] border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Pipeline Latency</span>
              </div>
              <div className="text-xl font-bold font-mono text-zinc-200">
                {(report.totalProcessingTimeMs / 1000).toFixed(2)}s
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#181A22] border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono mb-1">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Audio Stream</span>
              </div>
              <div className="text-xl font-bold font-mono text-zinc-200 truncate" title={`${report.trackDurationSec}s @ ${report.sampleRateHz}Hz`}>
                {report.trackDurationSec}s <span className="text-xs text-zinc-500">{report.sampleRateHz}Hz</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Verification Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#DC2626]" />
                Automated Verification Checks Across Pipeline Stages
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">
                Click any step to inspect diagnostic telemetry
              </span>
            </div>

            <div className="space-y-2">
              {report.steps.map((step) => {
                const isExpanded = Boolean(expandedSteps[step.stepNumber]);
                return (
                  <div
                    key={step.stepNumber}
                    className="border border-zinc-800 rounded-lg bg-[#14161F] overflow-hidden transition hover:border-zinc-700"
                  >
                    <div
                      onClick={() => toggleStep(step.stepNumber)}
                      className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        {getStepStatusIcon(step)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-zinc-300">
                              Step {step.stepNumber}: {step.stepName}
                            </span>
                            {step.status === 'recovered' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                                Healed on Try {step.attempts}/3
                              </span>
                            )}
                            {step.status === 'passed' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                                Pass (1/3)
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            {step.checkDescription}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
                          {step.durationMs}ms
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-zinc-800/80 bg-[#0F1117] space-y-3 text-xs font-mono">
                        <div>
                          <span className="text-zinc-400 font-semibold">Verification Criteria: </span>
                          <span className="text-zinc-300">{step.verificationCriteria}</span>
                        </div>

                        {step.recoveryActionTaken && (
                          <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 flex items-start gap-2">
                            <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                            <div>
                              <span className="font-bold">Automated Self-Healing Action:</span>
                              <p className="text-[11px] mt-0.5 text-cyan-200">{step.recoveryActionTaken}</p>
                            </div>
                          </div>
                        )}

                        {step.metrics && Object.keys(step.metrics).length > 0 && (
                          <div>
                            <span className="text-zinc-400 font-semibold mb-1.5 block">Telemetry Metrics:</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#151722] p-2.5 rounded border border-zinc-800">
                              {Object.entries(step.metrics).map(([key, value]) => (
                                <div key={key} className="text-[11px]">
                                  <span className="text-zinc-500">{key}: </span>
                                  <span className="text-emerald-300 font-bold">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <span className="text-zinc-400 font-semibold mb-1 block">Diagnostics Stream:</span>
                          <div className="bg-black/60 p-2.5 rounded border border-zinc-800/80 max-h-36 overflow-y-auto space-y-1 text-[11px] text-zinc-400">
                            {step.diagnostics.map((log, idx) => (
                              <div key={idx} className="leading-relaxed">
                                <span className="text-zinc-600 mr-1.5">&gt;</span>
                                <span className={log.includes('Failed') ? 'text-amber-400' : log.includes('Healing') ? 'text-cyan-300' : 'text-zinc-300'}>
                                  {log}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recovery Logs Section (if any retries happened) */}
          {report.recoveryLogs.length > 0 && (
            <div className="p-4 rounded-lg bg-[#14161F] border border-cyan-900/50 space-y-2">
              <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-cyan-400" />
                Pipeline Self-Healing Audit Trail ({report.recoveryLogs.length} events)
              </h4>
              <div className="space-y-1 text-xs font-mono text-zinc-300">
                {report.recoveryLogs.map((log, index) => (
                  <div key={index} className="p-2 rounded bg-cyan-950/30 border border-cyan-900/30 text-[11px]">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations & Engine Summary */}
          <div className="p-4 rounded-lg bg-[#14161F] border border-zinc-800 space-y-2">
            <h4 className="text-xs font-bold uppercase font-mono text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#DC2626]" />
              Audio Pipeline Recommendations & Summary
            </h4>
            <ul className="space-y-1 text-xs font-mono text-zinc-300 list-disc list-inside">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="leading-relaxed">{rec}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800 bg-[#161820]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied JSON!' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#DC2626]" />
              Download Markdown Report
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-mono font-bold transition shadow-lg"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
