/**
 * مكون المعاينة وتصدير PDF المشترك
 */
import { useState } from "react";
import { Printer, Eye, Maximize2, Minimize2, Loader2, FileDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { toast } from "sonner";

interface FormPreviewPDFProps {
  previewId: string;
  filename?: string;
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
}

export default function FormPreviewPDF({
  previewId, filename = "document.pdf", children, title = "معاينة المستند", onClose,
}: FormPreviewPDFProps) {
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportToPDF(previewId, filename, (current, total) => setProgress({ current, total }));
      toast.success("تم تصدير PDF بنجاح");
    } catch (err) {
      toast.error("حدث خطأ أثناء التصدير");
    } finally {
      setExporting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handlePrint = () => {
    try { printElement(previewId); } catch { toast.error("حدث خطأ أثناء الطباعة"); }
  };

  return (
    <div className={`${fullscreen ? "fixed inset-0 z-50 bg-gray-100" : ""}`}>
      <div className={`bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between ${fullscreen ? "sticky top-0 z-10 shadow-sm" : "rounded-t-xl"}`}>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> طباعة
          </Button>
          <Button size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white">
            {exporting ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />{progress.total > 0 ? `${progress.current}/${progress.total}` : "جاري التصدير..."}</>) : (<><FileDown className="w-3.5 h-3.5" /> تصدير PDF</>)}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="p-1.5">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5"><X className="w-4 h-4" /></Button>}
        </div>
      </div>
      <div className={`bg-gray-100 overflow-auto ${fullscreen ? "h-[calc(100vh-52px)]" : "max-h-[70vh]"} p-6`}>
        <div className="mx-auto" style={{ maxWidth: "210mm" }}>
          <div id={previewId}>{children}</div>
        </div>
      </div>
    </div>
  );
}
