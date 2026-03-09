/*
 * تحليل النتائج والدرجات - صفحة تفاعلية كاملة
 * المستخدم يدخل بيانات المادة والطلاب → رسوم بيانية تلقائية → تقرير → تصدير PDF
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Printer, Plus, Trash2, BarChart3, PieChart, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";

interface Student {
  id: string;
  name: string;
  score: number;
}

export default function GradeAnalysis() {
  const [, navigate] = useLocation();
  const [isExporting, setIsExporting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [subjectInfo, setSubjectInfo] = useState({
    subject: "",
    teacher: "",
    grade: "",
    section: "",
    semester: "الأول",
    year: "1446-1447",
    maxScore: 100,
  });

  const [students, setStudents] = useState<Student[]>([
    { id: "1", name: "", score: 0 },
    { id: "2", name: "", score: 0 },
    { id: "3", name: "", score: 0 },
    { id: "4", name: "", score: 0 },
    { id: "5", name: "", score: 0 },
  ]);

  const addStudent = () => {
    setStudents((prev) => [...prev, { id: `${Date.now()}`, name: "", score: 0 }]);
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStudent = (id: string, field: keyof Student, value: string | number) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // الإحصائيات
  const stats = useMemo(() => {
    const validStudents = students.filter((s) => s.name.trim() && s.score > 0);
    if (validStudents.length === 0) return null;

    const scores = validStudents.map((s) => s.score);
    const max = subjectInfo.maxScore || 100;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    const excellent = validStudents.filter((s) => (s.score / max) * 100 >= 90).length;
    const veryGood = validStudents.filter((s) => { const p = (s.score / max) * 100; return p >= 80 && p < 90; }).length;
    const good = validStudents.filter((s) => { const p = (s.score / max) * 100; return p >= 70 && p < 80; }).length;
    const pass = validStudents.filter((s) => { const p = (s.score / max) * 100; return p >= 60 && p < 70; }).length;
    const fail = validStudents.filter((s) => (s.score / max) * 100 < 60).length;

    return {
      total: validStudents.length,
      avg: avg.toFixed(1),
      avgPct: ((avg / max) * 100).toFixed(1),
      highest,
      lowest,
      excellent,
      veryGood,
      good,
      pass,
      fail,
      passRate: (((validStudents.length - fail) / validStudents.length) * 100).toFixed(1),
      students: validStudents,
    };
  }, [students, subjectInfo.maxScore]);

  const getGradeColor = (score: number) => {
    const pct = (score / (subjectInfo.maxScore || 100)) * 100;
    if (pct >= 90) return "#16A34A";
    if (pct >= 80) return "#2563EB";
    if (pct >= 70) return "#CA8A04";
    if (pct >= 60) return "#EA580C";
    return "#DC2626";
  };

  const getGradeLabel = (score: number) => {
    const pct = (score / (subjectInfo.maxScore || 100)) * 100;
    if (pct >= 90) return "ممتاز";
    if (pct >= 80) return "جيد جداً";
    if (pct >= 70) return "جيد";
    if (pct >= 60) return "مقبول";
    return "راسب";
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    await exportToPDF("analysis-report", `تحليل_نتائج_${subjectInfo.subject || "مادة"}.pdf`);
    setIsExporting(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">العودة للرئيسية</span>
        </button>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              تحليل النتائج والدرجات
            </h1>
            <p className="text-sm text-gray-500">أدخل بيانات المادة والدرجات → تحليل تلقائي مع رسوم بيانية</p>
          </div>
          {stats && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(!showReport)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                {showReport ? "إخفاء التقرير" : "عرض التقرير"}
              </button>
            </div>
          )}
        </div>

        {!showReport ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* بيانات المادة */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>بيانات المادة</h2>
              <div className="space-y-3">
                {[
                  { key: "subject", label: "المادة", placeholder: "رياضيات / علوم / لغة عربية" },
                  { key: "teacher", label: "المعلم", placeholder: "اسم المعلم" },
                  { key: "grade", label: "الصف", placeholder: "الصف الأول المتوسط" },
                  { key: "section", label: "الشعبة", placeholder: "أ / ب / ج" },
                  { key: "semester", label: "الفصل", placeholder: "الأول" },
                  { key: "year", label: "العام", placeholder: "1446-1447" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={(subjectInfo as any)[field.key]}
                      onChange={(e) => setSubjectInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">الدرجة العظمى</label>
                  <input
                    type="number"
                    value={subjectInfo.maxScore}
                    onChange={(e) => setSubjectInfo((prev) => ({ ...prev, maxScore: parseInt(e.target.value) || 100 }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* إحصائيات سريعة */}
              {stats && (
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-3 text-sm">إحصائيات سريعة</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-teal-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-black text-teal-700">{stats.avgPct}%</div>
                      <div className="text-[10px] text-teal-600">المتوسط</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-black text-blue-700">{stats.passRate}%</div>
                      <div className="text-[10px] text-blue-600">نسبة النجاح</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-black text-green-700">{stats.highest}</div>
                      <div className="text-[10px] text-green-600">أعلى درجة</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-black text-red-700">{stats.lowest}</div>
                      <div className="text-[10px] text-red-600">أدنى درجة</div>
                    </div>
                  </div>

                  {/* توزيع التقديرات */}
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-gray-600 mb-2">توزيع التقديرات</h4>
                    {[
                      { label: "ممتاز (90+)", count: stats.excellent, color: "#16A34A", total: stats.total },
                      { label: "جيد جداً (80-89)", count: stats.veryGood, color: "#2563EB", total: stats.total },
                      { label: "جيد (70-79)", count: stats.good, color: "#CA8A04", total: stats.total },
                      { label: "مقبول (60-69)", count: stats.pass, color: "#EA580C", total: stats.total },
                      { label: "راسب (<60)", count: stats.fail, color: "#DC2626", total: stats.total },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 mb-1.5">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[11px] text-gray-600 flex-1">{item.label}</span>
                        <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.count}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(item.count / item.total) * 100}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* جدول الطلاب */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                  درجات الطلاب ({students.length})
                </h2>
                <button type="button" onClick={addStudent} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-4 h-4" />
                  إضافة طالب
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-right text-xs font-bold text-gray-600 w-10">م</th>
                      <th className="p-2 text-right text-xs font-bold text-gray-600">اسم الطالب</th>
                      <th className="p-2 text-center text-xs font-bold text-gray-600 w-24">الدرجة</th>
                      <th className="p-2 text-center text-xs font-bold text-gray-600 w-16">النسبة</th>
                      <th className="p-2 text-center text-xs font-bold text-gray-600 w-20">التقدير</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const pct = subjectInfo.maxScore > 0 ? ((student.score / subjectInfo.maxScore) * 100) : 0;
                      return (
                        <motion.tr
                          key={student.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="p-2 text-center text-gray-500 font-medium">{index + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={student.name}
                              onChange={(e) => updateStudent(student.id, "name", e.target.value)}
                              placeholder="اسم الطالب..."
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={student.score || ""}
                              onChange={(e) => updateStudent(student.id, "score", parseInt(e.target.value) || 0)}
                              placeholder="0"
                              min={0}
                              max={subjectInfo.maxScore}
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {student.score > 0 && (
                              <span className="text-xs font-bold" style={{ color: getGradeColor(student.score) }}>
                                {pct.toFixed(0)}%
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {student.score > 0 && (
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                style={{ backgroundColor: getGradeColor(student.score) }}
                              >
                                {getGradeLabel(student.score)}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {students.length > 1 && (
                              <button type="button" onClick={() => removeStudent(student.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-3">
                <button type="button" onClick={addStudent} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 px-4 py-2 rounded-lg">
                  <Plus className="w-4 h-4" />
                  إضافة 1 طالب
                </button>
                <button
                  onClick={() => {
                    const newStudents = Array.from({ length: 5 }, (_, i) => ({
                      id: `${Date.now()}-${i}`,
                      name: "",
                      score: 0,
                    }));
                    setStudents((prev) => [...prev, ...newStudents]);
                  }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 px-4 py-2 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  إضافة 5 طلاب
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* التقرير الكامل */
          <div>
            <div className="flex gap-3 mb-4">
              <button type="button" onClick={() => setShowReport(false)} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">
                <ArrowLeft className="w-4 h-4" />
                العودة للإدخال
              </button>
              <button type="button" onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Download className="w-4 h-4" />
                {isExporting ? "جاري..." : "تحميل PDF"}
              </button>
              <button type="button" onClick={() => printElement("analysis-report")} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">
                <Printer className="w-4 h-4" />
                طباعة
              </button>
            </div>

            <div id="analysis-report" className="bg-white rounded-xl shadow-lg p-8" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
              {/* هيدر التقرير */}
              <div className="text-center mb-6 pb-6 border-b-2 border-blue-600">
                <h1 className="text-2xl font-black text-blue-900 mb-1">تقرير تحليل نتائج الطلاب</h1>
                <p className="text-sm text-gray-500">
                  {subjectInfo.subject || "المادة"} - {subjectInfo.grade || "الصف"} ({subjectInfo.section || "الشعبة"}) - الفصل {subjectInfo.semester} - {subjectInfo.year}
                </p>
                <p className="text-xs text-gray-400 mt-1">المعلم: {subjectInfo.teacher || "---"}</p>
              </div>

              {stats && (
                <>
                  {/* الإحصائيات */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    {[
                      { label: "عدد الطلاب", value: stats.total, icon: Users, color: "#6366F1" },
                      { label: "المتوسط", value: `${stats.avg} (${stats.avgPct}%)`, icon: BarChart3, color: "#0EA5E9" },
                      { label: "أعلى درجة", value: stats.highest, icon: TrendingUp, color: "#16A34A" },
                      { label: "أدنى درجة", value: stats.lowest, icon: TrendingUp, color: "#DC2626" },
                      { label: "نسبة النجاح", value: `${stats.passRate}%`, icon: PieChart, color: "#8B5CF6" },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-4 text-center">
                        <item.icon className="w-5 h-5 mx-auto mb-1" style={{ color: item.color }} />
                        <div className="text-lg font-black" style={{ color: item.color }}>{item.value}</div>
                        <div className="text-[10px] text-gray-500">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* رسم بياني بسيط (شريطي) */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-800 mb-3">توزيع التقديرات</h3>
                    <div className="flex items-end gap-4 justify-center h-40">
                      {[
                        { label: "ممتاز", count: stats.excellent, color: "#16A34A" },
                        { label: "جيد جداً", count: stats.veryGood, color: "#2563EB" },
                        { label: "جيد", count: stats.good, color: "#CA8A04" },
                        { label: "مقبول", count: stats.pass, color: "#EA580C" },
                        { label: "راسب", count: stats.fail, color: "#DC2626" },
                      ].map((item) => {
                        const maxCount = Math.max(stats.excellent, stats.veryGood, stats.good, stats.pass, stats.fail, 1);
                        const height = (item.count / maxCount) * 120;
                        return (
                          <div key={item.label} className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold" style={{ color: item.color }}>{item.count}</span>
                            <div
                              className="w-14 rounded-t-lg transition-all"
                              style={{ height: Math.max(height, 4), backgroundColor: item.color }}
                            />
                            <span className="text-[10px] text-gray-600">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* جدول النتائج */}
                  <h3 className="font-bold text-gray-800 mb-3">تفاصيل الدرجات</h3>
                  <table className="w-full text-sm border-collapse mb-4">
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="p-2 text-right text-xs">م</th>
                        <th className="p-2 text-right text-xs">اسم الطالب</th>
                        <th className="p-2 text-center text-xs">الدرجة</th>
                        <th className="p-2 text-center text-xs">النسبة</th>
                        <th className="p-2 text-center text-xs">التقدير</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.students.sort((a, b) => b.score - a.score).map((student, index) => (
                        <tr key={student.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="p-2 border border-gray-200 text-center">{index + 1}</td>
                          <td className="p-2 border border-gray-200 font-medium">{student.name}</td>
                          <td className="p-2 border border-gray-200 text-center font-bold">{student.score}</td>
                          <td className="p-2 border border-gray-200 text-center">{((student.score / subjectInfo.maxScore) * 100).toFixed(0)}%</td>
                          <td className="p-2 border border-gray-200 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: getGradeColor(student.score) }}>
                              {getGradeLabel(student.score)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="text-center text-[10px] text-gray-400 mt-6 pt-4 border-t border-gray-100">
                    تم إنشاء هذا التقرير بواسطة نظام SERS - السجلات التعليمية الذكية
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
