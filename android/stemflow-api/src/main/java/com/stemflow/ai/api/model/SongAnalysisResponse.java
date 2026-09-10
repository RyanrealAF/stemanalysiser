package com.stemflow.ai.api.model;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Result returned from /api/analyze-song by Gemini orchestration.
 */
public class SongAnalysisResponse {
    private boolean success;
    private String executiveSummary;
    private String arrangementCritique;
    private List<String> mixRecommendations;
    private List<SectionAnalysis> sections;

    public SongAnalysisResponse() {
        this.mixRecommendations = new ArrayList<>();
        this.sections = new ArrayList<>();
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getExecutiveSummary() { return executiveSummary; }
    public void setExecutiveSummary(String executiveSummary) { this.executiveSummary = executiveSummary; }

    public String getArrangementCritique() { return arrangementCritique; }
    public void setArrangementCritique(String arrangementCritique) { this.arrangementCritique = arrangementCritique; }

    public List<String> getMixRecommendations() { return mixRecommendations; }
    public void setMixRecommendations(List<String> mixRecommendations) { this.mixRecommendations = mixRecommendations; }

    public List<SectionAnalysis> getSections() { return sections; }
    public void setSections(List<SectionAnalysis> sections) { this.sections = sections; }

    public static SongAnalysisResponse fromJsonObject(JSONObject obj) {
        SongAnalysisResponse res = new SongAnalysisResponse();
        if (obj == null) return res;

        res.setSuccess(obj.optBoolean("success", true));
        res.setExecutiveSummary(obj.optString("executiveSummary", ""));
        res.setArrangementCritique(obj.optString("arrangementCritique", ""));

        JSONArray mixArr = obj.optJSONArray("mixRecommendations");
        if (mixArr != null) {
            for (int i = 0; i < mixArr.length(); i++) {
                res.getMixRecommendations().add(mixArr.optString(i));
            }
        }

        JSONArray secArr = obj.optJSONArray("sections");
        if (secArr != null) {
            for (int i = 0; i < secArr.length(); i++) {
                JSONObject sObj = secArr.optJSONObject(i);
                if (sObj != null) {
                    SectionAnalysis sec = SectionAnalysis.fromJsonObject(sObj);
                    if (sec != null) res.getSections().add(sec);
                }
            }
        }

        return res;
    }
}
