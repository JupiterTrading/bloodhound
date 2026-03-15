/**
 * Skeleton loading placeholder.
 * Matches layout of loaded state — no spinners.
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 6,
  style,
  className = "",
}: SkeletonProps) {
  return (
    <span
      className={`block relative overflow-hidden ${className}`}
      style={{ 
        width, 
        height, 
        borderRadius,
        background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-hover))",
        ...style 
      }}
    >
      <span 
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(233,48,208,0.08), rgba(0,212,255,0.05), transparent)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s ease-in-out infinite",
        }}
      />
    </span>
  );
}

/** Inject the skeleton pulse keyframe once. Use in globals.css ideally. */
export const SKELETON_KEYFRAME = `
@keyframes skeletonPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;
