import { KolProfilePage as KolProfile } from "@/components/kol/KolProfilePage";

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  return {
    title: `@${handle} — BLOODHOUND`,
    description: `KOL profile and trading activity for @${handle}`,
  };
}

export default async function KolProfilePage({ params }: Props) {
  const { handle } = await params;
  return <KolProfile handle={handle} />;
}
