package com.stemflow.ai.api.model;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Metadata for a processed song.
 */
public class SongMetadata {
    private String title;
    private String artist;
    private double bpm;
    private String key;
    private double durationSec;
    private int sampleRate;
    private int channels;

    public SongMetadata() {
        this.title = "Untitled Recording";
        this.artist = "Unknown Artist";
        this.bpm = 120.0;
        this.key = "C Major";
        this.durationSec = 30.0;
        this.sampleRate = 44100;
        this.channels = 2;
    }

    public SongMetadata(String title, String artist, double bpm, String key, double durationSec, int sampleRate, int channels) {
        this.title = title;
        this.artist = artist;
        this.bpm = bpm;
        this.key = key;
        this.durationSec = durationSec;
        this.sampleRate = sampleRate;
        this.channels = channels;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getArtist() { return artist; }
    public void setArtist(String artist) { this.artist = artist; }

    public double getBpm() { return bpm; }
    public void setBpm(double bpm) { this.bpm = bpm; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public double getDurationSec() { return durationSec; }
    public void setDurationSec(double durationSec) { this.durationSec = durationSec; }

    public int getSampleRate() { return sampleRate; }
    public void setSampleRate(int sampleRate) { this.sampleRate = sampleRate; }

    public int getChannels() { return channels; }
    public void setChannels(int channels) { this.channels = channels; }

    public JSONObject toJsonObject() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("title", title);
        obj.put("artist", artist);
        obj.put("bpm", bpm);
        obj.put("key", key);
        obj.put("duration", durationSec);
        obj.put("sampleRate", sampleRate);
        obj.put("channels", channels);
        return obj;
    }

    public static SongMetadata fromJsonObject(JSONObject obj) {
        SongMetadata meta = new SongMetadata();
        if (obj == null) return meta;
        meta.setTitle(obj.optString("title", "Untitled"));
        meta.setArtist(obj.optString("artist", "Unknown"));
        meta.setBpm(obj.optDouble("bpm", 120.0));
        meta.setKey(obj.optString("key", "C Major"));
        meta.setDurationSec(obj.optDouble("duration", 30.0));
        meta.setSampleRate(obj.optInt("sampleRate", 44100));
        meta.setChannels(obj.optInt("channels", 2));
        return meta;
    }
}
