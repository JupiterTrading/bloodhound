"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { walletApi, type IntelligenceSummary as IntelligenceSummaryData } from "@/lib/api";
import { ConfidenceBadge, type Confidence } from "@/components/ui/ConfidenceBadge";
import { Skeleton } from "@/components/ui/Skeleton";

interface Props {
  address: string;
}

export function IntelligenceSummary({ address }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", "intelligence", address],
    queryFn: () => walletApi.intelligence(address),
    staleTime: 300_000, // 5 min
  });

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Intelligence Summary
        </h2>
        {data && (
          <ConfidenceBadge confidence={data.confidence as Confidence} />
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Skeleton height={14} width="95%" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="88%" />
        </div>
      ) : data ? (
        <SummaryContent
          summary={data.summary}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      ) : (
        <p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
          No intelligence data available for this wallet.
        </p>
      )}
    </section>
  );
}

function SummaryContent({
  summary,
  expanded,
  onToggle,
}: {
  summary: string | null | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const LINES_VISIBLE = 3;
  const lines = (summary ?? "").split("\n").filter(Boolean);
  const shouldTruncate = lines.length > LINES_VISIBLE;
  const visible = expanded ? lines : lines.slice(0, LINES_VISIBLE);

  return (
    <div>
      <p
        style={{
          fontSize: "13px",
          lineHeight: 1.65,
          color: "var(--text-primary)",
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {visible.join("\n")}
      </p>
      {shouldTruncate && (
        <button
          onClick={onToggle}
          style={{
            marginTop: "8px",
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontSize: "12px",
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
