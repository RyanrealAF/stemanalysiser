package com.stemflow.ai.api.audio;

/**
 * Pure Java in-place Radix-2 Cooley-Tukey Fast Fourier Transform.
 * Used for spectral analysis and Spectral Centroid calculations.
 */
public class FastFourierTransform {

    /**
     * Performs in-place FFT on real and imaginary components.
     * Length N must be a power of two.
     */
    public static void fft(double[] real, double[] imag) {
        int n = real.length;
        if (n == 0 || (n & (n - 1)) != 0) {
            throw new IllegalArgumentException("Array length must be a power of 2");
        }

        // Bit-reversal permutation
        int j = 0;
        for (int i = 0; i < n - 1; i++) {
            if (i < j) {
                double tempR = real[i];
                real[i] = real[j];
                real[j] = tempR;

                double tempI = imag[i];
                imag[i] = imag[j];
                imag[j] = tempI;
            }
            int k = n / 2;
            while (k <= j) {
                j -= k;
                k /= 2;
            }
            j += k;
        }

        // Danielson-Lanczos algorithm
        for (int len = 2; len <= n; len <<= 1) {
            double angle = -2.0 * Math.PI / len;
            double wlenR = Math.cos(angle);
            double wlenI = Math.sin(angle);

            for (int i = 0; i < n; i += len) {
                double wR = 1.0;
                double wI = 0.0;
                for (int k = 0; k < len / 2; k++) {
                    int uIndex = i + k;
                    int vIndex = i + k + len / 2;

                    double uR = real[uIndex];
                    double uI = imag[uIndex];
                    double vR = real[vIndex] * wR - imag[vIndex] * wI;
                    double vI = real[vIndex] * wI + imag[vIndex] * wR;

                    real[uIndex] = uR + vR;
                    imag[uIndex] = uI + vI;
                    real[vIndex] = uR - vR;
                    imag[vIndex] = uI - vI;

                    double nextWR = wR * wlenR - wI * wlenI;
                    wI = wR * wlenI + wI * wlenR;
                    wR = nextWR;
                }
            }
        }
    }

    /**
     * Computes the Spectral Centroid (in Hz) of a PCM window using Hann windowing and FFT.
     */
    public static double computeSpectralCentroid(short[] window, int sampleRate) {
        // Find nearest power of 2
        int n = 1;
        while (n < window.length) {
            n <<= 1;
        }
        if (n > 2048) n = 2048; // Limit to 2048 bins for efficiency

        double[] real = new double[n];
        double[] imag = new double[n];

        // Apply Hann window and fill real array
        int validLength = Math.min(window.length, n);
        for (int i = 0; i < validLength; i++) {
            double hann = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / (validLength - 1)));
            real[i] = (window[i] / 32768.0) * hann;
            imag[i] = 0.0;
        }

        fft(real, imag);

        // Compute magnitude spectrum and spectral centroid
        double weightedFreqSum = 0.0;
        double magnitudeSum = 0.0;
        int halfN = n / 2;
        double freqResolution = (double) sampleRate / n;

        for (int k = 0; k < halfN; k++) {
            double mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
            double freq = k * freqResolution;
            weightedFreqSum += freq * mag;
            magnitudeSum += mag;
        }

        if (magnitudeSum <= 1e-9) {
            return 0.0;
        }

        return weightedFreqSum / magnitudeSum;
    }
}
