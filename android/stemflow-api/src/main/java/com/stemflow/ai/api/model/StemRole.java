package com.stemflow.ai.api.model;

/**
 * Functional role allocated by Gemini or algorithmic classification.
 */
public enum StemRole {
    FOUNDATION("foundation"),
    LEAD("lead"),
    HARMONIC_PAD("harmonic_pad"),
    RHYTHMIC_PULSE("rhythmic_pulse"),
    TEXTURE("texture"),
    ORNAMENT("ornament");

    private final String key;

    StemRole(String key) {
        this.key = key;
    }

    public String getKey() {
        return key;
    }

    public static StemRole fromString(String text) {
        if (text == null) return TEXTURE;
        for (StemRole r : StemRole.values()) {
            if (r.key.equalsIgnoreCase(text) || r.name().equalsIgnoreCase(text)) {
                return r;
            }
        }
        return TEXTURE;
    }
}
