package com.stemflow.ai.api.model;

/**
 * Represents the 6 isolated stems in StemFlow AI.
 */
public enum StemType {
    VOCALS("vocals"),
    BASS("bass"),
    DRUMS("drums"),
    GUITAR("guitar"),
    PIANO("piano"),
    OTHER("other");

    private final String key;

    StemType(String key) {
        this.key = key;
    }

    public String getKey() {
        return key;
    }

    public static StemType fromString(String text) {
        if (text == null) return OTHER;
        for (StemType b : StemType.values()) {
            if (b.key.equalsIgnoreCase(text) || b.name().equalsIgnoreCase(text)) {
                return b;
            }
        }
        return OTHER;
    }
}
