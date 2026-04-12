'use client';

import { animate } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  formatter: (value: number) => ReactNode;
}

export function AnimatedNumber({ value, formatter }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.85,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
    });

    return () => {
      controls.stop();
    };
  }, [value]);

  return <>{formatter(display)}</>;
}
