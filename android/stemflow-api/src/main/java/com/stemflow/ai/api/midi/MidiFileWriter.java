package com.stemflow.ai.api.midi;

import com.stemflow.ai.api.model.MidiNote;
import com.stemflow.ai.api.model.PitchBendPoint;
import com.stemflow.ai.api.model.StemType;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Standard MIDI Format (SMF) Type 1 binary file generator.
 * Produces multitrack .mid files conforming to the MIDI 1.0 specification.
 */
public class MidiFileWriter {
    private static final int PPQN = 480; // Pulses (ticks) per quarter note

    private static class MidiEvent {
        long tick;
        byte[] data;

        MidiEvent(long tick, byte[] data) {
            this.tick = tick;
            this.data = data;
        }
    }

    /**
     * Encodes a list of MidiNotes into a Standard MIDI File Type 1 byte array.
     */
    public static byte[] generateType1Midi(List<MidiNote> notes, double bpm, StemType targetStemOnly) throws IOException {
        ByteArrayOutputStream fileBaos = new ByteArrayOutputStream();

        // Separate notes by stem
        List<StemType> activeStems = new ArrayList<>();
        if (targetStemOnly != null) {
            activeStems.add(targetStemOnly);
        } else {
            for (StemType s : StemType.values()) {
                activeStems.add(s);
            }
        }

        int trackCount = 1 + activeStems.size(); // Conductor track + stem tracks

        // 1. Write MThd Header Chunk
        fileBaos.write(new byte[] { 'M', 'T', 'h', 'd' });
        writeBigEndianInt(fileBaos, 6);
        writeBigEndianShort(fileBaos, (short) 1); // Format 1: Multiple tracks, synchronous
        writeBigEndianShort(fileBaos, (short) trackCount);
        writeBigEndianShort(fileBaos, (short) PPQN);

        // 2. Write Conductor Track (Track 0)
        byte[] conductorTrackBytes = buildConductorTrack(bpm);
        writeTrackChunk(fileBaos, conductorTrackBytes);

        // 3. Write Stem Tracks
        int channelIndex = 0;
        for (StemType stem : activeStems) {
            int midiChannel = (stem == StemType.DRUMS) ? 9 : (channelIndex % 16);
            if (midiChannel == 9 && stem != StemType.DRUMS) {
                channelIndex++;
                midiChannel = channelIndex % 16;
            }
            channelIndex++;

            List<MidiNote> stemNotes = new ArrayList<>();
            for (MidiNote n : notes) {
                if (n.getStem() == stem && !n.isGhostNote()) {
                    stemNotes.add(n);
                }
            }

            byte[] stemTrackBytes = buildStemTrack(stem, stemNotes, bpm, midiChannel);
            writeTrackChunk(fileBaos, stemTrackBytes);
        }

        return fileBaos.toByteArray();
    }

    /**
     * Writes MIDI bytes directly to a destination File.
     */
    public static void writeMidiFile(File outputFile, List<MidiNote> notes, double bpm, StemType targetStemOnly) throws IOException {
        byte[] bytes = generateType1Midi(notes, bpm, targetStemOnly);
        try (FileOutputStream fos = new FileOutputStream(outputFile)) {
            fos.write(bytes);
            fos.flush();
        }
    }

    private static byte[] buildConductorTrack(double bpm) throws IOException {
        ByteArrayOutputStream trackBaos = new ByteArrayOutputStream();

        // Track Name: "Conductor / Tempo"
        writeMetaEvent(trackBaos, 0, 0x03, "Tempo Track".getBytes(StandardCharsets.UTF_8));

        // Time Signature: 4/4 time (numerator=4, denominator=2^2=4, clocks/click=24, 32nd notes=8)
        writeMetaEvent(trackBaos, 0, 0x58, new byte[] { 0x04, 0x02, 0x18, 0x08 });

        // Set Tempo: Microseconds per quarter note = (60000000 / bpm)
        int mpqn = (int) Math.round(60_000_000.0 / Math.max(20.0, Math.min(300.0, bpm)));
        writeMetaEvent(trackBaos, 0, 0x51, new byte[] {
            (byte) ((mpqn >> 16) & 0xFF),
            (byte) ((mpqn >> 8) & 0xFF),
            (byte) (mpqn & 0xFF)
        });

        // End of Track
        writeMetaEvent(trackBaos, 0, 0x2F, new byte[0]);
        return trackBaos.toByteArray();
    }

