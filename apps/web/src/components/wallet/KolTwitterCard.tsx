"use client";

import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api";

interface Tweet {
  tweet_id: string;
  text: string;
  created_at: string;
  url: string;
  likes: number;
  retweets: number;
  replies: number;
}

interface TwitterProfile {
  user_id: string;
  name: string;
  handle: string;
  bio: string | null;
  followers: number;
  following: number;
  tweet_count: number;
  profile_image_url: string;
  recent_tweets: Tweet[];
}

interface Props {
  address: string;
}

export function KolTwitterCard({ address }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["wallet", "twitter", address],
    queryFn: () => walletApi.twitter(address),
    staleTime: 15 * 60_000, // 15 min
  });

  if (isLoading) return <KolTwitterSkeleton />;
  if (!data?.twitter) return null;

  const tw = data.twitter as TwitterProfile;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
        <ProfileImage url={tw.profile_image_url} name={tw.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {tw.name}
            </span>
            <a
              href={`https://x.com/${tw.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              𝕏 @{tw.handle}
            </a>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <Metric label="Followers" value={formatCount(tw.followers)} />
            <Metric label="Tweets" value={formatCount(tw.tweet_count)} />
          </div>
        </div>
      </div>

      {/* Bio */}
      {tw.bio && (
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            marginBottom: "12px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {tw.bio}
        </p>
      )}

      {/* Recent tweets */}
      {tw.recent_tweets.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Recent Posts
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {tw.recent_tweets.slice(0, 3).map((tweet) => (
              <TweetRow key={tweet.tweet_id} tweet={tweet} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileImage({ url, name }: { url: string; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        width={36}
        height={36}
        style={{ borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--text-muted)",
        flexShrink: 0,
      }}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "3px" }}>{label}</span>
    </div>
  );
}

function TweetRow({ tweet }: { tweet: Tweet }) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        padding: "8px 10px",
        background: "var(--bg-elevated)",
        borderRadius: "6px",
        textDecoration: "none",
        border: "1px solid transparent",
        transition: "border-color 0.1s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "transparent")}
    >
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          lineHeight: 1.45,
          marginBottom: "5px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {tweet.text}
      </p>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {formatRelative(tweet.created_at)}
        </span>
        {tweet.likes > 0 && (
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            ♥ {formatCount(tweet.likes)}
          </span>
        )}
        {tweet.retweets > 0 && (
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            ↺ {formatCount(tweet.retweets)}
          </span>
        )}
      </div>
    </a>
  );
}

function KolTwitterSkeleton() {
  // Render nothing while loading — avoids layout shift for non-KOL wallets
  return null;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
