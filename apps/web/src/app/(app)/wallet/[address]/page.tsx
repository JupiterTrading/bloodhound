import { WalletProfile } from "@/components/wallet/WalletProfile";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
  return {
    title: `${short} — BLOODHOUND`,
    description: `On-chain intelligence for Solana wallet ${short}`,
  };
}

export default async function WalletPage({ params }: Props) {
  const { address } = await params;
  return <WalletProfile address={address} />;
}
