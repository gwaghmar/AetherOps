"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const SparklesText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  return (
    <div className={cn("relative inline-block", className)}>
      <motion.span
        className="relative z-10"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {text}
      </motion.span>
      <motion.div
        className="absolute -inset-1 rounded-lg bg-[--yc-orange] opacity-20 blur-md z-0"
        initial={{ scale: 0.9 }}
        animate={{ scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
};
