"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/cn";

export default function HeroPreviewMotion({ children, className }) {
  const previewRef = useRef(null);
  const isInView = useInView(previewRef, { amount: 0.3 });
  const reduceMotion = useReducedMotion();
  const isActive = reduceMotion || isInView;

  return (
    <motion.div
      ref={previewRef}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
      className={cn("relative", className)}
      data-preview-active={isActive ? "true" : "false"}
      aria-label="Gigaprowl product preview"
    >
      {children}
    </motion.div>
  );
}
