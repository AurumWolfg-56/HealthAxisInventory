
/**
 * Whisper Service
 * 100% Local speech-to-text via faster-whisper server.
 * No audio data ever leaves the local network.
 *
 * Server: whisper_server.py (localhost:8765)
 * Model:  whisper-large-v3-turbo (NVIDIA GPU accelerated)
 */

// Local Whisper server (faster-whisper + FastAPI)
const LOCAL_WHISPER_URL = 'http://localhost:8765/v1/audio/transcriptions';

// Medical context prompt for better accuracy
const MEDICAL_PROMPT = "Medical Dictation. Patient History, SOAP Note, Cardiology, Oncology, Dermatology. Common drugs: Lisinopril, Metformin, Atorvastatin. CPT Codes. ICD-10. Urgent Care. Inventory management. Professional casing and punctuation.";

/**
 * Transcribe audio using local Whisper server (100% private).
 * @throws Error if local server is not running.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    console.log('[Whisper] Transcribing via local server...');

    const formData = new FormData();
    formData.append('file', audioBlob, 'record.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'en');
    formData.append('temperature', '0.2');
    formData.append('prompt', MEDICAL_PROMPT);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
        const response = await fetch(LOCAL_WHISPER_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal
            // No Authorization header — local server, no API key
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Local Whisper error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Whisper] ✅ Local transcription successful');
        return data.text;

    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('Transcription timed out. Is the Whisper server running? (python whisper_server.py)');
        }

        // Connection refused = server not running
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            throw new Error('Cannot connect to local Whisper server. Start it with: python whisper_server.py');
        }

        console.error('[Whisper] ❌ Error:', error);
        throw error;
    }
};
