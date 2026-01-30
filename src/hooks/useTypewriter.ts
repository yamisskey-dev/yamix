import { useState, useEffect, useRef, useCallback } from "react";

export function useTypewriter(text: string, speed = 15) {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const skip = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setDisplayed(text);
    setIsTyping(false);
  }, [text]);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setIsTyping(false);
      return;
    }

    setDisplayed("");
    setIsTyping(true);
    indexRef.current = 0;

    intervalRef.current = setInterval(() => {
      // Advance by 1-3 chars for natural feel
      const step = text[indexRef.current] === "\n" ? 1 : Math.min(2, text.length - indexRef.current);
      indexRef.current += step;
      setDisplayed(text.slice(0, indexRef.current));

      if (indexRef.current >= text.length) {
        clearInterval(intervalRef.current);
        setIsTyping(false);
      }
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  return { displayed, isTyping, skip };
}
