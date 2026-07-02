'use client';

import { useEffect, useState } from 'react';

export default function TypewriterText({ text = '', speed = 20 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);

    let count = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        if (prev.length < text.length) {
          return prev + text.charAt(prev.length);
        }
        return prev;
      });

      count++;
      if (count >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayedText}
      {isTyping && <span className="typing-cursor">▋</span>}
    </span>
  );
}
