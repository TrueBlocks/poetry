import { useRef, useCallback } from "react";

export function useAudioPlayer() {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
  }, []);

  return {
    currentAudioRef,
    stopAudio,
  };
}
