import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Clock, Filter, User, FileText, Palette, Settings, Upload, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  create: { label: "إنشاء", color: "#16A34A" },
  update: { label: "تعديل", color: "#2563EB" },
  delete: { label: "حذف", color: "#DC2626" },
  login: { label: "تسجيل دخول", color: "#7C3AED" },
  review: { label: "مراجعة", color: "#CA8A04" },
  export: { label: "تصدير", color: "#0891B2" },
};

const ENTITY_MAP: Record<string, { label: string; icon: any }> = {
  user: { label: "مستخدم", icon: User },
  portfolio: { label: "ملف إنجاز", icon: FileText },
  template: { label: "قالب", icon: Palette },
  theme: { label: "ثيم", icon: Settings },
  file: { label: "ملف", icon: Upload },
  share: { label: "مشاركة", icon: Link2 },
};

export default function ActivityPanel() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [entityFilter, setEntityFilter] = useState<string | undefined>();

  const { data, isLoading } = trpc.admin.activityLogs.useQuery({ page, limit: 30, action: actionFilter, entity: entityFilter });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>سجل العمليات</h2>
        <p className="text-sm text-gray-500 mt-1">متابعة جميع العمليات التي تحدث في المنصة</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500"><Filter className="w-3.5 h-3.5" />العملية:</div>
        <Button variant={!actionFilter ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setActionFilter(undefined)}>الكل</Button>
        {Object.entries(ACTION_MAP).map(([key, val]) => (
          <Button key={key} variant={actionFilter === key ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setActionFilter(key)}>{val.label}</Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500"><Filter className="w-3.5 h-3.5" />الكيان:</div>
        <Button variant={!entityFilter ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setEntityFilter(undefined)}>الكل</Button>
        {Object.entries(ENTITY_MAP).map(([key, val]) => (
          <Button key={key} variant={entityFilter === key ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setEntityFilter(key)}>{val.label}</Button>
        ))}
      </div>

      {/* Activity list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
      ) : !data?.items?.length ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">لا توجد عمليات مسجلة حتى الآن</p>
          <p className="text-xs text-gray-400 mt-1">سيتم تسجيل العمليات هنا تلقائياً عند استخدام المنصة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((log: any) => {
            const action = ACTION_MAP[log.action] || { label: log.action, color: "#6B7280" };
            const entity = ENTITY_MAP[log.entity] || { label: log.entity, icon: Settings };
            const EntityIcon = entity.icon;
            return (
              <Card key={log.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <EntityIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{log.userName || "نظام"}</span>
                      <Badge style={{ backgroundColor: action.color + "20", color: action.color }} className="text-[9px]">{action.label}</Badge>
                      <span className="text-xs text-gray-500">{entity.label}</span>
                      {log.entityName && <span className="text-xs text-gray-600 font-medium">"{log.entityName}"</span>}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("ar-SA") : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
          <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(data.total / 30)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 30)} onClick={() => setPage(p => p + 1)}>التالي</Button>
        </div>
      )}
    </div>
  );
}
