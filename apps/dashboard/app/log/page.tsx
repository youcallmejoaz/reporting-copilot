import { listAuditLog } from "@arc/core";
import { AuditLogLive } from "@/components/AuditLogLive";

export const dynamic = "force-dynamic";

export default function LogPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="lede">Every MCP tool call, report run and approval decision: who, what, when and the result.</p>
        </div>
      </div>
      <AuditLogLive initial={listAuditLog({ limit: 200 })} />
    </>
  );
}
