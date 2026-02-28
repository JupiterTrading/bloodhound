import { RelationshipGraph } from "@/components/graph/RelationshipGraph";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return {
    title: `Graph: ${short} — BLOODHOUND`,
    description: `Relationship map for wallet ${address}`,
  };
}

export default async function GraphPage({ params }: Props) {
  const { address } = await params;
  return <RelationshipGraph address={address} />;
}
