
import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio } from '@/services/whisper';

interface UseMedicalDictationReturn {
  isRecording: boolean;
  isProcessing: boolean;
  recordingTime: number; // in seconds
  audioData: Uint8Array;
  volumeLevel: number; // 0-100
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  cancel: () => void;
}

export const useMedicalDictation = (): UseMedicalDictationReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Audio References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Visualizer & Silence Detection State
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const [volumeLevel, setVolumeLevel] = useState(0);
  const silenceStartRef = useRef<number | null>(null);
  const SILENCE_THRESHOLD = 5; // Low volume threshold
  const SILENCE_DURATION = 3000; // 3 seconds

  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    setAudioData(dataArray);

    // Calculate volume level for silence detection
    const average = dataArray.reduce((src, val) => src + val, 0) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);
    setVolumeLevel(level);

    // Silence Detection Logic
    if (level < SILENCE_THRESHOLD) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = Date.now();
      } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
        // Auto-stop after silence
        stop();
        return;
      }
    } else {
      silenceStartRef.current = null;
    }

    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, [isRecording]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 1. Setup Audio Context for Visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Low bin count for cleaner bars
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      // 2. Setup Media Recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      silenceStartRef.current = null;

      // 3. Start Animation Loop
      updateVisualizer();

      // 4. Start Timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access is required for dictation.");
    }
  };

  const stop = async (): Promise<string | null> => {
    if (!mediaRecorderRef.current) return null;

    return new Promise((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Clean up audio context
        cleanup();
        setIsProcessing(true);

        try {
          // Send to Whisper Service (Frontend Direct)
          const text = await transcribeAudio(audioBlob);
          setIsProcessing(false);
          resolve(text);
        } catch (error) {
          console.error("Dictation API Error:", error);
          setIsProcessing(false);
          resolve(null);
        }
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const cancel = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  };

  const cleanup = () => {
    setIsRecording(false);

    // Stop tracks
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

    // Stop Audio Context
    audioContextRef.current?.close();

    // Clear Loops
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Reset Refs
    analyserRef.current = null;
    audioContextRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, []);

  return {
    isRecording,
    isProcessing,
    recordingTime,
    volumeLevel,
    audioData,
    start,
    stop,
    cancel
  };
};
