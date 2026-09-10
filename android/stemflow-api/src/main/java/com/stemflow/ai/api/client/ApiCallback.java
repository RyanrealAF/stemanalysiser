package com.stemflow.ai.api.client;

/**
 * Asynchronous callback interface for StemFlow API calls.
 */
public interface ApiCallback<T> {
    void onSuccess(T result);
    void onError(Throwable throwable);
}
