"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const LOADING_GIFS = [1, 2, 3] as const;

interface Props {
  size?: number;
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = 64, text, className = "" }: Props) {
  const [gifId, setGifId] = useState<number>(1);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * LOADING_GIFS.length);
    setGifId(LOADING_GIFS[randomIndex]);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Image
        src={`/static/loading/${gifId}.gif`}
        width={size}
        height={size}
        alt="Loading"
        unoptimized
        priority
      />
      {text && <span className="text-base-content/70">{text}</span>}
    </div>
  );
}
