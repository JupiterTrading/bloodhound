import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { BloombergNav } from "@/components/layout/BloombergNav";
import { StatusBar } from "@/components/layout/StatusBar";
import { AlertToastProvider } from "@/components/layout/AlertToastProvider";
import { CommandPaletteProvider } from "@/components/layout/CommandPaletteProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top navigation bar (56px) */}
      <TopNav />
      
      {/* Bloomberg-style ticker bar under top nav (32px) */}
      <BloombergNav />
      
      {/* Main content area — offset for TopNav (56px) + Bloomberg (32px) = 88px */}
      <main className="flex-1 pt-[88px] pb-8 min-h-screen">
        {children}
      </main>
      
      <StatusBar />
      <AlertToastProvider />
      <CommandPaletteProvider />
    </div>
  );
}
