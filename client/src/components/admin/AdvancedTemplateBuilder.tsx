/**
 * AdvancedTemplateBuilder — محرر قوالب مرئي متقدم (No-Code Builder)
 * ✅ WYSIWYG Canvas مع سحب/تغيير حجم حر
 * ✅ shadcn Sheet للخصائص الجانبية
 * ✅ JSON State Engine مع Undo/Redo
 * ✅ حقول ديناميكية مرتبطة ببيانات المستخدم
 * ✅ رفع صورة خلفية كـ Canvas
 * ✅ QR Code + Repeater Table + Auto-save + Keyboard Shortcuts
 */
import { useState, useRef, useCallback, useEffect, useReducer } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Type, Image as ImageIcon, Trash2, Save, Bold, Italic,
  AlignCenter, AlignRight, AlignLeft, Eye, EyeOff, Upload, Undo2, Redo2,
  Copy, Layers, Square, Minus, X, Lock, Unlock, ArrowUp, ArrowDown,
  RotateCcw, Settings2, Table2,
  PanelRightOpen, PanelRightClose, ZoomIn, ZoomOut, QrCode, Repeat, Grid3X3,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getMoeLogoUrl } from "@/components/MoeLogo";
import { useEditorStore } from "@/stores/editorStore";
import { generateQRDataURL } from "@/lib/qr-utils";
import type { CanvasElement, TemplateSchema } from "@shared/template-types";
import { DYNAMIC_FIELDS, ARABIC_FONTS, COLOR_PALETTE, A4_WIDTH_PX, A4_HEIGHT_PX } from "@shared/template-types";

export type { CanvasElement, TemplateSchema };

/* ═══════════════ CONSTANTS ═══════════════ */
const A4_W = A4_WIDTH_PX;
const A4_H = A4_HEIGHT_PX;
const FONTS = ARABIC_FONTS;
const COLORS = COLOR_PALETTE;
const AUTOSAVE_KEY = "sers-builder-autosave";
const AUTOSAVE_INTERVAL = 30_000;

/* ═══════════════ STATE REDUCER ═══════════════ */
type Action =
  | { type: "SET_TEMPLATE"; payload: TemplateSchema }
  | { type: "UPDATE_ELEMENT"; id: string; updates: Partial<CanvasElement> }
  | { type: "UPDATE_PROPS"; id: string; props: Partial<CanvasElement["props"]> }
  | { type: "ADD_ELEMENT"; element: CanvasElement }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "MOVE_ELEMENT"; id: string; position: { x: number; y: number } }
  | { type: "RESIZE_ELEMENT"; id: string; size: { width: number; height: number } }
  | { type: "SET_CANVAS"; canvas: Partial<TemplateSchema["canvas"]> }
  | { type: "SET_NAME"; name: string };

function templateReducer(state: TemplateSchema, action: Action): TemplateSchema {
  switch (action.type) {
    case "SET_TEMPLATE": return action.payload;
    case "SET_NAME": return { ...state, name: action.name };
    case "SET_CANVAS": return { ...state, canvas: { ...state.canvas, ...action.canvas } };
    case "ADD_ELEMENT": return { ...state, elements: [...state.elements, action.element] };
    case "DELETE_ELEMENT": return { ...state, elements: state.elements.filter(e => e.id !== action.id) };
    case "MOVE_ELEMENT": return { ...state, elements: state.elements.map(e => e.id === action.id ? { ...e, position: action.position } : e) };
    case "RESIZE_ELEMENT": return { ...state, elements: state.elements.map(e => e.id === action.id ? { ...e, size: action.size } : e) };
    case "UPDATE_ELEMENT": return { ...state, elements: state.elements.map(e => e.id === action.id ? { ...e, ...action.updates } : e) };
    case "UPDATE_PROPS": return { ...state, elements: state.elements.map(e => e.id === action.id ? { ...e, props: { ...e.props, ...action.props } } : e) };
    default: return state;
  }
}

function makeDefaultTemplate(): TemplateSchema {
  return {
    id: `tpl_${Date.now()}`, name: "قالب جديد",
    canvas: { width: A4_W, height: A4_H, bgColor: "#ffffff" },
    elements: [
      { id: "hdr", type: "shape", position: { x: 0, y: 0 }, size: { width: A4_W, height: 100 }, props: { bgColor: "#1a6b6a", borderRadius: 0 }, locked: false, visible: true, zIndex: 1 },
      { id: "hdr_txt", type: "text", position: { x: 20, y: 15 }, size: { width: 350, height: 70 }, props: { content: "المملكة العربية السعودية\nوزارة التعليم", fontFamily: "Cairo", fontSize: 16, fontWeight: 700, color: "#ffffff", textAlign: "right", lineHeight: 1.8 }, locked: false, visible: true, zIndex: 10 },
      { id: "logo", type: "logo", position: { x: 330, y: 10 }, size: { width: 80, height: 80 }, props: { opacity: 1 }, locked: false, visible: true, zIndex: 10 },
      { id: "title", type: "text", position: { x: 50, y: 120 }, size: { width: 694, height: 45 }, props: { content: "شواهد الأداء الوظيفي", fontFamily: "Cairo", fontSize: 20, fontWeight: 800, color: "#1a1a1a", textAlign: "center", bgColor: "transparent", borderWidth: 2, borderColor: "#1a6b6a80", borderRadius: 22, padding: 10 }, locked: false, visible: true, zIndex: 5 },
      { id: "f_name", type: "dynamic-field", position: { x: 30, y: 185 }, size: { width: 350, height: 40 }, props: { content: "الاسم", binding: { type: "dynamic", fieldId: "name" }, fontFamily: "Cairo", fontSize: 13, color: "#1a6b6a", bgColor: "#f0fdf4", borderColor: "#1a6b6a30", borderRadius: 4 }, locked: false, visible: true, zIndex: 5 },
      { id: "f_school", type: "dynamic-field", position: { x: 410, y: 185 }, size: { width: 350, height: 40 }, props: { content: "المدرسة", binding: { type: "dynamic", fieldId: "school" }, fontFamily: "Cairo", fontSize: 13, color: "#1a6b6a", bgColor: "#f0fdf4", borderColor: "#1a6b6a30", borderRadius: 4 }, locked: false, visible: true, zIndex: 5 },
      { id: "footer", type: "shape", position: { x: 0, y: A4_H - 40 }, size: { width: A4_W, height: 40 }, props: { bgColor: "#1a6b6a" }, locked: false, visible: true, zIndex: 1 },
      { id: "ftr_txt", type: "text", position: { x: 50, y: A4_H - 35 }, size: { width: 694, height: 30 }, props: { content: "نظام SERS — السجلات التعليمية الذكية", fontFamily: "Cairo", fontSize: 11, color: "#ffffff", textAlign: "center" }, locked: false, visible: true, zIndex: 10 },
    ],
    metadata: { version: 1 },
  };
}

