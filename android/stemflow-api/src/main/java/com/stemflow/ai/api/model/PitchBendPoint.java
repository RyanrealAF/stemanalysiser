package com.stemflow.ai.api.model;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Micro-pitch bend point (-2.0 to +2.0 semitones) within a note.
 */
public class PitchBendPoint {
    private double offsetSec;
    private double semitones;

    public PitchBendPoint() {}

    public PitchBendPoint(double offsetSec, double semitones) {
        this.offsetSec = offsetSec;
        this.semitones = semitones;
    }

    public double getOffsetSec() { return offsetSec; }
    public void setOffsetSec(double offsetSec) { this.offsetSec = offsetSec; }

    public double getSemitones() { return semitones; }
    public void setSemitones(double semitones) { this.semitones = semitones; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("offsetSec", offsetSec);
        obj.put("semitones", semitones);
        return obj;
    }

    public static PitchBendPoint fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        return new PitchBendPoint(
            obj.optDouble("offsetSec", 0.0),
            obj.optDouble("semitones", 0.0)
        );
    }
}
