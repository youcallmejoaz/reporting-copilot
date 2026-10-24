import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { listProfileIds, loadProfile, parseFrontMatter } from "@arc/core";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ids = listProfileIds();
  if (!ids.includes(id)) notFound();
  const profile = loadProfile(id);
  const { data } = parseFrontMatter(profile.raw);
  const html = await marked.parse(profile.body);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Client knowledge</h1>
          <p className="lede">
            One <span className="mono">profile.md</span> per client: account IDs, naming, targeting decisions, report format and tone. Exposed to Claude as the MCP resource{" "}
            <span className="mono">client://{id}/profile</span>.
          </p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start" }}>
        <div className="card tree" data-testid="knowledge-tree">
          <div className="folder">📁 clients/</div>
          {ids.map((cid) => (
            <div key={cid} style={{ paddingLeft: 14 }}>
              <div className="folder">📁 {cid}/</div>
              <Link href={`/clients/${cid}`} className={cid === id ? "active" : ""} style={{ paddingLeft: 24 }}>
                📄 profile.md
              </Link>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="small muted mono" style={{ marginBottom: 10 }}>
            clients/{id}/profile.md
          </div>
          <div className="fm">
            {Object.entries(data).map(([k, v]) => [<div key={`${k}k`}>{k}</div>, <div key={`${k}v`}>{v.replace(/\\n/g, " / ")}</div>])}
          </div>
          <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </>
  );
}
