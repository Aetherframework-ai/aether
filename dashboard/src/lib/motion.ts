import type { Transition, Variants } from 'motion/react';

// Check for reduced motion preference
export const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

// Spring configurations
export const springConfig = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 } as Transition,
  snappy: { type: 'spring', stiffness: 400, damping: 25 } as Transition,
  bouncy: { type: 'spring', stiffness: 300, damping: 10 } as Transition,
};

// Duration-based transitions
export const durationConfig = {
  fast: { duration: 0.15 } as Transition,
  normal: { duration: 0.3 } as Transition,
  slow: { duration: 0.5 } as Transition,
};

// Get transition based on reduced motion preference
export function getTransition(config: Transition): Transition {
  if (prefersReducedMotion) {
    return { duration: 0 };
  }
  return config;
}

// Page transition variants
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Stagger children variants
export const staggerContainerVariants: Variants = {
  animate: {
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: getTransition(springConfig.gentle),
  },
};

// Card hover variants
export const cardHoverVariants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: prefersReducedMotion ? 1 : 1.02,
    y: prefersReducedMotion ? 0 : -2,
  },
  tap: {
    scale: prefersReducedMotion ? 1 : 0.98,
  },
};

// Node variants for workflow
export const nodeVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: getTransition(springConfig.snappy),
  },
};

// Pulse animation for running state
export const pulseAnimation = {
  boxShadow: prefersReducedMotion
    ? '0 0 0 0 rgba(59, 130, 246, 0)'
    : [
        '0 0 0 0 rgba(59, 130, 246, 0)',
        '0 0 0 8px rgba(59, 130, 246, 0.2)',
        '0 0 0 0 rgba(59, 130, 246, 0)',
      ],
};

export const pulseTransition: Transition = {
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut',
};

// Theme toggle animation
export const themeToggleVariants: Variants = {
  light: { rotate: 0 },
  dark: { rotate: 180 },
};

// Sidebar item variants
export const sidebarItemVariants: Variants = {
  initial: { opacity: 0, x: -10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: getTransition(springConfig.gentle),
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: getTransition(durationConfig.fast),
  },
};

// Fade in/out variants
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: getTransition(durationConfig.normal),
  },
  exit: {
    opacity: 0,
    transition: getTransition(durationConfig.fast),
  },
};

// Scale fade variants
export const scaleFadeVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: getTransition(springConfig.snappy),
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: getTransition(durationConfig.fast),
  },
};
