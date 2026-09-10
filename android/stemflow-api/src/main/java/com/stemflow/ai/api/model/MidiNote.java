package com.stemflow.ai.api.model;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Transcribed MIDI note with stem origin, dynamics, velocity, and micro-tuning.
 */
public class MidiNote {
    private String id;
    private StemType stem;
    private int pitch;
    private double startTime;
    private double duration;
    private int velocity;
    private boolean isGhostNote;
    private String articulation;
    private List<PitchBendPoint> pitchBends;

    public MidiNote() {
        this.stem = StemType.OTHER;
        this.pitch = 60;
        this.velocity = 90;
        this.articulation = "standard";
        this.pitchBends = new ArrayList<>();
    }

    public MidiNote(String id, StemType stem, int pitch, double startTime,
                    double duration, int velocity, boolean isGhostNote, String articulation) {
        this.id = id;
        this.stem = stem;
        this.pitch = pitch;
        this.startTime = startTime;
        this.duration = duration;
        this.velocity = velocity;
        this.isGhostNote = isGhostNote;
        this.articulation = articulation;
        this.pitchBends = new ArrayList<>();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public StemType getStem() { return stem; }
    public void setStem(StemType stem) { this.stem = stem; }

    public int getPitch() { return pitch; }
    public void setPitch(int pitch) { this.pitch = pitch; }

    public double getStartTime() { return startTime; }
    public void setStartTime(double startTime) { this.startTime = startTime; }

    public double getDuration() { return duration; }
    public void setDuration(double duration) { this.duration = duration; }

    public int getVelocity() { return velocity; }
    public void setVelocity(int velocity) { this.velocity = velocity; }

    public boolean isGhostNote() { return isGhostNote; }
    public void setGhostNote(boolean ghostNote) { isGhostNote = ghostNote; }

    public String getArticulation() { return articulation; }
    public void setArticulation(String articulation) { this.articulation = articulation; }

    public List<PitchBendPoint> getPitchBends() { return pitchBends; }
    public void setPitchBends(List<PitchBendPoint> pitchBends) { this.pitchBends = pitchBends; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("id", id);
        obj.put("stem", stem.getKey());
        obj.put("pitch", pitch);
        obj.put("startTime", startTime);
        obj.put("duration", duration);
        obj.put("velocity", velocity);
        obj.put("isGhostNote", isGhostNote);
        obj.put("articulation", articulation);

        if (pitchBends != null && !pitchBends.isEmpty()) {
            JSONArray arr = new JSONArray();
            for (PitchBendPoint pb : pitchBends) {
                arr.put(pb.toJsonObject());
            }
            obj.put("pitchBends", arr);
        }

        return obj;
    }

    public static MidiNote fromJsonObject(JSONObject obj) {
        if (obj == null) return null;
        MidiNote note = new MidiNote(
            obj.optString("id", "note-" + System.nanoTime()),
            StemType.fromString(obj.optString("stem", "other")),
            obj.optInt("pitch", 60),
            obj.optDouble("startTime", 0.0),
            obj.optDouble("duration", 0.5),
            obj.optInt("velocity", 90),
            obj.optBoolean("isGhostNote", false),
            obj.optString("articulation", "standard")
        );

        JSONArray pbArr = obj.optJSONArray("pitchBends");
        if (pbArr != null) {
            for (int i = 0; i < pbArr.length(); i++) {
                JSONObject pbObj = pbArr.optJSONObject(i);
                if (pbObj != null) {
                    note.getPitchBends().add(PitchBendPoint.fromJsonObject(pbObj));
                }
            }
        }

        return note;
    }
}
