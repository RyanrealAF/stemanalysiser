package com.stemflow.ai.api.model;

import org.json.JSONObject;

/**
 * DSP and AI engine capabilities response from /api/models-info.
 */
public class ModelsInfoResponse {
    private String separationGraph;
    private String vocalFilter;
    private String drumFilter;
    private String dspFeatureEngine;
    private String aiIntelligence;

    public ModelsInfoResponse() {}

    public ModelsInfoResponse(String separationGraph, String vocalFilter, String drumFilter,
                              String dspFeatureEngine, String aiIntelligence) {
        this.separationGraph = separationGraph;
        this.vocalFilter = vocalFilter;
        this.drumFilter = drumFilter;
        this.dspFeatureEngine = dspFeatureEngine;
        this.aiIntelligence = aiIntelligence;
    }

    public String getSeparationGraph() { return separationGraph; }
    public void setSeparationGraph(String separationGraph) { this.separationGraph = separationGraph; }

    public String getVocalFilter() { return vocalFilter; }
    public void setVocalFilter(String vocalFilter) { this.vocalFilter = vocalFilter; }

    public String getDrumFilter() { return drumFilter; }
    public void setDrumFilter(String drumFilter) { this.drumFilter = drumFilter; }

    public String getDspFeatureEngine() { return dspFeatureEngine; }
    public void setDspFeatureEngine(String dspFeatureEngine) { this.dspFeatureEngine = dspFeatureEngine; }

    public String getAiIntelligence() { return aiIntelligence; }
    public void setAiIntelligence(String aiIntelligence) { this.aiIntelligence = aiIntelligence; }

    public static ModelsInfoResponse fromJsonObject(JSONObject obj) {
        ModelsInfoResponse res = new ModelsInfoResponse();
        if (obj == null) return res;

        JSONObject dsp = obj.optJSONObject("dspPipeline");
        if (dsp != null) {
            res.setSeparationGraph(dsp.optString("separationGraph", ""));
            res.setVocalFilter(dsp.optString("vocalFilter", ""));
            res.setDrumFilter(dsp.optString("drumFilter", ""));
            res.setDspFeatureEngine(dsp.optString("dspFeatureEngine", ""));
        }
        res.setAiIntelligence(obj.optString("aiIntelligence", "Gemini"));
        return res;
    }
}
