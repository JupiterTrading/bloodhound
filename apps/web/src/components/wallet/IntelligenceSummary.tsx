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
    <section className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
          Intelligence Summary
        </h2>
        {data && (
          <ConfidenceBadge confidence={data.confidence as Confidence} />
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
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
        <p className="text-[13px] text-[var(--text-muted)] italic">
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
      <p className="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
        {visible.join("\n")}
      </p>
      {shouldTruncate && (
        <button
          onClick={onToggle}
          className="mt-2 bg-transparent border-none text-[var(--accent)] text-[12px] cursor-pointer p-0 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
