"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const AnimatedGridPattern = ({
  className,
}: {
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "absolute inset-0 z-0 h-full w-full overflow-hidden opacity-20 pointer-events-none",
        className
      )}
    >
      <motion.div
        className="absolute inset-[-100%] h-[300%] w-[300%]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        animate={{
          x: [0, -40],
          y: [0, -40],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "linear",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white" />
    </div>
  );
};
