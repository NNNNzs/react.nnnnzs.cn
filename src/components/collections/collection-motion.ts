export const collectionMotion = {
  transition: {
    type: 'spring',
    stiffness: 280,
    damping: 30,
    mass: 0.8,
  },
  expanded: {
    initial: { opacity: 0, x: 22, scale: 0.992 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -14, scale: 0.995 },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
} as const;
