/**
 * Audio Service
 * Programmatic audio cues for UX feedback using Web Audio API.
 */

const playTone = (freq: number, duration: number, volume: number = 0.1) => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);

        // Clean up context after playing
        setTimeout(() => {
            audioCtx.close();
        }, (duration + 0.1) * 1000);
    } catch (e) {
        console.error('Audio cue failed:', e);
    }
};

export const playStartCue = () => {
    playTone(523.25, 0.15, 0.05); // C5 note - crisp start
};

export const playStopCue = () => {
    playTone(392.00, 0.2, 0.05); // G4 note - mellow stop
};

export const playSuccessCue = () => {
    // Soft double beep
    playTone(659.25, 0.1, 0.05); // E5
    setTimeout(() => playTone(880.00, 0.1, 0.05), 100); // A5
};
