package com.stemflow.ai.api.model;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Structural section of a musical arrangement (Intro, Verse, Chorus, etc.).
 */
public class SectionAnalysis {
    private String id;
    private String name;
    private double startTimeSec;
    private double endTimeSec;
    private double energyLevel;
    private String dynamicQuantizationGrid;
    private double harmonicTensionScore;
    private List<StemRoleAllocation> stemRoles;

    public SectionAnalysis() {
        this.stemRoles = new ArrayList<>();
    }

    public SectionAnalysis(String id, String name, double startTimeSec, double endTimeSec,
                           double energyLevel, String dynamicQuantizationGrid, double harmonicTensionScore) {
        this.id = id;
        this.name = name;
        this.startTimeSec = startTimeSec;
        this.endTimeSec = endTimeSec;
        this.energyLevel = energyLevel;
        this.dynamicQuantizationGrid = dynamicQuantizationGrid;
        this.harmonicTensionScore = harmonicTensionScore;
        this.stemRoles = new ArrayList<>();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getStartTimeSec() { return startTimeSec; }
    public void setStartTimeSec(double startTimeSec) { this.startTimeSec = startTimeSec; }

    public double getEndTimeSec() { return endTimeSec; }
    public void setEndTimeSec(double endTimeSec) { this.endTimeSec = endTimeSec; }

    public double getEnergyLevel() { return energyLevel; }
    public void setEnergyLevel(double energyLevel) { this.energyLevel = energyLevel; }

    public String getDynamicQuantizationGrid() { return dynamicQuantizationGrid; }
    public void setDynamicQuantizationGrid(String dynamicQuantizationGrid) { this.dynamicQuantizationGrid = dynamicQuantizationGrid; }

    public double getHarmonicTensionScore() { return harmonicTensionScore; }
    public void setHarmonicTensionScore(double harmonicTensionScore) { this.harmonicTensionScore = harmonicTensionScore; }

    public List<StemRoleAllocation> getStemRoles() { return stemRoles; }
    public void setStemRoles(List<StemRoleAllocation> stemRoles) { this.stemRoles = stemRoles; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("id", id);
        obj.put("name", name);
        obj.put("startTime", startTimeSec);
        obj.put("endTime", endTimeSec);
        obj.put("energyLevel", energyLevel);
        obj.put("dynamicQuantizationGrid", dynamicQuantizationGrid);
        obj.put("harmonicTensionScore", harmonicTensionScore);

        if (stemRoles != null) {
            JSONArray arr = new JSONArray();
            for (StemRoleAllocation role : stemRoles) {
                arr.put(role.toJsonObject());
            }
            obj.put("stemRoles", arr);
        }

        return obj;
    }

    public static SectionAnalysis fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        SectionAnalysis sec = new SectionAnalysis(
            obj.optString("id", "sec-0"),
            obj.optString("name", "Section"),
            obj.optDouble("startTime", 0.0),
            obj.optDouble("endTime", 10.0),
            obj.optDouble("energyLevel", 0.5),
            obj.optString("dynamicQuantizationGrid", "1/16"),
            obj.optDouble("harmonicTensionScore", 50.0)
        );

        JSONArray rolesArr = obj.optJSONArray("stemRoles");
        if (rolesArr != null) {
            for (int i = 0; i < rolesArr.length(); i++) {
                JSONObject rObj = rolesArr.optJSONObject(i);
                if (rObj != null) {
                    sec.getStemRoles().add(StemRoleAllocation.fromJsonObject(rObj));
                }
            }
        }
        return sec;
    }
}
