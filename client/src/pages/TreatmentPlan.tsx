/*
 * الخطط العلاجية والإثرائية - صفحة تفاعلية
 * المستخدم يختار النوع → يدخل بيانات الطلاب والمهارات → معاينة → تصدير PDF
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Printer, Plus, Trash2, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";

const PLAN_TYPES = [
  { id: "remedial_individual", title: "خطة علاجية فردية", color: "#DC2626" },
  { id: "remedial_group", title: "خطة علاجية جماعية", color: "#EA580C" },
  { id: "enrichment_individual", title: "خطة إثرائية فردية", color: "#16A34A" },
  { id: "enrichment_group", title: "خطة إثرائية جماعية", color: "#0D9488" },
  { id: "iep", title: "خطة تربوية فردية (IEP)", color: "#7C3AED" },
  { id: "learning_loss", title: "خطة الفاقد التعليمي", color: "#2563EB" },
];

interface PlanStudent {
  id: string;
  name: string;
  weakness: string;
  activities: string;
  evaluation: string;
  notes: string;
}

export default function TreatmentPlan() {
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState(PLAN_TYPES[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [info, setInfo] = useState({
    subject: "",
    teacher: "",
    grade: "",
    school: "",
    year: "1446-1447",
    semester: "الأول",
    skill: "",
    objective: "",
    duration: "",
    tools: "",
  });

  const [students, setStudents] = useState<PlanStudent[]>([
    { id: "1", name: "", weakness: "", activities: "", evaluation: "", notes: "" },
  ]);

  const addStudent = () => {
    setStudents((prev) => [...prev, { id: `${Date.now()}`, name: "", weakness: "", activities: "", evaluation: "", notes: "" }]);
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStudent = (id: string, field: keyof PlanStudent, value: string) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    await exportToPDF("plan-preview", `${selectedType.title}_${info.subject || "خطة"}.pdf`);
    setIsExporting(false);
  };

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 mb-4 flex-wrap">
            <button type="button" onClick={() => setShowPreview(false)} className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm border">
              <ArrowLeft className="w-4 h-4" />
              تعديل
            </button>
            <button type="button" onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: selectedType.color }}>
              <Download className="w-4 h-4" />
              {isExporting ? "جاري..." : "تحميل PDF"}
            </button>
            <button type="button" onClick={() => printElement("plan-preview")} className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm border">
              <Printer className="w-4 h-4" />
              طباعة
            </button>
          </div>

          <div id="plan-preview" className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
            {/* شريط علوي بتدرج */}
            <div style={{ height: '5px', background: 'linear-gradient(to left, #1a4d5e, #0d7377, #2ea87a)' }} />

            {/* الهيدر */}
            <div style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0d737720' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#0d7377', fontWeight: 700 }}>وزارة التعليم</div>
                <div style={{ fontSize: '10px', color: '#1a4d5e', fontWeight: 600 }}>{info.school || 'اسم المدرسة'}</div>
              </div>
              <div style={{ width: '2px', height: '35px', background: '#5bb784', margin: '0 12px' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '10px', color: '#666' }}>العام: {info.year}</div>
                <div style={{ fontSize: '10px', color: '#666' }}>الفصل: {info.semester}</div>
              </div>
            </div>

            {/* مربع العنوان */}
            <div style={{ padding: '12px 28px', textAlign: 'center' }}>
              <div style={{ border: '2px solid #7ECDC0', borderRadius: '16px', padding: '10px 20px', display: 'inline-block' }}>
                <h1 className="text-xl font-black" style={{ color: '#1a4d5e' }}>{selectedType.title}</h1>
              </div>
              <p className="text-sm mt-2" style={{ color: '#666' }}>{info.subject} - {info.grade}</p>
            </div>

            <div style={{ padding: '0 28px' }}>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
              {[
                { label: "المعلم", value: info.teacher },
                { label: "المدرسة", value: info.school },
                { label: "المهارة المستهدفة", value: info.skill },
                { label: "الهدف", value: info.objective },
                { label: "المدة", value: info.duration },
                { label: "الأدوات", value: info.tools },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-400">{item.label}</div>
                  <div className="font-medium text-gray-800">{item.value || "---"}</div>
                </div>
              ))}
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'linear-gradient(to left, #1a4d5e, #0d7377)', color: '#fff' }}>
                  <th className="p-2 text-right text-xs">م</th>
                  <th className="p-2 text-right text-xs">الطالب</th>
                  <th className="p-2 text-right text-xs">نقاط الضعف / القوة</th>
                  <th className="p-2 text-right text-xs">الأنشطة والإجراءات</th>
                  <th className="p-2 text-right text-xs">التقييم</th>
                  <th className="p-2 text-right text-xs">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {students.filter((s) => s.name).map((student, index) => (
                  <tr key={student.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-2 border border-gray-200 text-center font-bold" style={{ color: selectedType.color }}>{index + 1}</td>
                    <td className="p-2 border border-gray-200 font-medium">{student.name}</td>
                    <td className="p-2 border border-gray-200 text-xs">{student.weakness || "---"}</td>
                    <td className="p-2 border border-gray-200 text-xs">{student.activities || "---"}</td>
                    <td className="p-2 border border-gray-200 text-xs">{student.evaluation || "---"}</td>
                    <td className="p-2 border border-gray-200 text-xs">{student.notes || "---"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-sm font-bold text-gray-800 mb-1">التنفيذ: أ/ {info.teacher || '...............'}</div>
                <div style={{ borderTop: '2.5px dotted #0d737760', width: '160px', margin: '4px auto 0' }} />
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-gray-800 mb-1">مديرة المدرسة: أ/ ...............</div>
                <div style={{ borderTop: '2.5px dotted #0d737760', width: '160px', margin: '4px auto 0' }} />
              </div>
            </div>
            </div>

            {/* الفوتر المنحني */}
            <div style={{ marginTop: '16px' }}>
              <svg viewBox="0 0 800 40" preserveAspectRatio="none" style={{ width: '100%', height: '20px', display: 'block' }}>
                <defs>
                  <linearGradient id="planFooterGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2ea87a" />
                    <stop offset="50%" stopColor="#0d7377" />
                    <stop offset="100%" stopColor="#1a4d5e" />
                  </linearGradient>
                </defs>
                <path d="M0,40 L0,28 C150,6 400,0 800,14 L800,40 Z" fill="url(#planFooterGrad)" />
              </svg>
              <div style={{
                background: 'linear-gradient(to left, #1a4d5e, #0d7377, #2ea87a)',
                padding: '4px 28px 8px',
                fontSize: '10px',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '-1px',
              }}>
                <span style={{ fontWeight: 700 }}>SERS - نظام السجلات التعليمية الذكي</span>
                <span style={{ opacity: 0.85 }}>{info.school || ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">العودة</span>
        </button>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>الخطط العلاجية والإثرائية</h1>
            <p className="text-sm text-gray-500">اختر النوع → أدخل البيانات → معاينة وتصدير</p>
          </div>
          <button type="button" onClick={() => setShowPreview(true)} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: selectedType.color }}>
            <Eye className="w-4 h-4" />
            معاينة وتصدير
          </button>
        </div>

        {/* نوع الخطة */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {PLAN_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type)}
              className={`p-3 rounded-xl text-center text-xs font-medium transition-all border-2 ${
                selectedType.id === type.id ? "shadow-md" : "border-gray-200 hover:border-gray-300"
              }`}
              style={selectedType.id === type.id ? { borderColor: type.color, backgroundColor: type.color + "10" } : {}}
            >
              <div className="font-bold" style={{ color: selectedType.id === type.id ? type.color : "#6B7280" }}>{type.title}</div>
            </button>
          ))}
        </div>

        {/* البيانات */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>بيانات الخطة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "subject", label: "المادة", placeholder: "رياضيات" },
              { key: "teacher", label: "المعلم", placeholder: "اسم المعلم" },
              { key: "grade", label: "الصف", placeholder: "الأول المتوسط" },
              { key: "school", label: "المدرسة", placeholder: "اسم المدرسة" },
              { key: "year", label: "العام", placeholder: "1446-1447" },
              { key: "semester", label: "الفصل", placeholder: "الأول" },
              { key: "skill", label: "المهارة المستهدفة", placeholder: "جمع الكسور..." },
              { key: "objective", label: "الهدف", placeholder: "أن يتمكن الطالب من..." },
              { key: "duration", label: "المدة", placeholder: "أسبوعين" },
              { key: "tools", label: "الأدوات والوسائل", placeholder: "أوراق عمل، سبورة..." },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={(info as any)[field.key]}
                  onChange={(e) => setInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            ))}
          </div>
        </div>

        {/* الطلاب */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>بيانات الطلاب ({students.length})</h2>
            <button type="button" onClick={addStudent} className="flex items-center gap-1 text-sm font-medium" style={{ color: selectedType.color }}>
              <Plus className="w-4 h-4" />
              إضافة طالب
            </button>
          </div>

          <div className="space-y-3">
            {students.map((student, index) => (
              <motion.div key={student.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold" style={{ color: selectedType.color }}>الطالب {index + 1}</span>
                  {students.length > 1 && (
                    <button type="button" onClick={() => removeStudent(student.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: "name", label: "الاسم", placeholder: "اسم الطالب" },
                    { key: "weakness", label: "نقاط الضعف / القوة", placeholder: "لا يستطيع جمع الكسور..." },
                    { key: "activities", label: "الأنشطة والإجراءات", placeholder: "تدريبات إضافية..." },
                    { key: "evaluation", label: "التقييم", placeholder: "اختبار قصير / ملاحظة..." },
                    { key: "notes", label: "ملاحظات", placeholder: "ملاحظات إضافية..." },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">{field.label}</label>
                      <input
                        type="text"
                        value={(student as any)[field.key]}
                        onChange={(e) => updateStudent(student.id, field.key as keyof PlanStudent, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
