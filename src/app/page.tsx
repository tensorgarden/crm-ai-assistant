import { demoLeads, demoSalesReps, demoFollowUps, demoActivities, demoPipelineStages, demoAnalytics } from "@/lib/demo-data";
import type { Lead, FollowUp, SalesRep } from "@/lib/types";

// --- Reusable components ---

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" | "purple" }) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-white text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-indigo-200 bg-indigo-50 text-indigo-700",
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur ${className}`}>{children}</section>;
}

function ProgressBar({ value, color = "indigo" }: { value: number; color?: string }) {
  const colors: Record<string, string> = { indigo: "bg-indigo-600", emerald: "bg-emerald-600", amber: "bg-amber-500", red: "bg-red-500" };
  return <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${colors[color] || colors.indigo}`} style={{ width: `${value}%` }} /></div>;
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = { won: "bg-emerald-400", lost: "bg-red-400", proposal: "bg-indigo-400", qualified: "bg-blue-400", contacted: "bg-amber-400", new: "bg-slate-400" };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[status] || "bg-slate-400"}`} />;
}

function formatCurrency(n: number): string { return `$${(n / 1000).toFixed(0)}K`; }

function findRep(id: string): SalesRep | undefined { return demoSalesReps.find(r => r.id === id); }

// --- Stat cards ---

function StatCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: string }) {
  const borders: Record<string, string> = { slate: "border-l-slate-300", green: "border-l-emerald-300", amber: "border-l-amber-300", red: "border-l-red-300", blue: "border-l-blue-300" };
  return (
    <div className={`rounded-2xl bg-white/90 p-5 shadow-sm border-l-4 ${borders[tone] || borders.slate}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

// --- Lead table ---

function LeadRow({ lead }: { lead: Lead }) {
  const rep = findRep(lead.ownerId);
  const scoreColor = lead.aiScore >= 85 ? "text-emerald-600" : lead.aiScore >= 70 ? "text-amber-600" : "text-red-600";
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2"><StatusDot status={lead.status} /><span className="font-semibold text-slate-900">{lead.fullName}</span></div>
        <div className="text-xs text-slate-500 ml-6">{lead.company} · {lead.title}</div>
      </td>
      <td className="py-3 px-4"><Badge tone={lead.status === "won" ? "green" : lead.status === "lost" ? "red" : lead.status === "proposal" ? "purple" : lead.status === "qualified" ? "blue" : "amber"}>{lead.status}</Badge></td>
      <td className="py-3 px-4"><span className={`font-bold ${scoreColor}`}>{lead.aiScore}</span><span className="text-slate-400">/100</span></td>
      <td className="py-3 px-4 font-semibold text-slate-800">{formatCurrency(lead.dealValue)}</td>
      <td className="py-3 px-4 text-sm text-slate-600">{rep?.fullName || "—"}</td>
      <td className="py-3 px-4">{lead.aiRiskFlags.length > 0 ? lead.aiRiskFlags.map(f => <Badge key={f} tone="red">{f}</Badge>) : <Badge tone="green">clear</Badge>}</td>
    </tr>
  );
}

function LeadTable() {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">AI-Scored Lead Queue</h2>
        <span className="text-xs text-slate-500">{demoLeads.length} leads</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b-2 border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500"><th className="py-2 px-4">Lead</th><th className="py-2 px-4">Status</th><th className="py-2 px-4">AI Score</th><th className="py-2 px-4">Value</th><th className="py-2 px-4">Owner</th><th className="py-2 px-4">Risk Flags</th></tr></thead>
          <tbody>{[...demoLeads].sort((a, b) => b.aiScore - a.aiScore).map(l => <LeadRow key={l.id} lead={l} />)}</tbody>
        </table>
      </div>
    </Card>
  );
}

// --- Pipeline ---

function PipelineStageBar({ stage }: { stage: { name: string; dealCount: number; totalValue: number; order: number } }) {
  const maxValue = Math.max(...demoPipelineStages.map(s => s.totalValue));
  const pct = (stage.totalValue / maxValue) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{stage.name}</span><span className="text-slate-500">{stage.dealCount} deals</span></div>
      <ProgressBar value={pct} />
      <div className="text-xs text-slate-400">{formatCurrency(stage.totalValue)}</div>
    </div>
  );
}

function PipelineView() {
  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Pipeline by Stage</h2>
      <div className="space-y-5">{demoPipelineStages.map(s => <PipelineStageBar key={s.name} stage={s} />)}</div>
      <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">Total pipeline: <span className="font-bold text-slate-800">{formatCurrency(demoAnalytics.pipelineValue)}</span> · Win rate: <span className="font-bold text-emerald-600">{demoAnalytics.winRate}%</span></div>
    </Card>
  );
}

