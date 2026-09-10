package com.stemflow.ai.api.model;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Audit log entry emitted by the deterministic cross-stem collision pass.
 */
public class CollisionTelemetryItem {
    private double timestampSec;
    private int midiPitch;
    private String retainedStem;
    private String prunedStem;
    private double deltaEnergyDb;
    private String rule;

    public CollisionTelemetryItem() {}

    public CollisionTelemetryItem(double timestampSec, int midiPitch, String retainedStem,
                                  String prunedStem, double deltaEnergyDb, String rule) {
        this.timestampSec = timestampSec;
        this.midiPitch = midiPitch;
        this.retainedStem = retainedStem;
        this.prunedStem = prunedStem;
        this.deltaEnergyDb = deltaEnergyDb;
        this.rule = rule;
    }

    public double getTimestampSec() { return timestampSec; }
    public void setTimestampSec(double timestampSec) { this.timestampSec = timestampSec; }

    public int getMidiPitch() { return midiPitch; }
    public void setMidiPitch(int midiPitch) { this.midiPitch = midiPitch; }

    public String getRetainedStem() { return retainedStem; }
    public void setRetainedStem(String retainedStem) { this.retainedStem = retainedStem; }

    public String getPrunedStem() { return prunedStem; }
    public void setPrunedStem(String prunedStem) { this.prunedStem = prunedStem; }

    public double getDeltaEnergyDb() { return deltaEnergyDb; }
    public void setDeltaEnergyDb(double deltaEnergyDb) { this.deltaEnergyDb = deltaEnergyDb; }

    public String getRule() { return rule; }
    public void setRule(String rule) { this.rule = rule; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("timestampSec", timestampSec);
        obj.put("midiPitch", midiPitch);
        obj.put("retainedStem", retainedStem);
        obj.put("prunedStem", prunedStem);
        obj.put("deltaEnergyDb", deltaEnergyDb);
        obj.put("rule", rule);
        return obj;
    }

    public static CollisionTelemetryItem fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        return new CollisionTelemetryItem(
            obj.optDouble("timestampSec", 0.0),
            obj.optInt("midiPitch", 60),
            obj.optString("retainedStem", "other"),
            obj.optString("prunedStem", "other"),
            obj.optDouble("deltaEnergyDb", 0.0),
            obj.optString("rule", "SALIENT_F0_MAGNITUDE")
        );
    }
}
