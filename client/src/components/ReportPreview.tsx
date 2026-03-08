/**
 * ReportPreview - معاينة حية للتقرير بهوية وزارة التعليم
 * يدعم: عرض جدولي / عرض ديناميكي تفاعلي / تصدير PDF / مشاركة
 */
import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import {
  Download, Share2, Table2, LayoutTemplate, Eye, Printer,
  ChevronDown, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportField, ReportLayout, ReportLayoutSection } from "../../../drizzle/schema";
import type { ReportFormData } from "./ReportForm";

// ─── Types ────────────────────────────────────────────────────
interface ReportPreviewProps {
  fields: ReportField[];
  layout: ReportLayout;
  data: ReportFormData;
  title: string;
  personalInfo?: {
    schoolName?: string;
    region?: string;
    teacherName?: string;
    principalName?: string;
    semester?: string;
    year?: string;
  };
  themeColors?: {
    headerBg?: string;
    headerText?: string;
    accent?: string;
    borderColor?: string;
    bodyBg?: string;
  };
  onExportPDF?: () => void;
  onShare?: () => void;
  isExporting?: boolean;
}

export type ViewMode = "template" | "table";

export interface ReportPreviewHandle {
  getPreviewElement: () => HTMLDivElement | null;
}

// ─── Ministry Header ──────────────────────────────────────────
function MinistryHeader({
  schoolName,
  region,
  headerBg,
  headerText,
}: {
  schoolName?: string;
  region?: string;
  headerBg?: string;
  headerText?: string;
}) {
  return (
    <div
      className="rounded-t-lg px-6 py-4 flex items-center justify-between"
      style={{ background: headerBg || "linear-gradient(135deg, #1a7a5e 0%, #1a5276 50%, #0d3b5e 100%)" }}
    >
      <div className="text-right" style={{ color: headerText || "#fff" }}>
        <p className="text-xs font-medium opacity-90">المملكة العربية السعودية</p>
        <p className="text-xs font-medium opacity-90">وزارة التعليم</p>
        <p className="text-xs font-medium opacity-90">الإدارة العامة للتعليم</p>
        {region && <p className="text-xs font-medium opacity-90">بمنطقة {region}</p>}
        {schoolName && <p className="text-xs font-medium opacity-90">{schoolName}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-center" style={{ color: headerText || "#fff" }}>
          <p className="text-base font-bold" style={{ fontFamily: "'Tajawal', sans-serif" }}>وزارة التعليم</p>
          <p className="text-[10px] opacity-80">Ministry of Education</p>
        </div>
        {/* Ministry logo placeholder - dots pattern */}
        <div className="w-12 h-12 flex items-center justify-center">
          <svg viewBox="0 0 60 60" className="w-12 h-12" fill={headerText || "#fff"}>
            <circle cx="30" cy="8" r="3" opacity="0.9" />
            <circle cx="20" cy="16" r="3" opacity="0.9" />
            <circle cx="30" cy="16" r="3" opacity="0.9" />
            <circle cx="40" cy="16" r="3" opacity="0.9" />
            <circle cx="12" cy="24" r="3" opacity="0.9" />
            <circle cx="22" cy="24" r="3" opacity="0.9" />
            <circle cx="30" cy="24" r="3" opacity="0.9" />
            <circle cx="38" cy="24" r="3" opacity="0.9" />
            <circle cx="48" cy="24" r="3" opacity="0.9" />
            <circle cx="12" cy="32" r="3" opacity="0.9" />
            <circle cx="22" cy="32" r="3" opacity="0.9" />
            <circle cx="30" cy="32" r="3" opacity="0.9" />
            <circle cx="38" cy="32" r="3" opacity="0.9" />
            <circle cx="48" cy="32" r="3" opacity="0.9" />
            <rect x="10" y="40" width="40" height="3" rx="1.5" opacity="0.9" />
            <rect x="15" y="46" width="30" height="2" rx="1" opacity="0.7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────
function ReportFooter({ accent }: { accent?: string }) {
  return (
    <div
      className="h-3 rounded-b-lg"
      style={{ background: accent || "linear-gradient(90deg, #1a7a5e, #1a5276)" }}
    />
  );
}

// ─── Field Value Display ──────────────────────────────────────
function FieldValue({
  field,
  value,
  accent,
}: {
  field: ReportField;
  value: any;
  accent?: string;
}) {
  if (!value && value !== 0) {
    return <span className="text-gray-300 text-xs italic">لم يتم الإدخال</span>;
  }

  switch (field.type) {
    case "list": {
      const items = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-0.5">
          {items.filter(Boolean).map((item: string, idx: number) => (
            <p key={idx} className="text-xs text-gray-800 leading-relaxed">
              {idx + 1}. {item}
            </p>
          ))}
        </div>
      );
    }
    case "image":
      return (
        <img src={value} alt={field.label} className="max-w-full max-h-40 rounded border border-gray-200 object-contain" />
      );
    case "images": {
      const urls = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {urls.map((url: string, idx: number) => (
            <img key={idx} src={url} alt="" className="w-24 h-24 rounded border border-gray-200 object-cover" />
          ))}
        </div>
      );
    }
    case "textarea":
      return <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{value}</p>;
    default:
      return <span className="text-xs text-gray-800">{value}</span>;
  }
}

// ─── Template View (Ministry Style) ───────────────────────────
function TemplateView({
  fields,
  layout,
  data,
  title,
  personalInfo,
  themeColors,
}: Omit<ReportPreviewProps, "onExportPDF" | "onShare" | "isExporting">) {
  const accent = themeColors?.accent || "#148f77";
  const borderColor = themeColors?.borderColor || "#d5f5e3";

  // Group fields by section
  const fieldMap = new Map<string, ReportField>();
  for (const f of fields) fieldMap.set(f.id, f);

  // Render sections from layout
  const renderSection = (section: ReportLayoutSection) => {
    const sectionFields = section.fieldIds
      ? section.fieldIds.map(id => fieldMap.get(id)).filter(Boolean) as ReportField[]
      : [];

    switch (section.type) {
      case "header":
        return (
          <div key={section.id} className="mb-3">
            <div
              className="text-center py-2 px-4 rounded-lg text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${accent}, #1a5276)`, fontFamily: "'Tajawal', sans-serif" }}
            >
              {section.title || title}
            </div>
          </div>
        );

      case "fields":
        return (
          <div key={section.id} className="mb-3">
            {section.title && (
              <div
                className="text-center py-1.5 px-4 rounded-lg text-white font-bold text-xs mb-2"
                style={{ background: `linear-gradient(135deg, ${accent}, #1a5276)`, fontFamily: "'Tajawal', sans-serif" }}
              >
                {section.title}
              </div>
            )}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${section.columns || 1}, 1fr)` }}
            >
              {sectionFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-start gap-2 p-2 rounded-lg"
                  style={{ border: `1px solid ${borderColor}` }}
                >
                  <span
                    className="text-xs font-bold shrink-0 px-2 py-1 rounded"
                    style={{ color: accent, backgroundColor: `${accent}10` }}
                  >
                    {field.label}:
                  </span>
                  <div className="flex-1 min-w-0">
                    <FieldValue field={field} value={data[field.id]} accent={accent} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "content":
        return (
          <div key={section.id} className="mb-3">
            {section.title && (
              <div
                className="text-center py-1.5 px-4 rounded-lg text-white font-bold text-xs mb-2"
                style={{ background: `linear-gradient(135deg, ${accent}, #1a5276)`, fontFamily: "'Tajawal', sans-serif" }}
              >
                {section.title}
              </div>
            )}
            <div className="p-3 rounded-lg" style={{ border: `1px solid ${borderColor}` }}>
              {sectionFields.map((field) => (
                <div key={field.id} className="mb-2 last:mb-0">
                  <FieldValue field={field} value={data[field.id]} accent={accent} />
                </div>
              ))}
            </div>
          </div>
        );

      case "images":
        return (
          <div key={section.id} className="mb-3">
            {section.title && (
              <div
                className="text-center py-1.5 px-4 rounded-lg font-bold text-xs mb-2"
                style={{ color: accent, border: `1px dashed ${accent}` }}
              >
                {section.title}
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center p-3 rounded-lg" style={{ border: `1px solid ${borderColor}` }}>
              {sectionFields.map((field) => (
                <div key={field.id}>
                  <FieldValue field={field} value={data[field.id]} accent={accent} />
                </div>
              ))}
            </div>
          </div>
        );

      case "signatures":
        return (
          <div key={section.id} className="mt-4 flex justify-between px-8">
            {sectionFields.map((field) => (
              <div key={field.id} className="text-center">
                <p className="text-xs font-bold text-gray-700 mb-6">{field.label}</p>
                <div className="border-b border-gray-300 w-32 mx-auto mb-1" />
                <p className="text-xs text-gray-600">{data[field.id] || "الاسم"}</p>
              </div>
            ))}
          </div>
        );

      case "footer":
        return null; // handled by ReportFooter

      default:
        return null;
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
      <MinistryHeader
        schoolName={personalInfo?.schoolName}
        region={personalInfo?.region}
        headerBg={themeColors?.headerBg}
        headerText={themeColors?.headerText}
      />

      {/* Title bar */}
      <div className="px-4 py-2">
        <div
          className="text-center py-2 px-4 rounded-lg text-white font-bold text-sm"
          style={{ background: `linear-gradient(135deg, ${accent}, #1a5276)`, fontFamily: "'Tajawal', sans-serif" }}
        >
          {title}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-2" dir="rtl">
        {layout.sections.map(renderSection)}
      </div>

      <ReportFooter accent={themeColors?.headerBg} />
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────
function TableView({
  fields,
  data,
  title,
  personalInfo,
  themeColors,
}: Omit<ReportPreviewProps, "layout" | "onExportPDF" | "onShare" | "isExporting">) {
  const accent = themeColors?.accent || "#148f77";

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
      <MinistryHeader
        schoolName={personalInfo?.schoolName}
        region={personalInfo?.region}
        headerBg={themeColors?.headerBg}
        headerText={themeColors?.headerText}
      />

      <div className="px-4 py-3">
        <div
          className="text-center py-2 px-4 rounded-lg text-white font-bold text-sm mb-3"
          style={{ background: `linear-gradient(135deg, ${accent}, #1a5276)`, fontFamily: "'Tajawal', sans-serif" }}
        >
          {title}
        </div>

        <table className="w-full border-collapse text-sm" dir="rtl">
          <thead>
            <tr>
              <th className="text-right py-2 px-3 font-bold text-white text-xs" style={{ backgroundColor: accent }}>العنصر</th>
              <th className="text-right py-2 px-3 font-bold text-white text-xs" style={{ backgroundColor: accent }}>البيانات</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, idx) => (
              <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="py-2 px-3 font-medium text-gray-700 text-xs border-b border-gray-100 w-1/3">{field.label}</td>
                <td className="py-2 px-3 border-b border-gray-100">
                  <FieldValue field={field} value={data[field.id]} accent={accent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReportFooter accent={themeColors?.headerBg} />
    </div>
  );
}

// ─── Main ReportPreview Component ─────────────────────────────
const ReportPreview = forwardRef<ReportPreviewHandle, ReportPreviewProps>(function ReportPreview(
  {
    fields,
    layout,
    data,
    title,
    personalInfo,
    themeColors,
    onExportPDF,
    onShare,
    isExporting,
  },
  ref
) {
  const [viewMode, setViewMode] = useState<ViewMode>("template");
  const previewRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getPreviewElement: () => previewRef.current,
  }));

  return (
    <div className="space-y-3" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("template")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "template"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              عرض تفاعلي
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "table"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              عرض جدولي
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare} className="text-xs gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              مشاركة
            </Button>
          )}
          {onExportPDF && (
            <Button
              size="sm"
              onClick={onExportPDF}
              disabled={isExporting}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              تصدير PDF
            </Button>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div ref={previewRef} className="preview-content">
        {viewMode === "template" ? (
          <TemplateView
            fields={fields}
            layout={layout}
            data={data}
            title={title}
            personalInfo={personalInfo}
            themeColors={themeColors}
          />
        ) : (
          <TableView
            fields={fields}
            data={data}
            title={title}
            personalInfo={personalInfo}
            themeColors={themeColors}
          />
        )}
      </div>
    </div>
  );
});

export default ReportPreview;
