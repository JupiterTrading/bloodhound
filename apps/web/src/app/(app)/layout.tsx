import type { ReactNode } from "react";
import { Sidebar, MobileNav } from "@/components/layout/Sidebar";
import { BloombergNav } from "@/components/layout/BloombergNav";
import { StatusBar } from "@/components/layout/StatusBar";
import { AlertToastProvider } from "@/components/layout/AlertToastProvider";
import { CommandPaletteProvider } from "@/components/layout/CommandPaletteProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Bloomberg-style top ticker bar */}
      <BloombergNav />
      
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Mobile header */}
      <MobileNav />
      
      {/* Main content area - offset for Bloomberg nav (32px) + mobile header on mobile */}
      <main className="flex-1 lg:ml-[220px] pt-[calc(32px+56px)] lg:pt-[48px] pb-8 min-h-screen transition-all">
        {children}
      </main>
      
      <StatusBar />
      <AlertToastProvider />
      <CommandPaletteProvider />
    </div>
  );
}
