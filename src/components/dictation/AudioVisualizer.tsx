
import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  audioData: Uint8Array;
  isRecording: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioData, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!isRecording) return;

    // Visual settings
    const barWidth = 4;
    const barGap = 2;
    const totalBars = Math.floor(width / (barWidth + barGap));
    
    // We only use the lower frequency bands which usually contain voice
    const dataStep = Math.floor(audioData.length / totalBars);

    // Gradient Style
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#2dd4bf'); // Teal-400
    gradient.addColorStop(0.5, '#0d9488'); // Teal-600
    gradient.addColorStop(1, '#2dd4bf'); // Teal-400

    ctx.fillStyle = gradient;

    for (let i = 0; i < totalBars; i++) {
      const dataIndex = Math.floor(i * dataStep);
      const value = audioData[dataIndex] || 0;

      // Scale value to height (mirror effect)
      // Normalize 0-255 to 0-1, then scale to canvas height
      const percent = value / 255;
      const barHeight = (percent * height) * 0.8; // Max 80% height
      
      const x = i * (barWidth + barGap);
      const y = (height - barHeight) / 2; // Center vertically

      // Draw rounded bar
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 20);
      ctx.fill();
    }

  }, [audioData, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={40}
      className="opacity-90"
    />
  );
};

export default AudioVisualizer;
