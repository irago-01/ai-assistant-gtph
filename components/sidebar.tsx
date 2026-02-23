"use client";

import {
  CalendarCheck2,
  CheckSquare,
  Cog,
  FileText,
  Home,
  MessageSquareText,
  UsersRound,
  Sparkles,
  Wrench
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type NavItem = {
  href: Route;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <Home size={17} /> },
  { href: "/live-demo-planner", label: "Live Demo Planner", icon: <Sparkles size={17} /> },
  { href: "/confluence-answers", label: "Confluence Answers", icon: <FileText size={17} /> },
  { href: "/slack-studio", label: "Slack Studio", icon: <MessageSquareText size={17} /> },
  { href: "/requests-hub", label: "Requests Hub", icon: <CheckSquare size={17} /> },
  { href: "/one-on-one-coaching", label: "1:1 Coaching", icon: <UsersRound size={17} /> },
  { href: "/settings", label: "Settings", icon: <Cog size={17} /> },
  { href: "/setup", label: "Setup Wizard", icon: <Wrench size={17} /> }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <h1>Work OS</h1>
      <div className="subtitle">One-click workflow cockpit</div>

      <nav className="nav-links">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${active ? "active" : ""}`}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="card" style={{ marginTop: 18, padding: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <CalendarCheck2 size={16} />
          <strong>Today in One Button</strong>
        </div>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
          Pull Slack + Outlook + Jira signals and auto-build your task board.
        </p>
      </div>
    </aside>
  );
}