// --- Follow-ups ---

function FollowUpCard({ fu, lead }: { fu: FollowUp; lead?: Lead }) {
  const typeIcon: Record<string, string> = { call: "📞", email: "✉️", meeting: "📅", demo: "🖥️", proposal_send: "📄" };
  const priorityColor = fu.priority === "high" ? "border-l-red-400" : fu.priority === "medium" ? "border-l-amber-400" : "border-l-slate-300";
  return (
    <div className={`rounded-xl border bg-white/80 p-4 border-l-4 ${priorityColor} ${fu.completed ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <span>{typeIcon[fu.type] || "📌"}</span>
        <span className="font-semibold text-sm text-slate-900">{fu.title}</span>
        {fu.completed && <Badge tone="green">done</Badge>}
        {!fu.completed && fu.priority === "high" && <Badge tone="red">urgent</Badge>}
      </div>
      <p className="text-xs text-slate-500 mb-1">{fu.notes}</p>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{lead?.fullName || fu.leadId}</span>
        <span>{new Date(fu.scheduledFor).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}

function FollowUpSection() {
  const pending = demoFollowUps.filter(f => !f.completed);
  const overdue = pending.filter(f => new Date(f.scheduledFor) < new Date());
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Follow-ups</h2>
        <div className="flex gap-2">
          <Badge tone="red">{overdue.length} overdue</Badge>
          <Badge tone="blue">{pending.length} pending</Badge>
        </div>
      </div>
      <div className="space-y-3">
        {demoFollowUps.map(fu => <FollowUpCard key={fu.id} fu={fu} lead={demoLeads.find(l => l.id === fu.leadId)} />)}
      </div>
    </Card>
  );
}

// --- Activity feed ---

function ActivityFeed() {
  const outcomeIcon: Record<string, string> = { positive: "✅", neutral: "➖", negative: "❌" };
  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
      <div className="space-y-4">
        {demoActivities.map(a => {
          const lead = demoLeads.find(l => l.id === a.leadId);
          return (
            <div key={a.id} className="flex gap-3 items-start">
              <span className="text-lg mt-0.5">{outcomeIcon[a.outcome] || "•"}</span>
              <div className="flex-1">
                <div className="flex justify-between"><span className="font-semibold text-sm text-slate-900">{lead?.fullName || a.leadId}</span><span className="text-xs text-slate-400">{new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
                <p className="text-sm text-slate-600 mt-0.5">{a.summary}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// --- Sales rep performance ---

function RepCard({ rep }: { rep: SalesRep }) {
  const attainmentColor = rep.quotaAttainment >= 100 ? "text-emerald-600" : rep.quotaAttainment >= 80 ? "text-amber-600" : "text-red-600";
  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-sm border border-slate-100">
      <div className="font-bold text-slate-900">{rep.fullName}</div>
      <div className="text-xs text-slate-500 mb-3">{rep.role}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><div className={`text-lg font-bold ${attainmentColor}`}>{rep.quotaAttainment}%</div><div className="text-xs text-slate-400">quota</div></div>
        <div><div className="text-lg font-bold text-slate-800">{rep.dealsWon}</div><div className="text-xs text-slate-400">won</div></div>
        <div><div className="text-lg font-bold text-slate-800">{formatCurrency(rep.pipelineValue)}</div><div className="text-xs text-slate-400">pipeline</div></div>
      </div>
    </div>
  );
}

function TeamPerformance() {
  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Team Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {demoSalesReps.map(rep => <RepCard key={rep.id} rep={rep} />)}
      </div>
    </Card>
  );
}

// --- Main page ---

export default function Home() {
  const overdue = demoFollowUps.filter(f => !f.completed && new Date(f.scheduledFor) < new Date()).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 px-6 py-8 font-sans text-slate-900 antialiased">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">CRM AI Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">Lead scoring · automated follow-ups · pipeline analytics · demo dashboard</p>
      </header>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Pipeline Value" value={formatCurrency(demoAnalytics.pipelineValue)} tone="blue" />
        <StatCard label="Qualified Leads" value={String(demoAnalytics.qualifiedLeads)} tone="green" />
        <StatCard label="Win Rate" value={`${demoAnalytics.winRate}%`} tone="green" />
        <StatCard label="Avg Deal" value={formatCurrency(demoAnalytics.avgDealSize)} tone="slate" />
        <StatCard label="Overdue Tasks" value={String(overdue)} tone="red" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <LeadTable />
          <TeamPerformance />
        </div>
        <div className="space-y-6">
          <PipelineView />
          <FollowUpSection />
          <ActivityFeed />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-slate-400">
        CRM AI Assistant · Portfolio demonstration · All data is fictional · No production keys or network calls
      </footer>
    </div>
  );
}
