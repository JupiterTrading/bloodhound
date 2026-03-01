import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { StatusBar } from "@/components/layout/StatusBar";
import { AlertToastProvider } from "@/components/layout/AlertToastProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav />
      <main style={{ flex: 1, paddingTop: "56px", paddingBottom: "32px" }}>
        {children}
      </main>
      <StatusBar />
      <AlertToastProvider />
    </div>
  );
}
