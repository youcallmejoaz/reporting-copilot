import Link from "next/link";
import { listProfileIds, loadProfile } from "@arc/core";
import { AuditRunner } from "@/components/AuditRunner";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const ids = listProfileIds();
  const { client } = await searchParams;
  const selected = ids.includes(client ?? "") ? client! : ids[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account audit</h1>
          <p className="lede">The <span className="mono">account-audit</span> skill’s checks: ROAS under 1, wasted spend, overspend, naming, low CTR and pacing. Red = fix now, amber = check.</p>
        </div>
      </div>
      <div className="tabs">
        {ids.map((id) => (
          <Link key={id} href={`/audit?client=${id}`} className={id === selected ? "active" : ""}>
            {loadProfile(id).settings.name}
          </Link>
        ))}
      </div>
      <AuditRunner key={selected} clientId={selected} clientName={loadProfile(selected).settings.name} />
    </>
  );
}
