// Admin: attendance analytics across all sessions.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminAnalytics() {
  const [byStatus, setByStatus] = useState({ present: 0, late: 0, absent: 0 });
  const [recentClasses, setRecentClasses] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: records } = await supabase.from("attendance_records").select("status");
      if (records) {
        const present = records.filter((r) => r.status === "present").length;
        const late = records.filter((r) => r.status === "late").length;
        const absent = records.filter((r) => r.status === "absent").length;
        setByStatus({ present, late, absent });
      }

      const { data: cs } = await supabase
        .from("classes")
        .select("*, attendance_sessions(count)")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentClasses(cs ?? []);

      // Fetch sessions to build a small trend chart
      const { data: sessions } = await supabase
        .from("attendance_sessions")
        .select("created_at, attendance_records(count)")
        .order("created_at", { ascending: false })
        .limit(7);
      
      if (sessions) {
        setTrendData(sessions.map(s => ({
          date: new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          count: s.attendance_records?.[0]?.count ?? 0
        })).reverse());
      }
      setLoading(false);
    })();
  }, []);

  const total = byStatus.present + byStatus.late + byStatus.absent || 1;
  const chartData = [
    { name: "Present", value: byStatus.present, color: "#10b981" },
    { name: "Late", value: byStatus.late, color: "#f59e0b" },
    { name: "Absent", value: byStatus.absent, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Real-time attendance insights and distribution metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Donut */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-display font-semibold mb-6 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand" />
            Status Distribution
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {chartData.map((d) => (
              <div key={d.name} className="text-center">
                <div className="text-xs text-muted-foreground uppercase">{d.name}</div>
                <div className="text-lg font-bold" style={{ color: d.color }}>{d.value}</div>
                <div className="text-[10px] text-muted-foreground">{Math.round((d.value / total) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-display font-semibold mb-6 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-brand" />
            Check-in Volume (Last 7 Sessions)
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--brand))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--brand))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--brand))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b font-medium flex items-center gap-2 bg-secondary/20">
          <Calendar className="h-4 w-4" />
          Most Active Classes
        </div>
        <div className="divide-y">
          {recentClasses.map((c) => (
            <div key={c.id} className="p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                  {c.code.substring(0, 2)}
                </div>
                <span>{c.name} <span className="text-muted-foreground text-sm ml-1">({c.code})</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm px-2 py-1 rounded bg-secondary font-medium">
                  {c.attendance_sessions?.[0]?.count ?? 0} sessions
                </span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
