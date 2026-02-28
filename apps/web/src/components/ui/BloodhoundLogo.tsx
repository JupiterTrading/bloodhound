/**
 * Bloodhound head silhouette SVG logo.
 * Left-facing profile. Flat fill, no outline strokes.
 * Red eye as a narrowed crosshair slit.
 */

interface BloodhoundLogoProps {
  size?: number;
  /** Override the main fill (default: --text-primary / white) */
  fillColor?: string;
}

export function BloodhoundLogo({
  size = 28,
  fillColor = "currentColor",
}: BloodhoundLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bloodhound"
    >
      {/* Head + snout — stylized bloodhound silhouette facing left */}
      <path
        d={[
          // Skull curve — top and back
          "M 26 6",
          "C 32 6 37 10 37 16",
          "C 37 20 35 23 32 25",
          // Jowl / lower jaw (droopy bloodhound)
          "C 34 26 35 28 33 30",
          "C 30 32 26 32 24 30",
          // Snout / muzzle tip
          "C 22 32 18 33 16 32",
          "C 13 31 12 29 13 27",
          // Under-chin transition
          "C 11 27 9 26 9 24",
          // Chest / neck connecting to left
          "C 8 22 8 20 9 18",
          // Forehead connecting back to start
          "C 10 10 18 6 26 6",
          "Z",
        ].join(" ")}
        fill={fillColor}
      />

      {/* Long floppy left ear — characteristic bloodhound feature */}
      <path
        d={[
          "M 26 9",
          "C 22 8 17 9 14 12",
          "C 11 15 10 20 11 26",
          "C 12 28 14 29 15 28",
          "C 14 22 15 16 18 13",
          "C 20 10 24 9 26 9",
          "Z",
        ].join(" ")}
        fill={fillColor}
        opacity="0.9"
      />

      {/* Nose — dark triangle at snout tip */}
      <ellipse cx="14" cy="29" rx="2.5" ry="1.8" fill="#1a1010" />

      {/* Eye — narrowed blood red slit / crosshair */}
      {/* Horizontal slit */}
      <rect x="24" y="17.2" width="8" height="2.4" rx="1.2" fill="#b30000" />
      {/* Tiny vertical crosshair tick — optional detail */}
      <rect x="27.6" y="15.5" width="1.8" height="5.8" rx="0.9" fill="#b30000" opacity="0.7" />
    </svg>
  );
}
