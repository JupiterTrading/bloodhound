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
    <div className="card p-4">
      {/* Profile header */}
      <div className="flex items-start gap-2.5 mb-3">
        <ProfileImage url={tw.profile_image_url} name={tw.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">
              {tw.name}
            </span>
            <a
              href={`https://x.com/${tw.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--text-muted)] no-underline shrink-0 hover:text-[var(--text-secondary)]"
            >
              𝕏 @{tw.handle}
            </a>
          </div>
          <div className="flex gap-3 mt-1">
            <Metric label="Followers" value={formatCount(tw.followers)} />
            <Metric label="Tweets" value={formatCount(tw.tweet_count)} />
          </div>
        </div>
      </div>

      {/* Bio */}
      {tw.bio && (
        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3 line-clamp-2">
          {tw.bio}
        </p>
      )}

      {/* Recent tweets */}
      {tw.recent_tweets.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--text-muted)] tracking-wide uppercase mb-2">
            Recent Posts
          </div>
          <div className="flex flex-col gap-2">
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
        className="rounded-full shrink-0 object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[var(--border)] flex items-center justify-center text-[14px] font-semibold text-[var(--text-muted)] shrink-0">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{value}</span>
      <span className="text-[11px] text-[var(--text-muted)] ml-1">{label}</span>
    </div>
  );
}

function TweetRow({ tweet }: { tweet: Tweet }) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 px-2.5 bg-[var(--bg-elevated)] rounded-md no-underline border border-transparent hover:border-[var(--border)] transition-colors"
    >
      <p className="text-[12px] text-[var(--text-secondary)] leading-snug mb-1 line-clamp-2">
        {tweet.text}
      </p>
      <div className="flex gap-2.5 items-center">
        <span className="text-[10px] text-[var(--text-muted)]">
          {formatRelative(tweet.created_at)}
        </span>
        {tweet.likes > 0 && (
          <span className="text-[10px] text-[var(--text-muted)]">
            ♥ {formatCount(tweet.likes)}
          </span>
        )}
        {tweet.retweets > 0 && (
          <span className="text-[10px] text-[var(--text-muted)]">
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
