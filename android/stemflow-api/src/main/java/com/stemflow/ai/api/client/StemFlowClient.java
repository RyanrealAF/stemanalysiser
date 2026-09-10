package com.stemflow.ai.api.client;

import com.stemflow.ai.api.model.HealthResponse;
import com.stemflow.ai.api.model.ModelsInfoResponse;
import com.stemflow.ai.api.model.SongAnalysisRequest;
import com.stemflow.ai.api.model.SongAnalysisResponse;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Production-ready Android HTTP client for communicating with the StemFlow AI Server.
 */
public class StemFlowClient {
    private final String baseUrl;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final ExecutorService executor;

    public static class Builder {
        private String baseUrl = "http://10.0.2.2:3000"; // Default Android emulator localhost
        private int connectTimeoutMs = 30000;
        private int readTimeoutMs = 60000;
        private ExecutorService executor = null;

        public Builder setBaseUrl(String baseUrl) {
            if (baseUrl.endsWith("/")) {
                this.baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            } else {
                this.baseUrl = baseUrl;
            }
            return this;
        }

        public Builder setConnectTimeoutMs(int connectTimeoutMs) {
            this.connectTimeoutMs = connectTimeoutMs;
            return this;
        }

        public Builder setReadTimeoutMs(int readTimeoutMs) {
            this.readTimeoutMs = readTimeoutMs;
            return this;
        }

        public Builder setExecutor(ExecutorService executor) {
            this.executor = executor;
            return this;
        }

        public StemFlowClient build() {
            return new StemFlowClient(this);
        }
    }

    private StemFlowClient(Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.connectTimeoutMs = builder.connectTimeoutMs;
        this.readTimeoutMs = builder.readTimeoutMs;
        this.executor = builder.executor != null ? builder.executor : Executors.newCachedThreadPool();
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Asynchronously calls /api/analyze-song to get Gemini section and stem arrangement analysis.
     */
    public void analyzeSong(final SongAnalysisRequest request, final ApiCallback<SongAnalysisResponse> callback) {
        executor.execute(() -> {
            try {
                SongAnalysisResponse response = analyzeSongSync(request);
                callback.onSuccess(response);
            } catch (Throwable t) {
                callback.onError(t);
            }
        });
    }

    /**
     * Synchronously calls /api/analyze-song.
     */
    public SongAnalysisResponse analyzeSongSync(SongAnalysisRequest request) throws IOException, JSONException {
        if (request == null) {
            throw new IllegalArgumentException("SongAnalysisRequest cannot be null");
        }
        String endpoint = baseUrl + "/api/analyze-song";
        JSONObject payload = request.toJsonObject();
        JSONObject responseJson = postJson(endpoint, payload);
        return SongAnalysisResponse.fromJsonObject(responseJson);
    }

    /**
     * Asynchronously checks server health.
     */
    public void checkHealth(final ApiCallback<HealthResponse> callback) {
        executor.execute(() -> {
            try {
                HealthResponse response = checkHealthSync();
                callback.onSuccess(response);
            } catch (Throwable t) {
                callback.onError(t);
            }
        });
    }

    /**
     * Synchronously checks server health.
     */
    public HealthResponse checkHealthSync() throws IOException, JSONException {
        String endpoint = baseUrl + "/api/health";
        JSONObject responseJson = getJson(endpoint);
        return HealthResponse.fromJsonObject(responseJson);
    }

    /**
     * Asynchronously gets backend model and DSP information.
     */
    public void getModelsInfo(final ApiCallback<ModelsInfoResponse> callback) {
        executor.execute(() -> {
            try {
                ModelsInfoResponse response = getModelsInfoSync();
                callback.onSuccess(response);
            } catch (Throwable t) {
                callback.onError(t);
            }
        });
    }

    /**
     * Synchronously gets backend model and DSP information.
     */
    public ModelsInfoResponse getModelsInfoSync() throws IOException, JSONException {
        String endpoint = baseUrl + "/api/models-info";
        JSONObject responseJson = getJson(endpoint);
        return ModelsInfoResponse.fromJsonObject(responseJson);
    }

    // HTTP Helper methods
    private JSONObject getJson(String urlString) throws IOException, JSONException {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(connectTimeoutMs);
            conn.setReadTimeout(readTimeoutMs);
            conn.setRequestProperty("Accept", "application/json");

            int responseCode = conn.getResponseCode();
            InputStream stream = (responseCode >= 200 && responseCode < 300)
                ? conn.getInputStream()
                : conn.getErrorStream();

            String responseString = readStream(stream);
            if (responseCode < 200 || responseCode >= 300) {
                throw new IOException("HTTP Error " + responseCode + ": " + responseString);
            }
            return new JSONObject(responseString);
        } finally {
            conn.disconnect();
        }
    }

    private JSONObject postJson(String urlString, JSONObject payload) throws IOException, JSONException {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(connectTimeoutMs);
            conn.setReadTimeout(readTimeoutMs);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);

            byte[] outputBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(outputBytes.length);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(outputBytes);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            InputStream stream = (responseCode >= 200 && responseCode < 300)
                ? conn.getInputStream()
                : conn.getErrorStream();

            String responseString = readStream(stream);
            if (responseCode < 200 || responseCode >= 300) {
                throw new IOException("HTTP Error " + responseCode + ": " + responseString);
            }
            return new JSONObject(responseString);
        } finally {
            conn.disconnect();
        }
    }

    private String readStream(InputStream stream) throws IOException {
        if (stream == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            return sb.toString();
        }
    }
}
