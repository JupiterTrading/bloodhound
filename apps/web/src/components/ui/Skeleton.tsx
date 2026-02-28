/**
 * Skeleton loading placeholder.
 * Matches layout of loaded state — no spinners.
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  return (
    <span
      style={{
        display: "block",
        width,
        height,
        borderRadius,
        background: "var(--bg-elevated)",
        animation: "skeletonPulse 1.6s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/** Inject the skeleton pulse keyframe once. Use in globals.css ideally. */
export const SKELETON_KEYFRAME = `
@keyframes skeletonPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;
