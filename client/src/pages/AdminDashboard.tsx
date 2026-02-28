/**
 * لوحة تحكم المدير - مراجعة ملفات الإنجاز المقدمة
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Eye, FileText,
  Search, Filter, ChevronDown, Loader2, MessageSquare,
  Users, BarChart3, TrendingUp, AlertTriangle, Sparkles,
  ShieldCheck, ThumbsUp, ThumbsDown, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  draft: { label: "مسودة", color: "#6B7280", icon: FileText, bg: "bg-gray-100 text-gray-600" },
  submitted: { label: "مقدّم للمراجعة", color: "#2563EB", icon: Clock, bg: "bg-blue-100 text-blue-700" },
  reviewed: { label: "تمت المراجعة", color: "#CA8A04", icon: Eye, bg: "bg-amber-100 text-amber-700" },
  approved: { label: "معتمد", color: "#16A34A", icon: CheckCircle, bg: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوض", color: "#DC2626", icon: XCircle, bg: "bg-red-100 text-red-600" },
};

const JOB_TITLES: Record<string, string> = {
  teacher: "معلم / معلمة",
  principal: "مدير / مديرة مدرسة",
  vice_principal: "وكيل / وكيلة مدرسة",
  counselor: "موجه/ة طلابي/ة",
  health_counselor: "موجه/ة صحي/ة",
  supervisor: "مشرف/ة تربوي/ة",
  librarian: "أمين/ة مصادر تعلم",
  kindergarten: "معلمة رياض أطفال",
  special_ed: "معلم/ة تربية خاصة",
  admin_assistant: "مساعد/ة إداري/ة",
};

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewDialog, setReviewDialog] = useState<{ id: number; action: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const { data: portfoliosData, isLoading, refetch } = trpc.admin.portfolios.useQuery(
    { page, limit: 20, status: statusFilter },
    { enabled: user?.role === "admin" }
  );

  const { data: portfolioDetail, isLoading: detailLoading } = trpc.admin.portfolioDetail.useQuery(
    { id: selectedPortfolioId! },
    { enabled: !!selectedPortfolioId && user?.role === "admin" }
  );

  const reviewMutation = trpc.admin.review.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الملف بنجاح");
      refetch();
      setReviewDialog(null);
      setReviewNotes("");
    },
    onError: () => {
      toast.error("فشل تحديث الحالة");
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              غير مصرح بالوصول
            </h1>
            <p className="text-sm text-gray-500 mb-4">هذه الصفحة مخصصة لمدير النظام فقط.</p>
            <Button onClick={() => navigate("/")} variant="outline">العودة للرئيسية</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = portfoliosData?.items || [];
  const total = portfoliosData?.total || 0;

  // إحصائيات سريعة
  const stats = useMemo(() => {
    return {
      total,
      submitted: items.filter(i => i.status === "submitted").length,
      approved: items.filter(i => i.status === "approved").length,
      rejected: items.filter(i => i.status === "rejected").length,
    };
  }, [items, total]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i =>
      i.userName?.toLowerCase().includes(q) ||
      i.jobTitle?.toLowerCase().includes(q) ||
      i.userEmail?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const handleReview = (action: string) => {
    if (!reviewDialog) return;
    reviewMutation.mutate({
      portfolioId: reviewDialog.id,
      status: action as any,
      notes: reviewNotes,
    });
  };

  // عرض تفاصيل ملف الإنجاز
  if (selectedPortfolioId && portfolioDetail) {
    const p = portfolioDetail;
    const personalInfo = (p.personalInfo || {}) as Record<string, string>;
    const criteriaData = (p.criteriaData || {}) as Record<string, any>;
    const criteriaEntries = Object.entries(criteriaData);
    const totalScore = criteriaEntries.reduce((sum, [, d]) => sum + ((d as any)?.score || 0), 0);
    const maxScore = criteriaEntries.length * 5;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.draft;

    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="sm" onClick={() => setSelectedPortfolioId(null)} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />العودة للقائمة
            </Button>
            <div className="flex gap-2">
              {p.status !== "approved" && (
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setReviewDialog({ id: p.id, action: "approved" })}>
                  <ThumbsUp className="w-4 h-4" />اعتماد
                </Button>
              )}
              {p.status !== "rejected" && (
                <Button size="sm" variant="destructive" className="gap-1.5"
                  onClick={() => setReviewDialog({ id: p.id, action: "rejected" })}>
                  <ThumbsDown className="w-4 h-4" />رفض
                </Button>
              )}
            </div>
          </div>

          {/* معلومات الملف */}
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    {personalInfo.name || "بدون اسم"}
                  </h2>
                  <p className="text-sm text-gray-500">{JOB_TITLES[p.jobId] || p.jobTitle}</p>
                </div>
                <Badge className={statusInfo.bg}>{statusInfo.label}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">المدرسة:</span> <strong>{personalInfo.school || "—"}</strong></div>
                <div><span className="text-gray-500">العام:</span> <strong>{personalInfo.year || "—"}</strong></div>
                <div><span className="text-gray-500">المجموع:</span> <strong>{totalScore}/{maxScore} ({percentage}%)</strong></div>
                <div><span className="text-gray-500">الاكتمال:</span> <strong>{p.completionPercentage || 0}%</strong></div>
              </div>
              {p.reviewNotes && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-bold text-amber-700 mb-1">ملاحظات المراجعة:</p>
                  <p className="text-sm text-amber-800">{p.reviewNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* البنود */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-sm">البنود والشواهد ({criteriaEntries.length} بند)</CardTitle>
            </CardHeader>
            <div className="divide-y divide-gray-100">
              {criteriaEntries.map(([criterionId, d], i) => {
                const data = d as any;
                const evCount = data?.evidences?.length || 0;
                const score = data?.score || 0;
                return (
                  <div key={criterionId} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-900">
                        <span className="text-gray-400 ml-2">#{i + 1}</span>
                        {criterionId}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={score >= 4 ? "default" : "outline"}>{score}/5</Badge>
                        <span className="text-xs text-gray-500">{evCount} شاهد</span>
                      </div>
                    </div>
                    {data?.evidences?.map((ev: any) => (
                      <div key={ev.id} className="mr-6 mb-2 p-3 bg-gray-50 rounded-lg text-sm">
                        {ev.type === 'text' && ev.text && <p>{ev.text}</p>}
                        {ev.type === 'link' && ev.link && <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{ev.link}</a>}
                        {ev.type === 'image' && ev.fileData && <img src={ev.fileData} alt="" className="max-h-32 rounded" />}
                        {ev.formData && Object.entries(ev.formData).some(([, v]) => v) && (
                          <div className="space-y-1">
                            {Object.entries(ev.formData).filter(([, v]) => v).map(([key, val]) => (
                              <p key={key}><span className="text-gray-500">{key}:</span> {val as string}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* الملفات المرفوعة */}
          {(p as any).files?.length > 0 && (
            <Card className="mt-6 border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">الملفات المرفوعة ({(p as any).files.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(p as any).files.map((file: any) => (
                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm truncate">{file.originalName}</span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // القائمة الرئيسية
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />الرئيسية
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                لوحة تحكم المدير
              </h1>
              <p className="text-sm text-gray-500">مراجعة واعتماد ملفات الإنجاز</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            مدير النظام
          </Badge>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{total}</div>
                <p className="text-xs text-gray-500">إجمالي الملفات</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{stats.submitted}</div>
                <p className="text-xs text-gray-500">بانتظار المراجعة</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{stats.approved}</div>
                <p className="text-xs text-gray-500">معتمد</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{stats.rejected}</div>
                <p className="text-xs text-gray-500">مرفوض</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* أدوات البحث والفلترة */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم أو الوظيفة..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(undefined)}>الكل</Button>
                {Object.entries(STATUS_MAP).map(([key, val]) => (
                  <Button key={key} variant={statusFilter === key ? "default" : "outline"} size="sm"
                    onClick={() => setStatusFilter(key)}>{val.label}</Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* قائمة الملفات */}
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">جاري التحميل...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد ملفات إنجاز</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.draft;
              const StatusIcon = statusInfo.icon;
              return (
                <Card key={item.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedPortfolioId(item.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{item.userName || "بدون اسم"}</h3>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span>{JOB_TITLES[item.jobId] || item.jobTitle}</span>
                            <span>·</span>
                            <span>{item.userEmail || "—"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center hidden sm:block">
                          <p className="text-sm font-bold text-gray-900">{item.completionPercentage || 0}%</p>
                          <p className="text-[10px] text-gray-500">اكتمال</p>
                        </div>
                        <Badge className={statusInfo.bg}>
                          <StatusIcon className="w-3 h-3 ml-1" />
                          {statusInfo.label}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); setSelectedPortfolioId(item.id); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {item.status === "submitted" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600"
                                onClick={(e) => { e.stopPropagation(); setReviewDialog({ id: item.id, action: "approved" }); }}>
                                <ThumbsUp className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                onClick={(e) => { e.stopPropagation(); setReviewDialog({ id: item.id, action: "rejected" }); }}>
                                <ThumbsDown className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.reviewNotes && (
                      <div className="mt-3 mr-15 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600"><MessageSquare className="w-3 h-3 inline ml-1" />{item.reviewNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
            <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(total / 20)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>التالي</Button>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approved" ? "اعتماد ملف الإنجاز" : "رفض ملف الإنجاز"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog?.action === "approved"
                ? "هل أنت متأكد من اعتماد هذا الملف؟"
                : "هل أنت متأكد من رفض هذا الملف؟ يرجى إضافة ملاحظات توضيحية."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات المراجعة (اختياري)</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="أضف ملاحظاتك هنا..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewDialog(null)}>إلغاء</Button>
            <Button
              onClick={() => handleReview(reviewDialog?.action || "reviewed")}
              disabled={reviewMutation.isPending}
              className={reviewDialog?.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
              {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              {reviewDialog?.action === "approved" ? "اعتماد" : "رفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
