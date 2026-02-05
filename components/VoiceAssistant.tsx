import React, { useState, useRef } from 'react';
import { transcribeAudio } from '@/services/whisper';
import { processAudioCommand, processTextCommand } from '../services/geminiService';

interface VoiceAssistantProps {
  onCommand: (result: any) => void;
  onError: (msg: string) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onCommand, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error:", err);
      onError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = (blob: Blob) => {
    setIsProcessing(true);

    // Use Whisper for high-accuracy STT first
    transcribeAudio(blob).then(async (text) => {
      try {
        // Use the new text-based command processor for better intent extraction
        const result = await processTextCommand(text);
        onCommand(result);
      } catch (err) {
        onError("Could not understand the transcribed command.");
      } finally {
        setIsProcessing(false);
      }
    }).catch(err => {
      console.error("Transcription error:", err);
      onError("Transcription failed. Please try again.");
      setIsProcessing(false);
    });
  };

  return (
    <div className="fixed bottom-24 right-6 z-[45] md:bottom-10 md:right-10">
      {/* Pulse Effect Ring */}
      {isRecording && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
      )}

      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isProcessing}
        className={`relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform duration-300 border-2
          ${isRecording
            ? 'bg-gradient-to-br from-red-500 to-pink-600 scale-110 border-red-300'
            : isProcessing
              ? 'bg-gray-500 cursor-wait border-gray-400'
              : 'bg-gradient-to-br from-medical-500 to-blue-600 hover:scale-105 border-white/20 hover:shadow-medical-500/50'
          }`}
        title="Hold to Speak"
      >
        {isProcessing ? (
          <i className="fa-solid fa-circle-notch fa-spin text-white text-2xl"></i>
        ) : (
          <i className={`fa-solid ${isRecording ? 'fa-microphone-lines' : 'fa-microphone'} text-white text-2xl drop-shadow-md`}></i>
        )}
      </button>

      {/* Floating Status Label */}
      <div className={`absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/90 backdrop-blur text-white text-xs font-bold rounded-lg whitespace-nowrap shadow-xl border border-gray-700 transition-all duration-300 transform origin-right
        ${isRecording || isProcessing ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-90 translate-x-4 pointer-events-none'}`}>
        {isRecording ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Listening...
          </span>
        ) : "Processing..."}

        {/* Triangle pointer */}
        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-gray-900/90 rotate-45 border-r border-t border-gray-700"></div>
      </div>
    </div>
  );
};

export default VoiceAssistant;