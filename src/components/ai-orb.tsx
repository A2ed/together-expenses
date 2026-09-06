import { useReducedMotion } from "motion/react";
import { ThinkingOrb } from "thinking-orbs";
import type { OrbState } from "thinking-orbs";

export function AiOrb({
  size = 20,
  state = "working",
}: {
  size?: 20 | 64;
  state?: OrbState;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme="dark"
      paused={!!reducedMotion}
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "middle" }}
    />
  );
}
