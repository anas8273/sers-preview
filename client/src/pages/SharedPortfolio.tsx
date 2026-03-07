/**
 * صفحة عرض ملف الإنجاز المشارك - عبر رابط آمن ومؤقت
 * لا تتطلب تسجيل دخول
 */
import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { generateQRDataURL } from "@/lib/qr-utils";
import { STANDARDS } from "@/lib/standards-data";
import {
  Lock, Eye, FileText, Image, Video, LinkIcon, Download,
  CheckCircle, AlertTriangle, XCircle, Loader2, ShieldCheck,
  BarChart3, Calendar, Building2, User, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

function getGrade(pct: number) {
  if (pct >= 90) return { label: "ممتاز", color: "#16A34A" };
  if (pct >= 80) return { label: "جيد جداً", color: "#2563EB" };
  if (pct >= 70) return { label: "جيد", color: "#CA8A04" };
  if (pct >= 60) return { label: "مقبول", color: "#EA580C" };
  return { label: "ضعيف", color: "#DC2626" };
}

export default function SharedPortfolio() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error, refetch } = trpc.share.view.useQuery(
    { token, password: submitted ? password : undefined },
    { enabled: !!token, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/30" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">جاري تحميل ملف الإنجاز...</p>
        </div>
      </div>
    );
  }

  if (data?.requiresPassword && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4" dir="rtl">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              ملف إنجاز محمي
            </h1>
            <p className="text-sm text-gray-500 mb-6">هذا الملف محمي بكلمة مرور. أدخل كلمة المرور للمتابعة.</p>
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSubmitted(true); }}
                placeholder="كلمة المرور"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
              />
              <Button onClick={() => setSubmitted(true)} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                عرض الملف
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50/30 p-4" dir="rtl">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              {data.error}
            </h1>
            <p className="text-sm text-gray-500">
              {data.error.includes("صلاحية") ? "يرجى طلب رابط جديد من صاحب الملف." : "تأكد من صحة الرابط وحاول مرة أخرى."}
            </p>
            {data.requiresPassword && (
              <Button onClick={() => { setSubmitted(false); setPassword(""); }} variant="outline" className="mt-4">
                إعادة المحاولة
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.portfolio) return null;

  const portfolio = data.portfolio;
  const files = data.files || [];
  const personalInfo = (portfolio.personalInfo || {}) as Record<string, string>;
  const criteriaData = (portfolio.criteriaData || {}) as Record<string, any>;
  const jobTitle = JOB_TITLES[portfolio.jobId] || portfolio.jobTitle;

  // حساب الإحصائيات
  const criteriaEntries = Object.entries(criteriaData);
  const totalScore = criteriaEntries.reduce((sum, [, d]) => sum + ((d as any)?.score || 0), 0);
  const maxScore = criteriaEntries.length * 5;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const grade = getGrade(percentage);
  const totalEvidences = criteriaEntries.reduce((sum, [, d]) => sum + ((d as any)?.evidences?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>SERS</h1>
              <p className="text-[10px] text-gray-500">ملف إنجاز مشارك</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <Eye className="w-3 h-3" />
            عرض فقط
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* بطاقة المعلومات الشخصية */}
        <Card className="mb-6 overflow-hidden border-0 shadow-lg">
          <div className="bg-gradient-to-l from-emerald-700 to-emerald-800 p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-emerald-200 text-xs mb-1">{personalInfo.department || "وزارة التعليم"}</p>
                <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                  شواهد الأداء الوظيفي
                </h2>
                <p className="text-emerald-100 text-sm">{jobTitle}</p>
              </div>
              <div className="text-center bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <div className="text-3xl font-black">{percentage}%</div>
                <div className="text-sm font-medium text-emerald-100">{grade.label}</div>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-500">الاسم</p>
                  <p className="text-sm font-semibold text-gray-900">{personalInfo.name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-500">المدرسة</p>
                  <p className="text-sm font-semibold text-gray-900">{personalInfo.school || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-500">العام الدراسي</p>
                  <p className="text-sm font-semibold text-gray-900">{personalInfo.year || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-500">المجموع</p>
                  <p className="text-sm font-semibold text-gray-900">{totalScore}/{maxScore}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-emerald-600">{criteriaEntries.length}</div>
              <p className="text-xs text-gray-500">بند تقييم</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-blue-600">{totalEvidences}</div>
              <p className="text-xs text-gray-500">شاهد مرفق</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black" style={{ color: grade.color }}>{percentage}%</div>
              <p className="text-xs text-gray-500">{grade.label}</p>
            </CardContent>
          </Card>
        </div>

        {/* جدول البنود */}
        <Card className="mb-6 border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              تفاصيل البنود والشواهد
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {criteriaEntries.map(([criterionId, d], i) => {
              const data = d as any;
              const evCount = data?.evidences?.length || 0;
              const score = data?.score || 0;
              const status = score >= 4 && evCount > 0 ? "complete" : evCount > 0 || score > 0 ? "partial" : "missing";
              const standard = STANDARDS.find(s => s.id === criterionId);
              const title = standard?.title || criterionId;

              return (
                <div key={criterionId} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        status === "complete" ? "bg-emerald-100 text-emerald-700"
                        : status === "partial" ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                      }`}>
                        {standard?.icon || i + 1}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500">{evCount} شاهد</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={score >= 4 ? "default" : score >= 3 ? "secondary" : "outline"}>
                        {score}/5
                      </Badge>
                      {status === "complete" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {status === "partial" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {status === "missing" && <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  </div>

                  {/* عرض الشواهد */}
                  {data?.evidences && data.evidences.length > 0 && (
                    <div className="mr-11 space-y-2">
                      {data.evidences.map((ev: any) => {
                        const priority = ev.priority || 'essential';
                        const priorityConfig: Record<string, { label: string; color: string; icon: string }> = {
                          essential: { label: 'أساسي', color: '#059669', icon: '★' },
                          supporting: { label: 'داعم', color: '#2563EB', icon: '◆' },
                          supplementary: { label: 'إضافي', color: '#9333EA', icon: '○' },
                        };
                        const pc = priorityConfig[priority] || priorityConfig.essential;
                        return (
                          <div key={ev.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100" style={{ borderRightWidth: '3px', borderRightColor: pc.color }}>
                            {/* رأس الشاهد مع الأولوية */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: pc.color + '15', color: pc.color }}>
                                {pc.icon} {pc.label}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                {ev.type === 'text' ? 'نص' : ev.type === 'image' ? 'صورة' : ev.type === 'link' ? 'رابط' : ev.type === 'file' ? 'ملف' : 'فيديو'}
                              </span>
                            </div>
                            {ev.type === 'text' && ev.text && (
                              <p className="text-sm text-gray-700 leading-relaxed">{ev.text}</p>
                            )}
                            {ev.type === 'link' && ev.link && (
                              <div className="flex items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-purple-500" />
                                <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">
                                  {ev.link}
                                </a>
                              </div>
                            )}
                            {ev.type === 'image' && ev.fileData && (
                              <img src={ev.fileData} alt="" className="max-h-48 rounded-lg" />
                            )}
                            {(ev.type === 'video' || ev.type === 'file') && (
                              <div className="flex items-center gap-2">
                                {ev.type === 'video' ? <Video className="w-4 h-4 text-red-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
                                <span className="text-sm text-gray-600">{ev.fileName}</span>
                              </div>
                            )}
                            {ev.formData && Object.entries(ev.formData).some(([, v]) => v) && (
                              <div className="text-sm space-y-1 mt-2 bg-white rounded-lg p-2">
                                {Object.entries(ev.formData).filter(([, v]) => v).map(([key, val]) => (
                                  <p key={key}><span className="text-gray-500">{key}:</span> <span className="text-gray-800">{val as string}</span></p>
                                ))}
                              </div>
                            )}
                            {/* التعليق */}
                            {ev.comment && ev.comment.trim() && (
                              <div className="mt-2 bg-amber-50 rounded-lg p-2 text-xs text-amber-800 border border-amber-200/50">
                                <strong>تعليق:</strong> {ev.comment}
                              </div>
                            )}
                            {/* الكلمات المفتاحية */}
                            {ev.keywords && ev.keywords.length > 0 && (
                              <div className="mt-2 flex items-center gap-1 flex-wrap">
                                {ev.keywords.map((kw: string, ki: number) => (
                                  <span key={ki} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/50">{kw}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* الملفات المرفوعة */}
        {files.length > 0 && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                الملفات المرفوعة ({files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {files.map((file: any) => (
                  <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    {file.mimeType?.startsWith('image/') ? <Image className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-orange-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
                      <p className="text-xs text-gray-500">{file.mimeType}</p>
                    </div>
                    <Download className="w-4 h-4 text-gray-400" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-gray-400">
            تم إنشاء هذا الملف عبر نظام SERS - السجلات التعليمية الذكية
          </p>
        </div>
      </div>
    </div>
  );
}
