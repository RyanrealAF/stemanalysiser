package com.stemflow.ai.api.model;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Harmonic segment detected by chromagram modal analysis.
 */
public class ChordSegment {
    private double timestampSec;
    private double durationSec;
    private String chordName;
    private String romanNumeral;
    private String inversion;
    private double harmonicTension;

    public ChordSegment() {}

    public ChordSegment(double timestampSec, double durationSec, String chordName,
                        String romanNumeral, String inversion, double harmonicTension) {
        this.timestampSec = timestampSec;
        this.durationSec = durationSec;
        this.chordName = chordName;
        this.romanNumeral = romanNumeral;
        this.inversion = inversion;
        this.harmonicTension = harmonicTension;
    }

    public double getTimestampSec() { return timestampSec; }
    public void setTimestampSec(double timestampSec) { this.timestampSec = timestampSec; }

    public double getDurationSec() { return durationSec; }
    public void setDurationSec(double durationSec) { this.durationSec = durationSec; }

    public String getChordName() { return chordName; }
    public void setChordName(String chordName) { this.chordName = chordName; }

    public String getRomanNumeral() { return romanNumeral; }
    public void setRomanNumeral(String romanNumeral) { this.romanNumeral = romanNumeral; }

    public String getInversion() { return inversion; }
    public void setInversion(String inversion) { this.inversion = inversion; }

    public double getHarmonicTension() { return harmonicTension; }
    public void setHarmonicTension(double harmonicTension) { this.harmonicTension = harmonicTension; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("timestampSec", timestampSec);
        obj.put("durationSec", durationSec);
        obj.put("chordName", chordName);
        obj.put("romanNumeral", romanNumeral);
        obj.put("inversion", inversion);
        obj.put("harmonicTension", harmonicTension);
        return obj;
    }

    public static ChordSegment fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        return new ChordSegment(
            obj.optDouble("timestampSec", 0.0),
            obj.optDouble("durationSec", 2.0),
            obj.optString("chordName", "C"),
            obj.optString("romanNumeral", "I"),
            obj.optString("inversion", "root"),
            obj.optDouble("harmonicTension", 0.0)
        );
    }
}
