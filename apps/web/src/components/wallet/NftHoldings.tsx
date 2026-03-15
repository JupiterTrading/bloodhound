"use client";

import { useState, useMemo } from "react";
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
  const [showCompressed, setShowCompressed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", "nft-holdings", address],
    queryFn: () => walletApi.nftHoldings(address),
    staleTime: 300_000, // 5 min
  });

  const allNfts = data?.nfts ?? [];
  
  // Separate regular NFTs from compressed NFTs (cNFTs)
  const { regularNfts, compressedNfts } = useMemo(() => {
    const regular: NftHolding[] = [];
    const compressed: NftHolding[] = [];
    for (const nft of allNfts) {
      if (nft.is_compressed) {
        compressed.push(nft);
      } else {
        regular.push(nft);
      }
    }
    return { regularNfts: regular, compressedNfts: compressed };
  }, [allNfts]);

  const nfts = showCompressed ? allNfts : regularNfts;
  const PREVIEW_COUNT = 12;
  const visible = showAll ? nfts : nfts.slice(0, PREVIEW_COUNT);

  if (!isLoading && allNfts.length === 0) return null;

  return (
    <section className="card overflow-hidden mb-4">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
          NFT Holdings
          {nfts.length > 0 && (
            <span className="ml-2 font-normal">({nfts.length})</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {compressedNfts.length > 0 && (
            <button
              onClick={() => setShowCompressed(!showCompressed)}
              className={`border border-[var(--border)] rounded px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-all ${showCompressed ? 'bg-[var(--accent)] text-white' : 'bg-transparent text-[var(--text-muted)]'}`}
            >
              {showCompressed ? "Hide cNFTs" : `Show cNFTs (${compressedNfts.length})`}
            </button>
          )}
          {nfts.length > PREVIEW_COUNT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[11px] text-[var(--accent)] bg-transparent border-none cursor-pointer p-0 hover:underline"
            >
              {showAll ? "Show less" : `Show all ${nfts.length}`}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-px bg-[var(--border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] p-3">
              <Skeleton height={96} borderRadius={6} style={{ marginBottom: 8 }} />
              <Skeleton height={11} width="70%" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-px bg-[var(--border)]">
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
      className="flex flex-col bg-[var(--bg-surface)] p-3 no-underline hover:bg-[var(--bg-elevated)] transition-colors relative"
    >
      {/* cNFT badge */}
      {nft.is_compressed && (
        <div className="absolute top-2 right-2 bg-black/70 text-[#888] text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide z-10">
          cNFT
        </div>
      )}

      {/* Image */}
      <div className="w-full aspect-square rounded-md overflow-hidden bg-[var(--bg-elevated)] mb-2 flex items-center justify-center shrink-0">
        {nft.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-2xl opacity-30">◈</span>
        )}
      </div>

      {/* Name */}
      <div
        className="text-[11px] font-semibold text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap mb-1"
        title={nft.name}
      >
        {nft.name}
      </div>

      {/* Price info */}
      <div className="flex flex-col gap-0.5">
        {nft.is_listed && nft.listing_price_sol != null && (
          <div className="text-[10px] text-[#22c55e] font-mono flex items-center gap-1" title="Listed price">
            <span className="bg-[#22c55e] text-black px-1 py-px rounded text-[8px] font-semibold">LISTED</span>
            ◎ {nft.listing_price_sol.toFixed(2)}
          </div>
        )}
        {nft.floor_price_sol != null && nft.floor_price_sol > 0 && (
          <div className="text-[10px] text-[var(--text-muted)] font-mono" title="Collection floor price">
            Floor: ◎ {nft.floor_price_sol.toFixed(2)}
          </div>
        )}
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
          className="text-[10px] text-[var(--text-muted)] font-mono cursor-pointer hover:text-[var(--text-secondary)]"
          title={nft.collection_address ?? undefined}
        >
          {short}
        </div>
      )}
    </a>
  );
}
