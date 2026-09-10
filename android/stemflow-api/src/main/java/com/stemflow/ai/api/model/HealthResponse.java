package com.stemflow.ai.api.model;

import org.json.JSONObject;

/**
 * Health check response from /api/health.
 */
public class HealthResponse {
    private String status;
    private String service;
    private boolean geminiKeyConfigured;
    private String timestamp;

    public HealthResponse() {}

    public HealthResponse(String status, String service, boolean geminiKeyConfigured, String timestamp) {
        this.status = status;
        this.service = service;
        this.geminiKeyConfigured = geminiKeyConfigured;
        this.timestamp = timestamp;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getService() { return service; }
    public void setService(String service) { this.service = service; }

    public boolean isGeminiKeyConfigured() { return geminiKeyConfigured; }
    public void setGeminiKeyConfigured(boolean geminiKeyConfigured) { this.geminiKeyConfigured = geminiKeyConfigured; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public static HealthResponse fromJsonObject(JSONObject obj) {
        if (obj == null) return new HealthResponse();
        return new HealthResponse(
            obj.optString("status", "unknown"),
            obj.optString("service", "StemFlow AI"),
            obj.optBoolean("geminiKeyConfigured", false),
            obj.optString("timestamp", "")
        );
    }
}
