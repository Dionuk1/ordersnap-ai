import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
};

/** Slide-up + fade entry used across pages, tables, cards, and modals. */
export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  function FadeIn({ delay = 0, y = 10, ...props }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
        {...props}
      />
    );
  },
);

/** Page-route entry wrapper — slightly larger travel than FadeIn. */
export function PageFade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

/** Hover/tap scale micro-interaction for cards and action rows. */
export const HoverScale = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function HoverScale(props, ref) {
    return (
      <motion.div
        ref={ref}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        {...props}
      />
    );
  },
);
