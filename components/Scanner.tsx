
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { identifyItemFromImage } from '../services/geminiService';

interface ScannerProps {
  onScanComplete: (data: any) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setFacingMode(isMobile ? "environment" : "user");
  }, []);

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await identifyItemFromImage(imageSrc);
      onScanComplete(result);
    } catch (err) {
      setError("AI analysis failed. Try closer.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, [onScanComplete]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-mono">
      {/* HUD Header */}
      <div className="absolute top-0 w-full z-20 flex justify-between items-start p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
            <span className="text-medical-500 text-xs tracking-[0.2em] font-bold animate-pulse">SYSTEM_ONLINE</span>
            <span className="text-white font-bold text-xl tracking-tight">AI VISION</span>
        </div>
        <button onClick={onCancel} className="w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500/20 hover:border-red-500 transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode }}
          className="absolute w-full h-full object-cover opacity-80"
        />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ 
            backgroundImage: 'linear-gradient(rgba(14, 165, 233, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.3) 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
        }}></div>

        {/* Focus Vignette (active during processing) */}
        <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${isProcessing ? 'opacity-100' : 'opacity-0'}`}
             style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.8) 80%)' }}>
        </div>

        {/* Dynamic Scanning Reticle */}
        <div className={`relative w-72 h-72 border rounded-xl transition-all duration-300 z-30 ${
            isProcessing 
            ? 'border-white/60 shadow-[0_0_60px_rgba(255,255,255,0.4)] scale-105' 
            : 'border-medical-500/30 shadow-[0_0_50px_rgba(20,184,166,0.15)]'
        }`}>
             {/* Corner Brackets */}
            <div className={`absolute -top-1 -left-1 w-8 h-8 border-l-4 border-t-4 rounded-tl-sm transition-all duration-300 ${isProcessing ? 'border-white shadow-[0_0_20px_white]' : 'border-medical-500 shadow-[0_0_15px_rgba(20,184,166,0.6)] animate-[pulse-glow_2s_ease-in-out_infinite]'}`}></div>
            <div className={`absolute -top-1 -right-1 w-8 h-8 border-r-4 border-t-4 rounded-tr-sm transition-all duration-300 ${isProcessing ? 'border-white shadow-[0_0_20px_white]' : 'border-medical-500 shadow-[0_0_15px_rgba(20,184,166,0.6)] animate-[pulse-glow_2s_ease-in-out_infinite]'}`}></div>
            <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-l-4 border-b-4 rounded-bl-sm transition-all duration-300 ${isProcessing ? 'border-white shadow-[0_0_20px_white]' : 'border-medical-500 shadow-[0_0_15px_rgba(20,184,166,0.6)] animate-[pulse-glow_2s_ease-in-out_infinite]'}`}></div>
            <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-r-4 border-b-4 rounded-br-sm transition-all duration-300 ${isProcessing ? 'border-white shadow-[0_0_20px_white]' : 'border-medical-500 shadow-[0_0_15px_rgba(20,184,166,0.6)] animate-[pulse-glow_2s_ease-in-out_infinite]'}`}></div>
            
            {/* Internal Scanning Animation (Standard) */}
            {!isProcessing && (
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-medical-400 to-transparent shadow-[0_0_20px_rgba(20,184,166,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
            )}

            {/* Processing State Internal Visuals */}
            {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {/* Ripple Effect */}
                    <div className="absolute inset-0 rounded-xl border border-white/30 animate-ping"></div>
                    <div className="w-16 h-16 border-4 border-t-white border-r-white/50 border-b-white/10 border-l-white/50 rounded-full animate-spin"></div>
                </div>
            )}

            {/* Status Label */}
            <div className="absolute -bottom-12 left-0 w-full text-center">
                <span className={`text-xs px-4 py-1.5 rounded-full backdrop-blur-md border shadow-lg font-bold tracking-widest transition-colors duration-300 ${
                    isProcessing 
                    ? 'bg-white text-black border-white animate-pulse' 
                    : 'bg-black/60 text-white border-white/10'
                }`}>
                    {isProcessing ? 'ANALYZING...' : 'ALIGN SUBJECT'}
                </span>
            </div>
        </div>
      </div>

      {/* HUD Footer Controls */}
      <div className="h-32 bg-black/90 backdrop-blur-md flex items-center justify-around px-8 border-t border-white/10 relative z-20">
        <button onClick={toggleCamera} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors group">
             <div className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center group-active:scale-95 transition-transform">
                <i className="fa-solid fa-camera-rotate text-lg"></i>
             </div>
             <span className="text-[10px] tracking-wider font-bold">FLIP</span>
        </button>

        <button
          onClick={capture}
          disabled={isProcessing}
          className={`w-20 h-20 rounded-full p-1.5 border-2 transition-all duration-300 group shadow-[0_0_30px_rgba(255,255,255,0.1)] ${
              isProcessing 
              ? 'border-gray-600 opacity-50 cursor-not-allowed scale-90' 
              : 'border-white/30 hover:border-medical-500 hover:scale-105 hover:shadow-[0_0_30px_rgba(20,184,166,0.4)]'
          }`}
        >
          <div className={`w-full h-full rounded-full flex items-center justify-center transition-all ${isProcessing ? 'bg-gray-700' : 'bg-white group-active:scale-90'}`}>
            {!isProcessing && <div className="w-[90%] h-[90%] rounded-full border-2 border-gray-300"></div>}
          </div>
        </button>

        <div className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors group">
             <div className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center group-active:scale-95 transition-transform">
                <i className="fa-solid fa-bolt text-lg"></i>
             </div>
             <span className="text-[10px] tracking-wider font-bold">FLASH</span>
        </div>
      </div>
      
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg text-center font-bold text-sm shadow-xl border border-red-400 backdrop-blur-md flex items-center gap-2 z-50">
             <i className="fa-solid fa-triangle-exclamation"></i>
            {error}
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px rgba(20,184,166,0.6); }
          50% { opacity: 0.8; transform: scale(1.02); box-shadow: 0 0 25px rgba(20,184,166,0.9); }
        }
        .reverse { animation-direction: reverse; animation-duration: 3s; }
      `}</style>
    </div>
  );
};

export default Scanner;
