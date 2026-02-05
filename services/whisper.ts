
/**
 * Whisper Service
 * Direct client-side integration with OpenAI Whisper API.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OpenAI API Key (VITE_OPENAI_API_KEY) is not configured in .env.local');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'record.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('temperature', '0.2');
    formData.append('prompt', "Medical Dictation. Patient History, SOAP Note, Cardiology, Oncology, Dermatology. Common drugs: Lisinopril, Metformin, Atorvastatin. CPT Codes. ICD-10. Professional casing and punctuation.");

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Transcription failed');
        }

        const data = await response.json();
        return data.text;
    } catch (error: any) {
        console.error('Whisper API Error:', error);
        throw error;
    }
};
