/**
 * Whisper Service
 * 100% Local speech-to-text via faster-whisper server.
 * No audio data ever leaves the local network.
 *
 * Server: whisper_server.py (localhost:8765)
 * Model:  whisper-large-v3-turbo (NVIDIA GPU accelerated)
 */

// Local Whisper server (faster-whisper + FastAPI)
const LOCAL_WHISPER_URL = 'https://ai.norvexiscore.com/v1/audio/transcriptions';
const LOCAL_WHISPER_WS_URL = 'wss://ai.norvexiscore.com/v1/audio/transcriptions/stream';
const NVX_AI_TOKEN = 'nvx_clinic_ai_secret_2026';

// Medical context prompt for better accuracy
const MEDICAL_PROMPT = "Medical Dictation. Patient History, SOAP Note, Cardiology, Oncology, Dermatology. Common drugs: Lisinopril, Metformin, Atorvastatin. CPT Codes. ICD-10. Urgent Care. Inventory management. Professional casing and punctuation.";

export class WhisperStream {
    private ws: WebSocket | null = null;
    private chunkQueue: Blob[] = [];
    public onText: (text: string) => void = () => {};
    public onError: (error: Error) => void = () => {};

    connect(prompt: string = MEDICAL_PROMPT) {
        if (this.ws) {
            this.ws.close();
        }

        this.chunkQueue = [];

        try {
            this.ws = new WebSocket(LOCAL_WHISPER_WS_URL);
            
            this.ws.onopen = () => {
                console.log('[WhisperStream] Connected');
                // Send the context prompt and auth token
                this.ws?.send(JSON.stringify({ prompt, token: NVX_AI_TOKEN }));
                
                // Drain the queue
                while (this.chunkQueue.length > 0) {
                    const chunk = this.chunkQueue.shift();
                    if (chunk) this.ws?.send(chunk);
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.text) {
                        this.onText(data.text);
                    } else if (data.error) {
                        this.onError(new Error(data.error));
                    }
                } catch (e) {
                    console.error('[WhisperStream] Parse error:', e);
                }
            };

            this.ws.onerror = (e) => {
                console.error('[WhisperStream] Connection error');
                this.onError(new Error('Cannot connect to local Whisper stream. Ensure whisper_server.py is running.'));
            };

            this.ws.onclose = () => {
                console.log('[WhisperStream] Disconnected');
            };
        } catch (e: any) {
            this.onError(e);
        }
    }

    sendAudioChunk(chunk: Blob) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(chunk);
        } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.chunkQueue.push(chunk);
        }
    }

    stop() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Signal the server implicitly by stopping the audio flow.
            // Give the server 3 seconds to finish the last transcription chunk before closing the socket.
            setTimeout(() => {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
            }, 3000);
        } else {
            if (this.ws) {
                this.ws.close();
            }
            this.ws = null;
        }
    }
}

/**
 * Transcribe audio using local Whisper server (100% private) (Legacy HTTP fallback).
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
            headers: {
                'Authorization': `Bearer ${NVX_AI_TOKEN}`
            },
            body: formData,
            signal: controller.signal
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

        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            throw new Error('Cannot connect to local Whisper server. Start it with: python whisper_server.py');
        }

        console.error('[Whisper] ❌ Error:', error);
        throw error;
    }
};
