import { trpc } from "@/lib/trpc";
import { Loader2, Users, FileText, Palette, Upload, Link2, Activity, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "#6B7280" },
  submitted: { label: "مقدّم", color: "#2563EB" },
  reviewed: { label: "تمت المراجعة", color: "#CA8A04" },
  approved: { label: "معتمد", color: "#16A34A" },
  rejected: { label: "مرفوض", color: "#DC2626" },
};

export default function StatsPanel() {
  const { data: stats, isLoading } = trpc.admin.advancedStats.useQuery();

  if (isLoading || !stats) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  const kpis = [
    { label: "المستخدمين", value: stats.users, icon: Users, color: "#2563EB", bg: "bg-blue-50" },
    { label: "ملفات الإنجاز", value: stats.portfolios, icon: FileText, color: "#059669", bg: "bg-teal-50" },
    { label: "القوالب", value: stats.templates, icon: Palette, color: "#7C3AED", bg: "bg-purple-50" },
    { label: "الملفات المرفوعة", value: stats.files, icon: Upload, color: "#EA580C", bg: "bg-orange-50" },
    { label: "روابط المشاركة", value: stats.shareLinks, icon: Link2, color: "#0891B2", bg: "bg-cyan-50" },
    { label: "العمليات (30 يوم)", value: stats.activities, icon: Activity, color: "#DC2626", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>لوحة الإحصائيات</h2>
        <p className="text-sm text-gray-500 mt-1">نظرة شاملة على أداء المنصة</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="text-2xl font-black text-gray-900">{value}</div>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Portfolio Status Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-600" />توزيع حالات ملفات الإنجاز</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.statusBreakdown || {}).map(([status, cnt]) => {
                const info = STATUS_MAP[status] || { label: status, color: "#6B7280" };
                const total = stats.portfolios || 1;
                const pct = Math.round(((cnt as number) / total) * 100);
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{info.label}</span>
                      <span className="text-xs text-gray-500">{cnt as number} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: info.color }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(stats.statusBreakdown || {}).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" />آخر المستخدمين المسجلين</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats.recentUsers || []).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold">
                      {(u.name || "U").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name || "—"}</p>
                      <p className="text-[10px] text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <Badge className={u.role === "admin" ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600"} variant="secondary">
                    {u.role === "admin" ? "مدير" : "مستخدم"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Portfolios */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" />آخر ملفات الإنجاز</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-right py-2 text-xs text-gray-500 font-medium">المستخدم</th>
                <th className="text-right py-2 text-xs text-gray-500 font-medium">الوظيفة</th>
                <th className="text-right py-2 text-xs text-gray-500 font-medium">الحالة</th>
                <th className="text-right py-2 text-xs text-gray-500 font-medium">الاكتمال</th>
              </tr></thead>
              <tbody>
                {(stats.recentPortfolios || []).map((p: any) => {
                  const si = STATUS_MAP[p.status] || STATUS_MAP.draft;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 text-gray-900 font-medium">{p.userName || "—"}</td>
                      <td className="py-2 text-gray-600">{p.jobTitle}</td>
                      <td className="py-2"><Badge style={{ backgroundColor: si.color + "20", color: si.color }}>{si.label}</Badge></td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.completionPercentage || 0}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{p.completionPercentage || 0}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
