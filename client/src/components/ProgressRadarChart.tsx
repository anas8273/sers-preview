import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportToPDF } from "@/lib/pdf-export";
import { buildProgressExportFileName } from "@/lib/progress-export";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { AlertCircle, CheckCircle2, CircleDashed, Download, FileImage, FileText, Loader2, RefreshCw, TrendingUp, XCircle } from "lucide-react";

export interface RadarProgressPoint {
  subject: string;
  value: number;
  fullMark: number;
}

export interface ProgressBarItemProps {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
  showCount?: boolean;
  count?: number;
  total?: number;
}

export interface StatsOverviewCardProps {
  covered: number;
  partial: number;
  missed: number;
  total: number;
  percentage: number;
}

export function ProgressBarItem({ label, value, maxValue = 100, color = "#0f766e", showCount = false, count = 0, total = 0 }: ProgressBarItemProps) {
  const percentage = maxValue > 0 ? Math.min(100, Math.max(0, (value / maxValue) * 100)) : 0;
  const Icon = percentage >= 100 ? CheckCircle2 : percentage > 0 ? AlertCircle : CircleDashed;
  const iconColor = percentage >= 100 ? "text-emerald-600" : percentage > 0 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
        {showCount && <span className="text-xs text-muted-foreground">{count}/{total}</span>}
        <span className="text-xs font-semibold text-foreground">{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-label={`تقدم ${label}`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

interface ProgressRadarChartProps {
  title?: string;
  data: RadarProgressPoint[];
  exportId?: string;
  exportFileName?: string;
}

export function ProgressRadarChart({
  title = "خريطة التقدم في المعايير",
  data,
  exportId = "progress-radar-report",
  exportFileName = "تقرير_التقدم_المتقدم",
}: ProgressRadarChartProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isChartReady, setIsChartReady] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"png" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsChartReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [data]);

  const downloadImage = async () => {
    if (!exportRef.current) return;
    setExportError(null);
    setExportingFormat("png");
    try {
      const imageDataUrl = await toPng(exportRef.current, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = buildProgressExportFileName(exportFileName, "png");
      link.href = imageDataUrl;
      link.click();
    } catch (error) {
      console.error("Progress radar image export failed", error);
      setExportError("تعذر إنشاء الصورة حالياً. يرجى إعادة المحاولة.");
    } finally {
      setExportingFormat(null);
    }
  };

  const downloadPdf = async () => {
    setExportError(null);
    setExportingFormat("pdf");
    try {
      await exportToPDF(exportId, buildProgressExportFileName(exportFileName, "pdf"));
    } catch (error) {
      console.error("Progress radar PDF export failed", error);
      setExportError("تعذر إنشاء ملف PDF حالياً. تحقق من اتصالك ثم أعد المحاولة.");
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <Card className="border-teal-200 dark:border-teal-800">
      <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-5 w-5 text-teal-600" />{title}</CardTitle>
        <div className="flex flex-wrap gap-2" data-no-print>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void downloadImage()} disabled={!isChartReady || exportingFormat !== null}>
            {exportingFormat === "png" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileImage className="h-3.5 w-3.5" />}
            صورة PNG
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => void downloadPdf()} disabled={!isChartReady || exportingFormat !== null}>
            {exportingFormat === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exportError && (
          <div role="alert" className="mb-3 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{exportError}</span>
            <Button type="button" variant="outline" size="sm" className="border-red-300 bg-background text-red-700 hover:bg-red-100" onClick={() => setExportError(null)}><RefreshCw className="ml-1 h-3.5 w-3.5" />إخفاء الرسالة</Button>
          </div>
        )}
        <div id={exportId} ref={exportRef} className="rounded-xl bg-background p-2" dir="rtl">
          {!isChartReady ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
              <span className="text-sm text-muted-foreground">جارٍ تجهيز الرسم البياني…</span>
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Download className="h-7 w-7 opacity-40" />لا توجد بيانات كافية لعرض الرسم أو تصديره.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "currentColor" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="نسبة التقدم" dataKey="value" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.45} />
                  <Tooltip formatter={(value) => [`${value}%`, "التقدم"]} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center sm:grid-cols-4">
                {data.map((point) => <div key={point.subject} className="rounded-lg bg-teal-50 px-2 py-1.5 text-xs dark:bg-teal-950/30"><span className="block truncate text-muted-foreground">{point.subject}</span><strong className="text-teal-700 dark:text-teal-300">{point.value}%</strong></div>)}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsOverviewCard({ covered, partial, missed, total, percentage }: StatsOverviewCardProps) {
  const stats = [
    { label: "مكتمل", value: covered, color: "#059669", icon: CheckCircle2 },
    { label: "جزئي", value: partial, color: "#d97706", icon: AlertCircle },
    { label: "مفقود", value: missed, color: "#dc2626", icon: XCircle },
  ];

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 dark:border-teal-800 dark:from-teal-950/30 dark:to-emerald-950/30">
      <CardHeader className="pb-3"><CardTitle className="text-base">ملخص التقدم</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm"><span className="text-muted-foreground">الجاهزية العامة</span><strong className="text-teal-700 dark:text-teal-300">{Math.round(percentage)}%</strong></div>
          <div className="h-3 overflow-hidden rounded-full bg-white/70 dark:bg-black/20"><div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{covered} مكتمل من أصل {total} بند</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(({ label, value, color, icon: Icon }) => <div key={label} className="rounded-xl border border-border/70 bg-background/80 p-3 text-center"><Icon className="mx-auto mb-1 h-4 w-4" style={{ color }} /><div className="text-xl font-bold" style={{ color }}>{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>)}
        </div>
      </CardContent>
    </Card>
  );
}