    private static byte[] buildStemTrack(StemType stem, List<MidiNote> notes, double bpm, int channel) throws IOException {
        ByteArrayOutputStream trackBaos = new ByteArrayOutputStream();

        // Track Name
        String trackName = stem.name().charAt(0) + stem.name().substring(1).toLowerCase();
        writeMetaEvent(trackBaos, 0, 0x03, trackName.getBytes(StandardCharsets.UTF_8));

        // Program Change (Instrument)
        int program = getGeneralMidiProgram(stem);
        if (stem != StemType.DRUMS) {
            writeVariableLengthQuantity(trackBaos, 0);
            trackBaos.write(new byte[] { (byte) (0xC0 | (channel & 0x0F)), (byte) (program & 0x7F) });
        }

        // Convert Notes to Scheduled MidiEvents
        List<MidiEvent> events = new ArrayList<>();
        double secPerTick = 60.0 / (bpm * PPQN);

        for (MidiNote n : notes) {
            long onTick = Math.max(0, Math.round(n.getStartTime() / secPerTick));
            long offTick = Math.max(onTick + 1, Math.round((n.getStartTime() + n.getDuration()) / secPerTick));
            int pitch = Math.max(0, Math.min(127, n.getPitch()));
            int velocity = Math.max(1, Math.min(127, n.getVelocity()));

            // Note On
            byte[] noteOnData = new byte[] { (byte) (0x90 | (channel & 0x0F)), (byte) pitch, (byte) velocity };
            events.add(new MidiEvent(onTick, noteOnData));

            // Pitch bends if present
            if (n.getPitchBends() != null) {
                for (PitchBendPoint pb : n.getPitchBends()) {
                    long pbTick = onTick + Math.round(pb.getOffsetSec() / secPerTick);
                    if (pbTick < offTick) {
                        // Semitones [-2.0, +2.0] mapped to 14-bit [0..16383], center = 8192
                        double normalizedBend = Math.max(-2.0, Math.min(2.0, pb.getSemitones())) / 2.0;
                        int bendValue = (int) Math.round(8192 + normalizedBend * 8191);
                        bendValue = Math.max(0, Math.min(16383, bendValue));
                        int lsb = bendValue & 0x7F;
                        int msb = (bendValue >> 7) & 0x7F;
                        byte[] bendData = new byte[] { (byte) (0xE0 | (channel & 0x0F)), (byte) lsb, (byte) msb };
                        events.add(new MidiEvent(pbTick, bendData));
                    }
                }
            }

            // Note Off
            byte[] noteOffData = new byte[] { (byte) (0x80 | (channel & 0x0F)), (byte) pitch, 0x00 };
            events.add(new MidiEvent(offTick, noteOffData));
        }

        // Sort chronologically
        Collections.sort(events, Comparator.comparingLong(e -> e.tick));

        // Serialize events with delta times
        long currentTick = 0;
        for (MidiEvent ev : events) {
            long delta = ev.tick - currentTick;
            if (delta < 0) delta = 0;
            writeVariableLengthQuantity(trackBaos, delta);
            trackBaos.write(ev.data);
            currentTick = ev.tick;
        }

        // Reset pitch bend to center (8192) at end
        writeVariableLengthQuantity(trackBaos, 0);
        trackBaos.write(new byte[] { (byte) (0xE0 | (channel & 0x0F)), 0x00, 0x40 });

        // End of track meta event
        writeMetaEvent(trackBaos, 0, 0x2F, new byte[0]);
        return trackBaos.toByteArray();
    }

    private static int getGeneralMidiProgram(StemType stem) {
        switch (stem) {
            case BASS: return 33;    // Electric Bass (finger)
            case VOCALS: return 54;  // Synth Voice / Oohs
            case GUITAR: return 27;  // Electric Guitar (clean)
            case PIANO: return 0;    // Acoustic Grand Piano
            case DRUMS: return 0;    // Standard Kit
            case OTHER:
            default: return 89;      // Pad 2 (warm)
        }
    }

    private static void writeTrackChunk(ByteArrayOutputStream fileBaos, byte[] trackData) throws IOException {
        fileBaos.write(new byte[] { 'M', 'T', 'r', 'k' });
        writeBigEndianInt(fileBaos, trackData.length);
        fileBaos.write(trackData);
    }

    private static void writeMetaEvent(ByteArrayOutputStream trackBaos, long deltaTicks, int type, byte[] data) throws IOException {
        writeVariableLengthQuantity(trackBaos, deltaTicks);
        trackBaos.write(0xFF);
        trackBaos.write(type & 0xFF);
        writeVariableLengthQuantity(trackBaos, data.length);
        if (data.length > 0) {
            trackBaos.write(data);
        }
    }

    private static void writeVariableLengthQuantity(ByteArrayOutputStream baos, long value) {
        long buffer = value & 0x7F;
        while ((value >>= 7) > 0) {
            buffer <<= 8;
            buffer |= ((value & 0x7F) | 0x80);
        }
        while (true) {
            baos.write((int) (buffer & 0xFF));
            if ((buffer & 0x80) != 0) {
                buffer >>= 8;
            } else {
                break;
            }
        }
    }

    private static void writeBigEndianInt(ByteArrayOutputStream baos, int value) {
        baos.write((value >> 24) & 0xFF);
        baos.write((value >> 16) & 0xFF);
        baos.write((value >> 8) & 0xFF);
        baos.write(value & 0xFF);
    }

    private static void writeBigEndianShort(ByteArrayOutputStream baos, short value) {
        baos.write((value >> 8) & 0xFF);
        baos.write(value & 0xFF);
    }
}
