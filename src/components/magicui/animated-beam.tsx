"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const AnimatedBeam = ({
  className,
  delay = 0,
  duration = 2,
}: {
  className?: string;
  delay?: number;
  duration?: number;
}) => {
  return (
    <div className={cn("relative w-full h-full min-h-[100px] flex items-center justify-between", className)}>
      <svg className="absolute w-full h-full" style={{ left: 0, top: 0 }}>
        <line
          x1="0%"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="var(--color-foreground)"
          strokeOpacity={0.1}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <motion.line
          x1="0%"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="var(--color-yc-orange)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ strokeDasharray: "0 100", strokeDashoffset: 100 }}
          animate={{ strokeDasharray: "100 100", strokeDashoffset: -100 }}
          transition={{
            duration,
            repeat: Infinity,
            ease: "linear",
            delay,
          }}
        />
      </svg>
    </div>
  );
};
