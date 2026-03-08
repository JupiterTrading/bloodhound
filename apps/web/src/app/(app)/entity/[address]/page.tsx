import { EntityProfile } from "@/components/entity/EntityProfile";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
  return {
    title: `Entity ${short} — BLOODHOUND`,
    description: `Identity cluster analysis for Solana wallet ${short}`,
  };
}

export default async function EntityPage({ params }: Props) {
  const { address } = await params;
  return <EntityProfile address={address} />;
}
