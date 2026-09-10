package com.stemflow.ai.api.model;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Functional role allocated to a stem within an arrangement section.
 */
public class StemRoleAllocation {
    private StemType stemType;
    private StemRole role;
    private String transcriptionEngine;
    private double confidence;

    public StemRoleAllocation() {
        this.stemType = StemType.OTHER;
        this.role = StemRole.TEXTURE;
        this.transcriptionEngine = "adaptive_spectral";
        this.confidence = 0.90;
    }

    public StemRoleAllocation(StemType stemType, StemRole role, String transcriptionEngine, double confidence) {
        this.stemType = stemType;
        this.role = role;
        this.transcriptionEngine = transcriptionEngine;
        this.confidence = confidence;
    }

    public StemType getStemType() { return stemType; }
    public void setStemType(StemType stemType) { this.stemType = stemType; }

    public StemRole getRole() { return role; }
    public void setRole(StemRole role) { this.role = role; }

    public String getTranscriptionEngine() { return transcriptionEngine; }
    public void setTranscriptionEngine(String transcriptionEngine) { this.transcriptionEngine = transcriptionEngine; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("stemType", stemType.getKey());
        obj.put("role", role.getKey());
        obj.put("transcriptionEngine", transcriptionEngine);
        obj.put("confidence", confidence);
        return obj;
    }

    public static StemRoleAllocation fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        return new StemRoleAllocation(
            StemType.fromString(obj.optString("stemType", "other")),
            StemRole.fromString(obj.optString("role", "texture")),
            obj.optString("transcriptionEngine", "adaptive_spectral"),
            obj.optDouble("confidence", 0.90)
        );
    }
}
