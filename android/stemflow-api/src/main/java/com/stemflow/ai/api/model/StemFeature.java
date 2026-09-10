package com.stemflow.ai.api.model;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Feature profile extracted from an isolated stem audio buffer.
 */
public class StemFeature {
    private StemType stemType;
    private double meanRms;
    private double maxRms;
    private double meanCentroid;
    private double maxCentroid;
    private double onsetDensity;
    private double lowBandEnergyRatio;
    private List<Double> rmsEnvelope;
    private List<Double> spectralCentroidSeries;

    public StemFeature() {
        this.stemType = StemType.OTHER;
        this.rmsEnvelope = new ArrayList<>();
        this.spectralCentroidSeries = new ArrayList<>();
    }

    public StemFeature(StemType stemType, double meanRms, double maxRms, double meanCentroid,
                       double maxCentroid, double onsetDensity, double lowBandEnergyRatio) {
        this.stemType = stemType;
        this.meanRms = meanRms;
        this.maxRms = maxRms;
        this.meanCentroid = meanCentroid;
        this.maxCentroid = maxCentroid;
        this.onsetDensity = onsetDensity;
        this.lowBandEnergyRatio = lowBandEnergyRatio;
        this.rmsEnvelope = new ArrayList<>();
        this.spectralCentroidSeries = new ArrayList<>();
    }

    public StemType getStemType() { return stemType; }
    public void setStemType(StemType stemType) { this.stemType = stemType; }

    public double getMeanRms() { return meanRms; }
    public void setMeanRms(double meanRms) { this.meanRms = meanRms; }

    public double getMaxRms() { return maxRms; }
    public void setMaxRms(double maxRms) { this.maxRms = maxRms; }

    public double getMeanCentroid() { return meanCentroid; }
    public void setMeanCentroid(double meanCentroid) { this.meanCentroid = meanCentroid; }

    public double getMaxCentroid() { return maxCentroid; }
    public void setMaxCentroid(double maxCentroid) { this.maxCentroid = maxCentroid; }

    public double getOnsetDensity() { return onsetDensity; }
    public void setOnsetDensity(double onsetDensity) { this.onsetDensity = onsetDensity; }

    public double getLowBandEnergyRatio() { return lowBandEnergyRatio; }
    public void setLowBandEnergyRatio(double lowBandEnergyRatio) { this.lowBandEnergyRatio = lowBandEnergyRatio; }

    public List<Double> getRmsEnvelope() { return rmsEnvelope; }
    public void setRmsEnvelope(List<Double> rmsEnvelope) { this.rmsEnvelope = rmsEnvelope; }

    public List<Double> getSpectralCentroidSeries() { return spectralCentroidSeries; }
    public void setSpectralCentroidSeries(List<Double> spectralCentroidSeries) { this.spectralCentroidSeries = spectralCentroidSeries; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("stemType", stemType.getKey());
        obj.put("meanRms", meanRms);
        obj.put("maxRms", maxRms);
        obj.put("meanCentroid", meanCentroid);
        obj.put("maxCentroid", maxCentroid);
        obj.put("onsetDensity", onsetDensity);
        obj.put("lowBandEnergyRatio", lowBandEnergyRatio);

        if (rmsEnvelope != null && !rmsEnvelope.isEmpty()) {
            JSONArray arr = new JSONArray();
            for (Double v : rmsEnvelope) arr.put(v);
            obj.put("rmsEnvelope", arr);
        }

        if (spectralCentroidSeries != null && !spectralCentroidSeries.isEmpty()) {
            JSONArray arr = new JSONArray();
            for (Double v : spectralCentroidSeries) arr.put(v);
            obj.put("spectralCentroids", arr);
        }

        return obj;
    }

    public static StemFeature fromJsonObject(JSONObject obj) {
        StemFeature feat = new StemFeature();
        if (obj == null) return feat;
        feat.setStemType(StemType.fromString(obj.optString("stemType", "other")));
        feat.setMeanRms(obj.optDouble("meanRms", 0.0));
        feat.setMaxRms(obj.optDouble("maxRms", 0.0));
        feat.setMeanCentroid(obj.optDouble("meanCentroid", 0.0));
        feat.setMaxCentroid(obj.optDouble("maxCentroid", 0.0));
        feat.setOnsetDensity(obj.optDouble("onsetDensity", 0.0));
        feat.setLowBandEnergyRatio(obj.optDouble("lowBandEnergyRatio", 0.0));

        JSONArray rmsArr = obj.optJSONArray("rmsEnvelope");
        if (rmsArr != null) {
            for (int i = 0; i < rmsArr.length(); i++) {
                feat.getRmsEnvelope().add(rmsArr.optDouble(i));
            }
        }

        JSONArray centArr = obj.optJSONArray("spectralCentroids");
        if (centArr != null) {
            for (int i = 0; i < centArr.length(); i++) {
                feat.getSpectralCentroidSeries().add(centArr.optDouble(i));
            }
        }

        return feat;
    }
}