/* ═══════════════ PROPS ═══════════════ */
interface Props {
  templateId?: string;
  onBack?: () => void;
  templateName?: string;
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function AdvancedTemplateBuilder({ templateId, onBack, templateName }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [template, dispatch] = useReducer(templateReducer, null, makeDefaultTemplate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.6);
  const [showGrid, setShowGrid] = useState(false);
  const [propsOpen, setPropsOpen] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  // Drag state
  const [dragInfo, setDragInfo] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Resize state
  const [resizeInfo, setResizeInfo] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number; handle: string } | null>(null);

  // Undo/Redo
  const [history, setHistory] = useState<TemplateSchema[]>([]);
  const [future, setFuture] = useState<TemplateSchema[]>([]);

  const pushUndo = useCallback(() => {
    setHistory(p => [...p.slice(-30), structuredClone(template)]);
    setFuture([]);
    useEditorStore.setState({ isDirty: true });
  }, [template]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setFuture(p => [structuredClone(template), ...p]);
    dispatch({ type: "SET_TEMPLATE", payload: history[history.length - 1] });
    setHistory(p => p.slice(0, -1));
  }, [history, template]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setHistory(p => [...p, structuredClone(template)]);
    dispatch({ type: "SET_TEMPLATE", payload: future[0] });
    setFuture(p => p.slice(1));
  }, [future, template]);

  // DB save/load
  const updateCanvasData = trpc.templates.updateCanvasData.useMutation();
  const { data: canvasData } = trpc.templates.getCanvasData.useQuery(
    { id: Number(templateId) }, { enabled: !!templateId && !isNaN(Number(templateId)) }
  );
  useEffect(() => {
    if (canvasData?.elements) dispatch({ type: "SET_TEMPLATE", payload: canvasData as any });
  }, [canvasData]);

  useEffect(() => { if (templateName) dispatch({ type: "SET_NAME", name: templateName }); }, [templateName]);

  // ─── Editor Store integration (reactive hooks) ───
  const isDirty = useEditorStore(s => s.isDirty);
  const setSaving = useEditorStore(s => s.setSaving);
  const markClean = useEditorStore(s => s.markClean);

  // ─── Auto-save to localStorage (throttled) ───
  useEffect(() => {
    const timer = setInterval(() => {
      const doSave = () => {
        try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(template)); } catch { /* quota exceeded */ }
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(doSave, { timeout: 2000 });
      } else {
        doSave();
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [template]);

  // ─── Draft Recovery on mount ───
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftData, setDraftData] = useState<TemplateSchema | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TemplateSchema;
        if (parsed?.elements?.length > 0) {
          setDraftData(parsed);
          setShowDraftDialog(true);
        }
      }
    } catch { /* ignore corrupt data */ }
  }, []); // only on mount

  // ─── Save (with fieldId uniqueness validation) ───
  const handleSave = useCallback(async () => {
    // Validate fieldId uniqueness
    const dynamicFields = template.elements.filter(e => e.props.binding?.type === 'dynamic' && e.props.binding?.fieldId);
    const fieldIds = dynamicFields.map(e => e.props.binding!.fieldId!);
    const duplicates = fieldIds.filter((id, i) => fieldIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      toast.warning(`⚠️ يوجد حقول مكررة: ${Array.from(new Set(duplicates)).join(', ')} — يُفضل إصلاحها قبل الحفظ`, { duration: 5000 });
    }
    try {
      setSaving(true);
      if (templateId && !isNaN(Number(templateId))) {
        await updateCanvasData.mutateAsync({ id: Number(templateId), canvasData: template as any });
      }
      markClean();
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
      toast.success("✨ تم حفظ القالب");
    } catch { toast.error("فشل الحفظ"); }
    finally { setSaving(false); }
  }, [templateId, template, setSaving, markClean, updateCanvasData]);

  // ─── Keyboard Shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Delete selected element
      if (e.key === "Delete" && selectedId && !e.ctrlKey && !e.metaKey) {
        const el = template.elements.find(el => el.id === selectedId);
        if (el && !el.locked) {
          e.preventDefault();
          pushUndo();
          dispatch({ type: "DELETE_ELEMENT", id: selectedId });
          setSelectedId(null);
          toast.success("تم حذف العنصر");
        }
      }
      // Ctrl+Z = Undo, Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      // Ctrl+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, template, pushUndo, undo, redo, handleSave]);

  const selectedEl = template.elements.find(e => e.id === selectedId);

  // ─── Drag Handler ───
  useEffect(() => {
    if (!dragInfo) return;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - dragInfo.startX) / scale;
      const dy = (e.clientY - dragInfo.startY) / scale;
      dispatch({ type: "MOVE_ELEMENT", id: dragInfo.id, position: { x: Math.max(0, dragInfo.origX + dx), y: Math.max(0, dragInfo.origY + dy) } });
    };
    const onUp = () => setDragInfo(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragInfo, scale]);

  // ─── Resize Handler ───
  useEffect(() => {
    if (!resizeInfo) return;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - resizeInfo.startX) / scale;
      const dy = (e.clientY - resizeInfo.startY) / scale;
      let w = resizeInfo.origW, h = resizeInfo.origH;
      if (resizeInfo.handle.includes("e")) w = Math.max(30, resizeInfo.origW + dx);
      if (resizeInfo.handle.includes("w")) w = Math.max(30, resizeInfo.origW - dx);
      if (resizeInfo.handle.includes("s")) h = Math.max(20, resizeInfo.origH + dy);
      if (resizeInfo.handle.includes("n")) h = Math.max(20, resizeInfo.origH - dy);
      dispatch({ type: "RESIZE_ELEMENT", id: resizeInfo.id, size: { width: Math.round(w), height: Math.round(h) } });
    };
    const onUp = () => setResizeInfo(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [resizeInfo, scale]);

  const startDrag = (e: React.PointerEvent, el: CanvasElement) => {
    if (el.locked) return;
    e.stopPropagation();
    pushUndo();
    setSelectedId(el.id);
    setDragInfo({ id: el.id, startX: e.clientX, startY: e.clientY, origX: el.position.x, origY: el.position.y });
  };

  const startResize = (e: React.PointerEvent, el: CanvasElement, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    pushUndo();
    setResizeInfo({ id: el.id, startX: e.clientX, startY: e.clientY, origW: el.size.width, origH: el.size.height, handle });
  };

  // ─── Add Element ───
  const addElement = (type: CanvasElement["type"], extra?: Partial<CanvasElement["props"]>) => {
    pushUndo();
    const maxZ = Math.max(0, ...template.elements.map(e => e.zIndex));
    const sizeMap: Record<string, { w: number; h: number }> = {
      divider: { w: 700, h: 3 }, shape: { w: 200, h: 100 }, table: { w: 400, h: 150 },
      qrcode: { w: 120, h: 120 }, "repeater-table": { w: 700, h: 200 },
    };
    const { w, h } = sizeMap[type] || { w: 300, h: 40 };
    const el: CanvasElement = {
      id: `${type}_${Date.now()}`, type,
      position: { x: 100, y: 250 },
      size: { width: w, height: h },
      props: {
        fontFamily: "Cairo", fontSize: 14, color: "#1a1a1a", textAlign: "right",
        content: type === "text" ? "نص جديد — انقر مرتين للتعديل" : type === "dynamic-field" ? "حقل" : type === "qrcode" ? "QR Code" : type === "repeater-table" ? "جدول تكراري" : "",
        bgColor: type === "shape" ? "#1a6b6a15" : type === "divider" ? "#1a6b6a" : "transparent",
        borderRadius: type === "shape" ? 8 : type === "qrcode" ? 4 : 0,
        binding: type === "dynamic-field" ? { type: "dynamic" as const, fieldId: "" } : { type: "static" as const },
        qrData: type === "qrcode" ? "https://sers.sa" : undefined,
        qrSize: type === "qrcode" ? 4 : undefined,
        rows: type === "repeater-table" ? 5 : extra?.rows,
        cols: type === "repeater-table" ? 4 : extra?.cols,
        repeaterFieldId: type === "repeater-table" ? "" : undefined,
        ...extra,
      },
      locked: false, visible: true, zIndex: maxZ + 1,
    };
    dispatch({ type: "ADD_ELEMENT", element: el });
    setSelectedId(el.id);
    toast.success("تم إضافة العنصر — اسحبه لمكانه");
  };

  // ─── Upload BG ───
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("الحد الأقصى 20MB"); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("⚠️ الصورة كبيرة — يُفضل استخدام صورة أصغر من 5MB لأداء أفضل", { duration: 5000 });
    }
    pushUndo();
    useEditorStore.setState({ isDirty: true });
    const reader = new FileReader();
    reader.onload = () => { dispatch({ type: "SET_CANVAS", canvas: { bgImage: reader.result as string } }); toast.success("تم رفع الخلفية"); };
    reader.readAsDataURL(file);
  };

  const p = selectedEl?.props || {};

  // ─── Render Element ───
  const renderEl = (el: CanvasElement) => {
    if (!el.visible) return null;
    const pr = el.props;
    const isSelected = selectedId === el.id;
    const commonStyle: React.CSSProperties = {
      position: "absolute", left: el.position.x, top: el.position.y,
      width: el.size.width, height: el.size.height,
      zIndex: el.zIndex, opacity: pr.opacity ?? 1,
      outline: isSelected ? "2px solid #3B82F6" : "none",
      outlineOffset: isSelected ? 1 : 0,
      cursor: el.locked ? "default" : (dragInfo?.id === el.id ? "grabbing" : "grab"),
    };

    let inner: React.ReactNode = null;
    if (el.type === "shape" || el.type === "divider") {
      inner = <div style={{ width: "100%", height: "100%", background: pr.bgColor || "transparent", borderRadius: pr.borderRadius || 0, border: pr.borderWidth ? `${pr.borderWidth}px solid ${pr.borderColor || "#ccc"}` : undefined }} />;
    } else if (el.type === "logo") {
      let logoUrl = ""; try { logoUrl = getMoeLogoUrl(); } catch {}
      inner = logoUrl ? <img src={logoUrl} alt="شعار" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)", borderRadius: "50%" }}><span style={{ fontSize: 32 }}>🏛️</span></div>;
    } else if (el.type === "image") {
      inner = pr.src ? <img src={pr.src} alt="" style={{ width: "100%", height: "100%", objectFit: (pr.objectFit as any) || "cover", borderRadius: pr.borderRadius }} /> : <div className="flex items-center justify-center bg-gray-100 text-gray-400 text-xs h-full rounded" style={{ borderRadius: pr.borderRadius }}>📷 اضغط لإضافة صورة</div>;
    } else if (el.type === "dynamic-field") {
      const dynField = DYNAMIC_FIELDS.find(f => f.id === pr.binding?.fieldId);
      inner = (
        <div style={{ display: "flex", gap: 6, alignItems: "center", height: "100%", fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif` }}>
          <span style={{ padding: "4px 10px", background: pr.bgColor || "#f0fdf4", border: `1.5px solid ${pr.borderColor || "#1a6b6a30"}`, borderRadius: pr.borderRadius || 4, fontWeight: 700, fontSize: pr.fontSize || 13, color: pr.color || "#1a6b6a", whiteSpace: "nowrap" }}>{pr.content}</span>
          <span style={{ flex: 1, padding: "4px 8px", borderBottom: `1px dotted ${pr.borderColor || "#ccc"}`, fontSize: 13, color: "#3B82F6", fontStyle: "italic" }}>
            {dynField ? `⚡ ${dynField.label}` : (pr.binding?.fieldId ? `{{${pr.binding.fieldId}}}` : "...")}
          </span>
        </div>
      );
    } else if (el.type === "table") {
      const rows = pr.rows || 3, cols = pr.cols || 3;
      inner = (
        <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: pr.fontSize || 12, fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif`, color: pr.color || "#374151" }}>
          <tbody>{Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>{Array.from({ length: cols }).map((_, c) => (
              <td key={c} style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "center" }}>{r === 0 ? `عمود ${c + 1}` : ""}</td>
            ))}</tr>
          ))}</tbody>
        </table>
      );
    } else if (el.type === "qrcode") {
      const qrUrl = pr.qrData ? generateQRDataURL(pr.qrData, pr.qrSize || 4) : "";
      inner = (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: pr.bgColor || "#fff", borderRadius: pr.borderRadius || 4, border: `1px solid ${pr.borderColor || "#e5e7eb"}`, padding: 4 }}>
          {qrUrl ? <img src={qrUrl} alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 32 }}>📱</span>}
        </div>
      );
    } else if (el.type === "repeater-table") {
      const rows = pr.rows || 5, cols = pr.cols || 4;
      const repeaterField = DYNAMIC_FIELDS.find(f => f.id === pr.repeaterFieldId);
      inner = (
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6", padding: "2px 6px", background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", textAlign: "center", fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif` }}>
            🔄 جدول تكراري {repeaterField ? `— ${repeaterField.label}` : ""}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: pr.fontSize || 11, fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif`, color: pr.color || "#374151" }}>
            <tbody>{Array.from({ length: Math.min(rows, 6) }).map((_, r) => (
              <tr key={r} style={{ background: r === 0 ? "#f0fdf4" : "transparent" }}>{Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ border: "1px solid #d1d5db", padding: "3px 6px", textAlign: "center", fontWeight: r === 0 ? 700 : 400 }}>{r === 0 ? `عمود ${c + 1}` : `...`}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
      );
    } else {
      // text
      inner = (
        <div style={{
          width: "100%", height: "100%", color: pr.color || "#1a1a1a", fontSize: pr.fontSize || 14,
          fontWeight: pr.fontWeight || 400, fontStyle: pr.fontStyle || "normal",
          textAlign: (pr.textAlign as any) || "right", lineHeight: pr.lineHeight || 1.6,
          background: pr.bgColor || "transparent", fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif`,
          borderRadius: pr.borderRadius || 0, padding: pr.padding || 0,
          border: pr.borderWidth ? `${pr.borderWidth}px solid ${pr.borderColor || "#ccc"}` : "none",
          whiteSpace: "pre-wrap", overflow: "hidden",
        }}>{pr.content}</div>
      );
    }

    return (
      <div key={el.id} style={commonStyle} onPointerDown={e => startDrag(e, el)}
        onDoubleClick={() => { setSelectedId(el.id); setPropsOpen(true); }}>
        {inner}
        {/* Resize handles */}
        {isSelected && !el.locked && (
          <>
            {["se","sw","ne","nw","e","w","s","n"].map(h => {
              const style: React.CSSProperties = { position: "absolute", width: h.length === 1 ? 8 : 10, height: h.length === 1 ? 8 : 10, background: "#3B82F6", border: "2px solid white", borderRadius: h.length === 2 ? 2 : 1, zIndex: 100, cursor: `${h}-resize` };
              if (h.includes("s")) style.bottom = -5;
              if (h.includes("n")) style.top = -5;
              if (h.includes("e")) style.right = -5;
              if (h.includes("w")) style.left = -5;
              if (h === "s" || h === "n") { style.left = "50%"; style.marginLeft = -4; }
              if (h === "e" || h === "w") { style.top = "50%"; style.marginTop = -4; }
              if (h === "se") { style.bottom = -5; style.right = -5; }
              if (h === "sw") { style.bottom = -5; style.left = -5; }
              if (h === "ne") { style.top = -5; style.right = -5; }
              if (h === "nw") { style.top = -5; style.left = -5; }
              return <div key={h} style={style} onPointerDown={e => startResize(e, el, h)} />;
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100 overflow-hidden" dir="rtl">
      {/* ═══ TOP TOOLBAR ═══ */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap shrink-0">
        {onBack && <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs"><X className="w-3.5 h-3.5" />العودة</Button>}
        <input value={template.name} onChange={e => dispatch({ type: "SET_NAME", name: e.target.value })} className="text-sm font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-40 px-1 py-0.5 transition-colors" />
        <div className="h-5 w-px bg-gray-200" />

        {/* Add tools */}
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1" onClick={() => addElement("text")}><Type className="w-3.5 h-3.5" />نص</Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1 border-blue-200 text-blue-600">⚡ حقل ديناميكي</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start" dir="rtl">
            {DYNAMIC_FIELDS.map(f => (
              <button key={f.id} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-blue-50 text-right transition-colors"
                onClick={() => addElement("dynamic-field", { content: f.label, binding: { type: "dynamic", fieldId: f.id } })}>
                <span>{f.icon}</span><span>{f.label}</span>
                <span className="text-[9px] text-gray-400 mr-auto font-mono">{`{{${f.id}}}`}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1" onClick={() => addElement("shape")}><Square className="w-3.5 h-3.5" />شكل</Button>
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1" onClick={() => addElement("table", { rows: 4, cols: 3 })}><Table2 className="w-3.5 h-3.5" />جدول</Button>
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1" onClick={() => addElement("divider")}><Minus className="w-3.5 h-3.5" />فاصل</Button>
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1" onClick={() => addElement("image")}><ImageIcon className="w-3.5 h-3.5" />صورة</Button>
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1 border-purple-200 text-purple-600" onClick={() => addElement("qrcode")}><QrCode className="w-3.5 h-3.5" />QR</Button>
        <Button size="sm" variant="outline" className="text-[11px] h-8 gap-1 border-orange-200 text-orange-600" onClick={() => addElement("repeater-table")}><Repeat className="w-3.5 h-3.5" />تكراري</Button>

        <div className="h-5 w-px bg-gray-200" />
        <Button size="sm" className="text-[11px] h-8 gap-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white" onClick={() => bgInputRef.current?.click()}><Upload className="w-3.5 h-3.5" />رفع خلفية</Button>
        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />

        <div className="flex-1" />

        {/* Undo/Redo */}
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={undo} disabled={!history.length} className="p-1.5 hover:bg-gray-100 disabled:opacity-30" title="تراجع"><Undo2 className="w-3.5 h-3.5 text-gray-600" /></button>
          <button onClick={redo} disabled={!future.length} className="p-1.5 hover:bg-gray-100 disabled:opacity-30" title="إعادة"><Redo2 className="w-3.5 h-3.5 text-gray-600" /></button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-0.5 border text-[10px]">
          <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-0.5 hover:bg-gray-200 rounded"><ZoomOut className="w-3 h-3" /></button>
          <span className="w-8 text-center text-gray-600 font-medium">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(1.2, s + 0.1))} className="p-0.5 hover:bg-gray-200 rounded"><ZoomIn className="w-3 h-3" /></button>
        </div>

        <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 rounded-lg border ${showGrid ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-400'}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => setPropsOpen(!propsOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">{propsOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}</button>

        <Button size="sm" className={`h-8 gap-1.5 text-sm shadow-sm ${isDirty ? 'bg-orange-500 hover:bg-orange-600 animate-pulse' : 'bg-teal-600 hover:bg-teal-700'} text-white`} onClick={handleSave} disabled={updateCanvasData.isPending}>
          <Save className="w-3.5 h-3.5" />{updateCanvasData.isPending ? "جاري..." : isDirty ? "● حفظ" : "حفظ"}
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ═══ CANVAS ═══ */}
        <div className="flex-1 overflow-auto flex justify-center items-start p-6" style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, #f1f5f9 0% 50%) 50% / 16px 16px" }}>
          <div ref={canvasRef} style={{
            width: template.canvas.width, height: template.canvas.height,
            transform: `scale(${scale})`, transformOrigin: "top center",
            background: template.canvas.bgImage ? `url(${template.canvas.bgImage}) center/cover no-repeat` : template.canvas.bgColor,
            position: "relative", boxShadow: "0 16px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
            borderRadius: 2, fontFamily: "'Cairo', sans-serif",
            ...(showGrid ? { backgroundImage: `${template.canvas.bgImage ? `url(${template.canvas.bgImage}), ` : ""}linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)`, backgroundSize: `${template.canvas.bgImage ? "cover, " : ""}20px 20px, 20px 20px` } : {}),
          }} onClick={() => setSelectedId(null)}>
            {template.elements.sort((a, b) => a.zIndex - b.zIndex).map(renderEl)}
          </div>
        </div>

        {/* ═══ PROPERTIES SHEET (sidebar) ═══ */}
        {propsOpen && (
          <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
            {selectedEl ? (
              <div>
                {/* Header */}
                <div className="p-3 border-b bg-gray-50/70 flex items-center justify-between sticky top-0 z-10">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-blue-500" />
                    خصائص {selectedEl.type === "text" ? "النص" : selectedEl.type === "dynamic-field" ? "الحقل الديناميكي" : selectedEl.type === "image" ? "الصورة" : selectedEl.type === "shape" ? "الشكل" : selectedEl.type === "table" ? "الجدول" : selectedEl.type === "logo" ? "الشعار" : selectedEl.type === "qrcode" ? "رمز QR" : selectedEl.type === "repeater-table" ? "الجدول التكراري" : "الفاصل"}
                  </span>
                  <div className="flex gap-0.5">
                    <button onClick={() => { pushUndo(); dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { locked: !selectedEl.locked } }); }} className={`p-1 rounded ${selectedEl.locked ? 'bg-amber-50 text-amber-600' : 'text-gray-400'}`}>{selectedEl.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}</button>
                    <button onClick={() => { pushUndo(); dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { visible: !selectedEl.visible } }); }} className="p-1 rounded text-gray-400">{selectedEl.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</button>
                    <button onClick={() => { pushUndo(); const el = template.elements.find(e => e.id === selectedEl.id); if (el) { const n = { ...el, id: `${el.type}_${Date.now()}`, position: { x: el.position.x + 20, y: el.position.y + 20 } }; dispatch({ type: "ADD_ELEMENT", element: n }); setSelectedId(n.id); } }} className="p-1 rounded text-gray-400"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => setDeleteDialog(selectedEl.id)} className="p-1 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>

                <Tabs defaultValue="style" className="w-full" dir="rtl">
                  <TabsList className="w-full grid grid-cols-3 m-2 mx-3">
                    <TabsTrigger value="style" className="text-[10px]">المظهر</TabsTrigger>
                    <TabsTrigger value="position" className="text-[10px]">الموقع</TabsTrigger>
                    <TabsTrigger value="binding" className="text-[10px]">الربط</TabsTrigger>
                  </TabsList>

                  {/* ─── Style Tab ─── */}
                  <TabsContent value="style" className="p-3 space-y-4 mt-0">
                    {(selectedEl.type === "text" || selectedEl.type === "dynamic-field") && (<>
                      {/* Content */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">المحتوى</label>
                        <textarea value={p.content || ""} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { content: e.target.value } }); }}
                          className="w-full px-2 py-1.5 border rounded-lg text-xs resize-none h-16 focus:ring-2 focus:ring-blue-200 focus:outline-none" dir="rtl" />
                      </div>
                      {/* Font */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">الخط</label>
                        <Select value={p.fontFamily || "Cairo"} onValueChange={v => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { fontFamily: v } }); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FONTS.map(f => <SelectItem key={f.id} value={f.id} style={{ fontFamily: `'${f.id}', sans-serif` }}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {/* Font size */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">الحجم: {p.fontSize || 14}px</label>
                        <Slider value={[p.fontSize || 14]} onValueChange={([v]) => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { fontSize: v } }); }} min={8} max={72} step={1} className="mt-1" />
                      </div>
                      {/* Bold/Italic/Align */}
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { fontWeight: p.fontWeight === 700 ? 400 : 700 } }); }}
                          className={`p-1.5 rounded-lg border ${p.fontWeight === 700 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500'}`}><Bold className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { fontStyle: p.fontStyle === "italic" ? "normal" : "italic" } }); }}
                          className={`p-1.5 rounded-lg border ${p.fontStyle === "italic" ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500'}`}><Italic className="w-3.5 h-3.5" /></button>
                        <div className="flex border rounded-lg overflow-hidden mr-1">
                          {[{ icon: AlignRight, v: "right" }, { icon: AlignCenter, v: "center" }, { icon: AlignLeft, v: "left" }].map(a => (
                            <button key={a.v} onClick={() => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { textAlign: a.v } }); }}
                              className={`p-1.5 ${p.textAlign === a.v ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><a.icon className="w-3 h-3" /></button>
                          ))}
                        </div>
                      </div>
                      {/* Line height */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">ارتفاع السطر: {p.lineHeight || 1.6}</label>
                        <Slider value={[p.lineHeight || 1.6]} onValueChange={([v]) => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { lineHeight: v } }); }} min={1} max={3} step={0.1} />
                      </div>
                    </>)}
                    {/* Colors */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">لون النص</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={p.color || "#1a1a1a"} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { color: e.target.value } }); }} className="w-8 h-8 rounded border cursor-pointer p-0.5" />
                        <input type="text" value={p.color || ""} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { color: e.target.value } }); }} className="flex-1 px-2 py-1 bg-gray-50 rounded border text-[10px] font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">لون الخلفية</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={p.bgColor || "#ffffff"} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { bgColor: e.target.value } }); }} className="w-8 h-8 rounded border cursor-pointer p-0.5" />
                        <input type="text" value={p.bgColor || ""} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { bgColor: e.target.value } }); }} className="flex-1 px-2 py-1 bg-gray-50 rounded border text-[10px] font-mono" placeholder="شفاف" />
                      </div>
                    </div>
                    {/* Color presets */}
                    <div className="flex flex-wrap gap-1">
                      {COLORS.map(c => <button key={c} className="w-5 h-5 rounded border border-gray-200 hover:scale-125 transition-transform" style={{ backgroundColor: c }} onClick={() => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { [selectedEl.type === "shape" ? "bgColor" : "color"]: c } }); }} />)}
                    </div>
                    {/* Opacity */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">الشفافية: {Math.round((p.opacity ?? 1) * 100)}%</label>
                      <Slider value={[(p.opacity ?? 1) * 100]} onValueChange={([v]) => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { opacity: v / 100 } }); }} min={0} max={100} />
                    </div>
                    {/* Border */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">زوايا الإطار</label>
                      <Slider value={[p.borderRadius || 0]} onValueChange={([v]) => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { borderRadius: v } }); }} min={0} max={50} />
                    </div>
                    {/* Border Width & Color */}
                    {(selectedEl.type === "text" || selectedEl.type === "dynamic-field" || selectedEl.type === "shape") && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-gray-400 block mb-0.5">سمك الحد</label>
                          <input type="number" value={p.borderWidth || 0} min={0} max={10}
                            onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { borderWidth: Number(e.target.value) } }); }}
                            className="w-full px-2 py-1 border rounded text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-400 block mb-0.5">لون الحد</label>
                          <div className="flex gap-1">
                            <input type="color" value={p.borderColor || '#cccccc'}
                              onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { borderColor: e.target.value } }); }}
                              className="w-7 h-7 rounded border cursor-pointer p-0.5" />
                            <input type="text" value={p.borderColor || ''}
                              onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { borderColor: e.target.value } }); }}
                              className="flex-1 px-1.5 py-1 bg-gray-50 rounded border text-[9px] font-mono" />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Table config */}
                    {selectedEl.type === "table" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[9px] text-gray-400">صفوف</label><input type="number" value={p.rows || 3} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { rows: Number(e.target.value) } }); }} className="w-full px-2 py-1 border rounded text-xs" /></div>
                        <div><label className="text-[9px] text-gray-400">أعمدة</label><input type="number" value={p.cols || 3} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { cols: Number(e.target.value) } }); }} className="w-full px-2 py-1 border rounded text-xs" /></div>
                      </div>
                    )}
                    {/* QR Code config */}
                    {selectedEl.type === "qrcode" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 block">📱 بيانات رمز QR</label>
                        <input type="text" value={p.qrData || ""} placeholder="https://... أو نص"
                          onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { qrData: e.target.value } }); }}
                          className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-purple-200 focus:outline-none" dir="ltr" />
                        <div>
                          <label className="text-[9px] text-gray-400">حجم الخلية: {p.qrSize || 4}</label>
                          <Slider value={[p.qrSize || 4]} onValueChange={([v]) => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { qrSize: v } }); }} min={2} max={8} step={1} />
                        </div>
                      </div>
                    )}
                    {/* Repeater Table config */}
                    {selectedEl.type === "repeater-table" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 block">🔄 جدول تكراري</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-[9px] text-gray-400">صفوف</label><input type="number" value={p.rows || 5} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { rows: Number(e.target.value) } }); }} className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="text-[9px] text-gray-400">أعمدة</label><input type="number" value={p.cols || 4} onChange={e => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { cols: Number(e.target.value) } }); }} className="w-full px-2 py-1 border rounded text-xs" /></div>
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-400 block mb-1">ربط بمصدر البيانات</label>
                          <Select value={p.repeaterFieldId || ""} onValueChange={v => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { repeaterFieldId: v } }); }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حقل..." /></SelectTrigger>
                    <SelectContent>{DYNAMIC_FIELDS.map(f => <SelectItem key={f.id} value={f.id}>{f.icon} {f.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ─── Position Tab ─── */}
                  <TabsContent value="position" className="p-3 space-y-3 mt-0">
                    <div className="grid grid-cols-2 gap-2">
                      {[{ l: "X", k: "x", v: selectedEl.position.x }, { l: "Y", k: "y", v: selectedEl.position.y }].map(f => (
                        <div key={f.k}><label className="text-[9px] text-gray-400">{f.l} (px)</label>
                          <input type="number" value={Math.round(f.v)} onChange={e => { pushUndo(); dispatch({ type: "MOVE_ELEMENT", id: selectedEl.id, position: { ...selectedEl.position, [f.k]: Number(e.target.value) } }); }}
                            className="w-full px-2 py-1 bg-gray-50 rounded border text-xs" /></div>
                      ))}
                      {[{ l: "العرض", k: "width", v: selectedEl.size.width }, { l: "الارتفاع", k: "height", v: selectedEl.size.height }].map(f => (
                        <div key={f.k}><label className="text-[9px] text-gray-400">{f.l} (px)</label>
                          <input type="number" value={Math.round(f.v)} onChange={e => { pushUndo(); dispatch({ type: "RESIZE_ELEMENT", id: selectedEl.id, size: { ...selectedEl.size, [f.k]: Number(e.target.value) } }); }}
                            className="w-full px-2 py-1 bg-gray-50 rounded border text-xs" /></div>
                      ))}
                    </div>
                    {/* Z-index */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">ترتيب الطبقة: {selectedEl.zIndex}</label>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7" onClick={() => { pushUndo(); dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { zIndex: selectedEl.zIndex + 1 } }); }}><ArrowUp className="w-3 h-3" />أمام</Button>
                        <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7" onClick={() => { pushUndo(); dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { zIndex: Math.max(0, selectedEl.zIndex - 1) } }); }}><ArrowDown className="w-3 h-3" />خلف</Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ─── Binding Tab ─── */}
                  <TabsContent value="binding" className="p-3 space-y-3 mt-0">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-2">نوع الحقل</label>
                      <Select value={p.binding?.type || "static"} onValueChange={v => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { binding: { type: v as any, fieldId: p.binding?.fieldId } } }); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="static">ثابت — لا يتغير</SelectItem>
                          <SelectItem value="dynamic">⚡ ديناميكي — يرتبط ببيانات المستخدم</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {p.binding?.type === "dynamic" && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-2">ربط بحقل</label>
                        <Select value={p.binding?.fieldId || ""} onValueChange={v => { pushUndo(); dispatch({ type: "UPDATE_PROPS", id: selectedEl.id, props: { binding: { ...p.binding!, fieldId: v } } }); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حقل..." /></SelectTrigger>
                          <SelectContent>{DYNAMIC_FIELDS.map(f => <SelectItem key={f.id} value={f.id}>{f.icon} {f.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <p className="text-[9px] text-blue-500 mt-1">⚡ سيُملأ تلقائياً من بيانات المستخدم عند التصدير</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              /* ═══ No Selection → Template Settings (Figma-Style) ═══ */
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-3 border-b bg-gray-50/70 sticky top-0 z-10">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-teal-600" />
                    إعدادات القالب
                  </span>
                </div>

                <div className="p-3 space-y-4 overflow-y-auto flex-1">
                  {/* Template Name */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">اسم القالب</label>
                    <input
                      value={template.name}
                      onChange={e => dispatch({ type: "SET_NAME", name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                      dir="rtl"
                      placeholder="اسم القالب..."
                    />
                  </div>

                  {/* Background Image */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1.5">صورة الخلفية</label>
                    {template.canvas.bgImage ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border overflow-hidden" style={{ height: 100 }}>
                          <img src={template.canvas.bgImage} alt="خلفية" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => bgInputRef.current?.click()}>
                            <Upload className="w-3 h-3" />تغيير
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7 text-red-500 border-red-200" onClick={() => { pushUndo(); dispatch({ type: "SET_CANVAS", canvas: { bgImage: undefined } }); }}>
                            <X className="w-3 h-3" />إزالة
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => bgInputRef.current?.click()}
                        className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50/30 transition-all cursor-pointer"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] font-medium">رفع صورة خلفية (PNG/JPG)</span>
                      </button>
                    )}
                  </div>

                  {/* Canvas BG Color */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">لون خلفية الـ Canvas</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={template.canvas.bgColor} onChange={e => dispatch({ type: "SET_CANVAS", canvas: { bgColor: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0.5" />
                      <input type="text" value={template.canvas.bgColor} onChange={e => dispatch({ type: "SET_CANVAS", canvas: { bgColor: e.target.value } })} className="flex-1 px-2 py-1.5 bg-gray-50 rounded-lg border text-[10px] font-mono" />
                    </div>
                  </div>

                  {/* Page Size */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">مقاس الورقة</label>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg p-3 border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-600 font-medium">A4 — 210mm × 297mm</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-bold">افتراضي</span>
                      </div>
                      <div className="text-[9px] text-gray-400">{template.canvas.width}px × {template.canvas.height}px</div>
                    </div>
                  </div>

                  {/* Template Stats */}
                  <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 rounded-lg p-3 border border-blue-100/50 space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-600 mb-2">📊 معلومات القالب</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">العناصر</span>
                      <span className="text-[10px] font-bold text-gray-700">{template.elements.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">حقول ديناميكية</span>
                      <span className="text-[10px] font-bold text-blue-600">{template.elements.filter(e => e.type === "dynamic-field").length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">أشكال</span>
                      <span className="text-[10px] font-bold text-gray-700">{template.elements.filter(e => e.type === "shape" || e.type === "divider").length}</span>
                    </div>
                  </div>

                  {/* Hint */}
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="text-[10px] text-amber-700">💡 انقر على أي عنصر في مساحة العمل لتعديل خصائصه (الخط، اللون، الموقع، الربط بالبيانات)</p>
                  </div>

                  {/* Reset */}
                  <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={() => { if (confirm("إعادة التعيين؟ سيتم مسح جميع العناصر.")) { pushUndo(); dispatch({ type: "SET_TEMPLATE", payload: makeDefaultTemplate() }); } }}>
                    <RotateCcw className="w-3 h-3" />إعادة تعيين القالب
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTTOM LAYERS ═══ */}
      <div className="bg-white border-t px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[9px] font-bold text-gray-500 shrink-0 flex items-center gap-1"><Layers className="w-3 h-3" />الطبقات</span>
          {template.elements.map(el => (
            <button key={el.id} onClick={() => { setSelectedId(el.id); setPropsOpen(true); }}
              className={`text-[8px] px-2 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap transition-all ${selectedId === el.id ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'} ${!el.visible ? 'opacity-30' : ''}`}>
              {el.type === "text" ? <Type className="w-2.5 h-2.5" /> : el.type === "dynamic-field" ? "⚡" : el.type === "shape" ? <Square className="w-2.5 h-2.5" /> : el.type === "logo" ? "🏛" : el.type === "table" ? <Table2 className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
              {(el.props.content || el.id).slice(0, 10)}
            </button>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>حذف العنصر</DialogTitle><DialogDescription>هل تريد حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteDialog(null)}>إلغاء</Button><Button variant="destructive" onClick={() => { pushUndo(); dispatch({ type: "DELETE_ELEMENT", id: deleteDialog! }); setSelectedId(null); setDeleteDialog(null); toast.success("تم الحذف"); }}>حذف</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Recovery Dialog */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>🔄 استعادة مسودة محفوظة</DialogTitle>
            <DialogDescription>
              يوجد مسودة محفوظة تلقائياً من جلسة سابقة ({draftData?.elements?.length || 0} عنصر). هل تريد استعادتها أو تجاهلها؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDraftDialog(false); setDraftData(null); try { localStorage.removeItem(AUTOSAVE_KEY); } catch {} }}>
              تجاهل المسودة
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => { if (draftData) { dispatch({ type: "SET_TEMPLATE", payload: draftData }); toast.success("تم استعادة المسودة بنجاح"); } setShowDraftDialog(false); setDraftData(null); }}>
              استعادة المسودة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
