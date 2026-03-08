"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { walletApi, type Counterparty } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { Skeleton } from "@/components/ui/Skeleton";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCenter: boolean;
  volume: number;
  interactions: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

interface Props {
  address: string;
}

function downloadCSV(address: string, counterparties: Counterparty[]) {
  const header = "counterparty,interaction_count,total_volume_usd,last_interaction";
  const rows = counterparties.map(
    (c) =>
      `${c.counterparty},${c.interaction_count},${c.total_volume_usd},${c.last_interaction}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bh-graph-${address.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadSVG(address: string) {
  const svg = document.getElementById("bh-graph-svg");
  if (!svg) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bh-graph-${address.slice(0, 8)}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelationshipGraph({ address }: Props) {
  const [mode, setMode] = useState<"graph" | "table">("graph");

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["wallet", "summary", address],
    queryFn: () => walletApi.summary(address),
    staleTime: 60_000,
  });

  const { data: relationships, isLoading: relLoading } = useQuery({
    queryKey: ["wallet", "relationships", address],
    queryFn: () => walletApi.relationships(address),
    staleTime: 60_000,
  });

  const isLoading = summaryLoading || relLoading;
  const counterparties = relationships?.counterparties ?? [];
  const displayName = summary?.known_wallet?.label ?? `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 88px)" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {isLoading ? "Loading..." : displayName}
            </h1>
            <AddressTag address={address} chars={6} size={12} />
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {counterparties.length} counterparties · Relationship map
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {(["graph", "table"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: mode === m ? 600 : 400,
                background: mode === m ? "var(--accent)" : "var(--bg-base)",
                border: `1px solid ${mode === m ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "5px",
                color: mode === m ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 80ms",
                textTransform: "capitalize",
              }}
            >
              {m === "graph" ? "Graph View" : "Table View"}
            </button>
          ))}
          {!isLoading && counterparties.length > 0 && (
            <>
              <button
                onClick={() => downloadCSV(address, counterparties)}
                title="Download counterparties as CSV"
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "5px",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "border-color 80ms",
                  whiteSpace: "nowrap",
                }}
              >
                ↓ CSV
              </button>
              {mode === "graph" && (
                <button
                  onClick={() => downloadSVG(address)}
                  title="Download graph as SVG"
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "border-color 80ms",
                    whiteSpace: "nowrap",
                  }}
                >
                  ↓ SVG
                </button>
              )}
            </>
          )}
          <Link
            href={`/wallet/${address}`}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "5px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              transition: "border-color 80ms",
              whiteSpace: "nowrap",
            }}
          >
            ← Wallet
          </Link>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <GraphSkeleton />
      ) : counterparties.length === 0 ? (
        <EmptyGraph address={address} />
      ) : mode === "graph" ? (
        <ForceGraph
          centerAddress={address}
          centerLabel={displayName}
          counterparties={counterparties}
        />
      ) : (
        <RelationshipTable counterparties={counterparties} />
      )}
    </div>
  );
}

// ── Force-directed SVG graph ──────────────────────────────────────────────────

function ForceGraph({
  centerAddress,
  centerLabel,
  counterparties,
}: {
  centerAddress: string;
  centerLabel: string;
  counterparties: Counterparty[];
}) {
  const canvasRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const animRef = useRef<number | null>(null);
  const nodesRef = useRef<Node[]>([]);

  // Measure container
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Build graph data
  useEffect(() => {
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const top = counterparties.slice(0, 20);
    const maxVol = Math.max(...top.map((c) => c.total_volume_usd), 1);

    // Arrange spokes evenly
    const spokenodes: Node[] = top.map((cp, i) => {
      const angle = (2 * Math.PI * i) / top.length - Math.PI / 2;
      const r = Math.min(dims.w, dims.h) * 0.32;
      return {
        id: cp.counterparty,
        label: `${cp.counterparty.slice(0, 4)}...${cp.counterparty.slice(-3)}`,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: 0,
        vy: 0,
        isCenter: false,
        volume: cp.total_volume_usd / maxVol,
        interactions: cp.interaction_count,
      };
    });

    const centerNode: Node = {
      id: centerAddress,
      label: centerLabel.length > 12 ? `${centerLabel.slice(0, 10)}...` : centerLabel,
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      isCenter: true,
      volume: 1,
      interactions: 0,
    };

    const newNodes = [centerNode, ...spokenodes];
    const newEdges: Edge[] = spokenodes.map((n) => ({
      source: centerAddress,
      target: n.id,
      weight: n.volume,
    }));

    nodesRef.current = newNodes;
    setNodes(newNodes);
    setEdges(newEdges);
  }, [counterparties, centerAddress, centerLabel, dims]);

  const getNode = useCallback((id: string) => nodes.find((n) => n.id === id), [nodes]);
  const selectedNode = selected ? getNode(selected) : null;
  const selectedCp = selected ? counterparties.find((c) => c.counterparty === selected) : null;

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <svg
        id="bh-graph-svg"
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        onClick={() => setSelected(null)}
      >
        <defs>
          <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Edges */}
        {edges.map((e) => {
          const src = nodes.find((n) => n.id === e.source);
          const tgt = nodes.find((n) => n.id === e.target);
          if (!src || !tgt) return null;
          const isSelected = selected === e.target;
          return (
            <line
              key={`${e.source}-${e.target}`}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke={isSelected ? "var(--accent)" : "var(--border)"}
              strokeWidth={isSelected ? 1.5 : Math.max(0.5, e.weight * 2)}
              strokeOpacity={isSelected ? 0.8 : 0.4}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const r = node.isCenter ? 28 : Math.max(10, 8 + node.volume * 14);
          const isSelected = selected === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              style={{ cursor: node.isCenter ? "default" : "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                if (!node.isCenter) setSelected(node.id === selected ? null : node.id);
              }}
            >
              {/* Glow ring */}
              {(node.isCenter || isSelected) && (
                <circle
                  r={r + 6}
                  fill={node.isCenter ? "url(#centerGrad)" : "var(--accent)"}
                  fillOpacity={0.12}
                />
              )}
              {/* Main circle */}
              <circle
                r={r}
                fill={node.isCenter ? "var(--accent)" : isSelected ? "var(--bg-elevated)" : "var(--bg-surface)"}
                stroke={node.isCenter ? "var(--accent)" : isSelected ? "var(--accent)" : "var(--border)"}
                strokeWidth={isSelected ? 1.5 : 1}
              />
              {/* Label */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={node.isCenter ? 11 : 9}
                fontWeight={node.isCenter ? 700 : 400}
                fill={node.isCenter ? "#fff" : "var(--text-secondary)"}
                fontFamily="JetBrains Mono, monospace"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selection panel */}
      {selectedNode && selectedCp && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-surface)",
            border: "1px solid var(--accent)",
            borderRadius: "8px",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: "13px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Counterparty</div>
            <AddressTag address={selectedNode.id} chars={8} size={13} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Interactions</div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "var(--text-primary)" }}>
              {selectedCp.interaction_count.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Volume</div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "var(--text-primary)" }}>
              ${selectedCp.total_volume_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <Link
            href={`/wallet/${selectedNode.id}`}
            style={{
              padding: "6px 14px",
              background: "var(--accent)",
              borderRadius: "5px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View Wallet →
          </Link>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "16px",
          fontSize: "11px",
          color: "var(--text-muted)",
          lineHeight: 1.8,
        }}
      >
        <div>● Node size = transfer volume</div>
        <div>— Edge weight = interaction count</div>
        <div>Click node to inspect</div>
      </div>
    </div>
  );
}

// ── Table fallback ────────────────────────────────────────────────────────────

function RelationshipTable({ counterparties }: { counterparties: Counterparty[] }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Counterparty</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>Interactions</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>Volume (USD)</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Last Seen</th>
              <th style={{ padding: "10px 16px" }}></th>
            </tr>
          </thead>
          <tbody>
            {counterparties.map((cp) => (
              <tr
                key={cp.counterparty}
                style={{ borderBottom: "1px solid var(--border)", transition: "background 60ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "10px 16px" }}>
                  <AddressTag address={cp.counterparty} chars={8} size={13} />
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)" }}>
                  {cp.interaction_count.toLocaleString()}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)" }}>
                  ${cp.total_volume_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
                  {formatAgo(cp.last_interaction)}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <Link
                    href={`/wallet/${cp.counterparty}`}
                    style={{ fontSize: "11px", color: "var(--accent)", textDecoration: "none" }}
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Loading / empty states ────────────────────────────────────────────────────

function GraphSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <Skeleton width={200} height={14} style={{ marginBottom: 12 }} />
        <Skeleton width={140} height={11} />
      </div>
    </div>
  );
}

function EmptyGraph({ address }: { address: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
          No relationships found.
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
          This wallet has no indexed counterparty data yet.
        </p>
        <Link href={`/wallet/${address}`} style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}>
          ← Back to wallet
        </Link>
      </div>
    </div>
  );
}
