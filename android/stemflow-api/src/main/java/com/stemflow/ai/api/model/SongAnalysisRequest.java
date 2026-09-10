package com.stemflow.ai.api.model;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Payload sent to /api/analyze-song.
 */
public class SongAnalysisRequest {
    private SongMetadata metadata;
    private List<StemFeature> stemFeatures;
    private List<CrossStemCorrelation> correlations;
    private List<CollisionTelemetryItem> collisionTelemetry;

    public SongAnalysisRequest() {
        this.metadata = new SongMetadata();
        this.stemFeatures = new ArrayList<>();
        this.correlations = new ArrayList<>();
        this.collisionTelemetry = new ArrayList<>();
    }

    public SongAnalysisRequest(SongMetadata metadata, List<StemFeature> stemFeatures,
                               List<CrossStemCorrelation> correlations, List<CollisionTelemetryItem> collisionTelemetry) {
        this.metadata = metadata;
        this.stemFeatures = stemFeatures != null ? stemFeatures : new ArrayList<>();
        this.correlations = correlations != null ? correlations : new ArrayList<>();
        this.collisionTelemetry = collisionTelemetry != null ? collisionTelemetry : new ArrayList<>();
    }

    public SongMetadata getMetadata() { return metadata; }
    public void setMetadata(SongMetadata metadata) { this.metadata = metadata; }

    public List<StemFeature> getStemFeatures() { return stemFeatures; }
    public void setStemFeatures(List<StemFeature> stemFeatures) { this.stemFeatures = stemFeatures; }

    public List<CrossStemCorrelation> getCorrelations() { return correlations; }
    public void setCorrelations(List<CrossStemCorrelation> correlations) { this.correlations = correlations; }

    public List<CollisionTelemetryItem> getCollisionTelemetry() { return collisionTelemetry; }
    public void setCollisionTelemetry(List<CollisionTelemetryItem> collisionTelemetry) { this.collisionTelemetry = collisionTelemetry; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        if (metadata != null) {
            obj.put("metadata", metadata.toJsonObject());
        }

        if (stemFeatures != null) {
            JSONArray featArr = new JSONArray();
            for (StemFeature f : stemFeatures) {
                featArr.put(f.toJsonObject());
            }
            obj.put("stemFeatures", featArr);
        }

        if (correlations != null) {
            JSONArray corrArr = new JSONArray();
            for (CrossStemCorrelation c : correlations) {
                corrArr.put(c.toJsonObject());
            }
            obj.put("correlations", corrArr);
        }

        if (collisionTelemetry != null) {
            JSONArray collArr = new JSONArray();
            for (CollisionTelemetryItem col : collisionTelemetry) {
                collArr.put(col.toJsonObject());
            }
            obj.put("collisionTelemetry", collArr);
        }

        return obj;
    }
}
