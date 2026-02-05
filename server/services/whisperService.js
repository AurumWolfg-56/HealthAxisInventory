
const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribes medical audio using OpenAI Whisper.
 * @param {Buffer} fileBuffer - The audio file buffer.
 * @returns {Promise<string>} - The transcribed text.
 */
exports.transcribeMedicalAudio = async (fileBuffer) => {
  const tempFilePath = path.join(os.tmpdir(), `dictation_${Date.now()}.webm`);

  try {
    // 1. Write buffer to temp file (OpenAI SDK prefers streams/files)
    fs.writeFileSync(tempFilePath, fileBuffer);

    // 2. Call OpenAI Whisper
    // We use a low temperature for factual accuracy and a specific prompt to prime the medical context.
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en',
      temperature: 0.2, // Low creativity, high precision
      prompt: "Medical Dictation. Patient History, SOAP Note, Cardiology, Oncology, Dermatology. Common drugs: Lisinopril, Metformin, Atorvastatin. CPT Codes. ICD-10. Professional casing and punctuation.",
      response_format: 'text', // Get raw text directly
    });

    return response; // The raw text string

  } catch (error) {
    console.error("Medical Dictation Error:", error);
    // Return null to indicate failure without crashing the app
    return null;
  } finally {
    // 3. Cleanup temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};
