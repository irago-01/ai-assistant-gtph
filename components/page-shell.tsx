import { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}
