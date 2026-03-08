"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { walletApi, type NftHolding } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

interface Props {
  address: string;
}

const MAGIC_EDEN_NFT = (mint: string) =>
  `https://magiceden.io/item-details/${mint}`;
const MAGIC_EDEN_COLLECTION = (collectionAddress: string) =>
  `https://magiceden.io/marketplace/${collectionAddress}`;

export function NftHoldings({ address }: Props) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", "nft-holdings", address],
    queryFn: () => walletApi.nftHoldings(address),
    staleTime: 300_000, // 5 min
  });

  const nfts = data?.nfts ?? [];
  const PREVIEW_COUNT = 12;
  const visible = showAll ? nfts : nfts.slice(0, PREVIEW_COUNT);

  if (!isLoading && nfts.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          NFT Holdings
          {nfts.length > 0 && (
            <span style={{ marginLeft: "8px", fontWeight: 400 }}>
              ({nfts.length})
            </span>
          )}
        </h2>
        {nfts.length > PREVIEW_COUNT && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              fontSize: "11px",
              color: "var(--accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            {showAll ? "Show less" : `Show all ${nfts.length}`}
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "1px",
            background: "var(--border)",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ background: "var(--bg-surface)", padding: "12px" }}
            >
              <Skeleton
                height={96}
                borderRadius={6}
                style={{ marginBottom: 8 }}
              />
              <Skeleton height={11} width="70%" />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "1px",
            background: "var(--border)",
          }}
        >
          {visible.map((nft) => (
            <NftCard key={nft.mint} nft={nft} />
          ))}
        </div>
      )}
    </section>
  );
}

function NftCard({ nft }: { nft: NftHolding }) {
  const [imgError, setImgError] = useState(false);
  const short = nft.collection_address
    ? `${nft.collection_address.slice(0, 4)}…${nft.collection_address.slice(-4)}`
    : null;

  return (
    <a
      href={MAGIC_EDEN_NFT(nft.mint)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        padding: "12px",
        textDecoration: "none",
        transition: "background 80ms",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background =
          "var(--bg-elevated)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background =
          "var(--bg-surface)")
      }
    >
      {/* Image */}
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          borderRadius: "6px",
          overflow: "hidden",
          background: "var(--bg-elevated)",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {nft.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nft.image}
            alt={nft.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: "24px", opacity: 0.3 }}>◈</span>
        )}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "3px",
        }}
        title={nft.name}
      >
        {nft.name}
      </div>

      {/* Collection */}
      {short && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(
              MAGIC_EDEN_COLLECTION(nft.collection_address!),
              "_blank",
              "noopener,noreferrer"
            );
          }}
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            fontFamily: "JetBrains Mono, monospace",
            cursor: "pointer",
          }}
          title={nft.collection_address ?? undefined}
        >
          {short}
        </div>
      )}
    </a>
  );
}
