package com.stemflow.ai.api.model;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Correlation pair between two audio stems.
 */
public class CrossStemCorrelation {
    private String stemA;
    private String stemB;
    private double coefficient;

    public CrossStemCorrelation() {}

    public CrossStemCorrelation(String stemA, String stemB, double coefficient) {
        this.stemA = stemA;
        this.stemB = stemB;
        this.coefficient = coefficient;
    }

    public String getStemA() { return stemA; }
    public void setStemA(String stemA) { this.stemA = stemA; }

    public String getStemB() { return stemB; }
    public void setStemB(String stemB) { this.stemB = stemB; }

    public double getCoefficient() { return coefficient; }
    public void setCoefficient(double coefficient) { this.coefficient = coefficient; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("stemA", stemA);
        obj.put("stemB", stemB);
        obj.put("coefficient", coefficient);
        return obj;
    }

    public static CrossStemCorrelation fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        return new CrossStemCorrelation(
            obj.optString("stemA", ""),
            obj.optString("stemB", ""),
            obj.optDouble("coefficient", 0.0)
        );
    }
}
