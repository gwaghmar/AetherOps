import Link from "next/link";

type LogoSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<LogoSize, { box: number; radius: number; svgSize: number }> = {
  sm: { box: 24, radius: 6,  svgSize: 13 },
  md: { box: 40, radius: 9,  svgSize: 22 },
  lg: { box: 56, radius: 12, svgSize: 30 },
  xl: { box: 80, radius: 16, svgSize: 44 },
};

interface LogoProps {
  size?: LogoSize;
  wordmark?: boolean;
  href?: string;
  className?: string;
}

function LogoMark({ size = "md" }: { size: LogoSize }) {
  const { box, radius, svgSize } = sizeMap[size];
  return (
    <span
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        background: "var(--accent)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M22 8L6 36h7.5L22 18l8.5 18H38L22 8z"
          fill="white"
          fillOpacity={0.95}
        />
      </svg>
    </span>
  );
}

export function Logo({ size = "md", wordmark = true, href = "/home", className }: LogoProps) {
  const textSize =
    size === "sm" ? "text-[13px]" :
    size === "lg" ? "text-[18px]" :
    size === "xl" ? "text-[24px]" :
    "text-[15px]";

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      {wordmark && (
        <span
          className={`font-semibold tracking-tight ${textSize}`}
          style={{ letterSpacing: "-0.03em", color: "var(--ink)" }}
        >
          Aether{" "}
          <span style={{ color: "var(--accent)" }}>Ops</span>
        </span>
      )}
    </span>
  );

  return href ? (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  ) : (
    inner
  );
}
