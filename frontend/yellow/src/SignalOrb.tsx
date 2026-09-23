import { motion } from "framer-motion";

/** A lightweight CSS-accelerated signal that stays responsive on phones. */
export function SignalOrb() {
  return (
    <motion.div
      aria-hidden="true"
      className="signal-orb"
      animate={{ scale: [1, 1.08, 1], rotate: [0, 180, 360] }}
      transition={{ duration: 5.5, ease: "linear", repeat: Infinity }}
    />
  );
}
