import { EventDetail } from "@/components/events/EventDetail";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${title} — BLOODHOUND Events`,
    description: `On-chain intelligence and wallet analysis for the ${title} event.`,
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  return <EventDetail slug={slug} />;
}
