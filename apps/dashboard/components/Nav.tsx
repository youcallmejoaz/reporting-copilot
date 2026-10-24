"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Weekly reports" },
  { href: "/ask", label: "Ask" },
  { href: "/clients", label: "Client knowledge" },
  { href: "/audit", label: "Account audit" },
  { href: "/drafts", label: "Draft approvals" },
  { href: "/log", label: "Audit log" },
];

export function Nav({ pendingDrafts }: { pendingDrafts: number }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/runs") : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""}>
            {l.label}
            {l.href === "/drafts" && pendingDrafts > 0 ? <span className="count">{pendingDrafts}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
