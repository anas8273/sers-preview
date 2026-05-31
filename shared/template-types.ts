/**
 * Unified Template Engine Types — SERS
 * Shared between client & server for type-safe template management.
 * Single source of truth for all template-related types.
 */

// ─── Canvas Element Types (Visual Builder) ─────────────────
export type CanvasElementType =
  | "text"
  | "dynamic-field"
  | "image"
  | "shape"
  | "table"
  | "divider"
  | "logo"
  | "qrcode"
  | "repeater-table";

export interface CanvasElementProps {
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  color?: string;
  bgColor?: string;
  textAlign?: string;
  opacity?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  lineHeight?: number;
  padding?: number;
  /** Binding to dynamic data source */
  binding?: { type: "static" | "dynamic"; fieldId?: string };
  /** Image source URL or base64 */
  src?: string;
  objectFit?: string;
  /** Table dimensions */
  rows?: number;
  cols?: number;
  /** QR code data */
  qrData?: string;
  qrSize?: number;
  /** Repeater settings */
  repeaterFieldId?: string;
  repeaterYOffset?: number;
  repeaterMaxRows?: number;
}

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  props: CanvasElementProps;
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

// ─── Template Schema (Visual Builder state) ─────────────────
export interface TemplateCanvasConfig {
  width: number;
  height: number;
  bgImage?: string;
  bgColor: string;
}

export interface TemplateSchema {
  id: string;
  name: string;
  canvas: TemplateCanvasConfig;
  elements: CanvasElement[];
  metadata: {
    version: number;
    createdAt?: string;
    updatedAt?: string;
  };
}

// ─── Dynamic Field Definitions ──────────────────────────────
export interface DynamicFieldDef {
  id: string;
  label: string;
  icon: string;
}

export const DYNAMIC_FIELDS: DynamicFieldDef[] = [
  { id: "name", label: "اسم الموظف", icon: "👤" },
  { id: "school", label: "المدرسة", icon: "🏫" },
  { id: "year", label: "العام الدراسي", icon: "📅" },
  { id: "criterion", label: "المعيار", icon: "📊" },
  { id: "evaluator", label: "المقيّم", icon: "✍️" },
  { id: "date", label: "التاريخ", icon: "📆" },
  { id: "semester", label: "الفصل الدراسي", icon: "📚" },
  { id: "position", label: "الوظيفة", icon: "💼" },
  { id: "evidence", label: "الشاهد", icon: "📋" },
  { id: "qrcode", label: "رمز QR", icon: "📱" },
];

// ─── Layout Types (for structured rendering) ────────────────
export type LayoutType =
  | "dark-header-table"
  | "dark-header-simple"
  | "white-header-classic"
  | "white-header-sidebar"
  | "white-header-light"
  | "white-header-multi"
  | "white-header-cards"
  | "minimal-clean";

export type FieldStyle = "table" | "fieldset" | "underlined" | "cards" | "minimal";
export type TitleStyle = "full-width" | "bordered" | "underlined" | "rounded" | "badge" | "simple";
export type SignatureStyle = "boxed" | "lined" | "simple" | "stamped" | "dotted" | "solid";
export type FooterStyle = "gradient" | "solid" | "line" | "none";

// ─── Template Field (Form Schema) ───────────────────────────
export type TemplateFieldType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "number"
  | "image"
  | "list"
  | "signatures"
  | "qrcode"
  | "repeater_table";

export interface TemplateField {
  id: string;
  label: string;
  type: TemplateFieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  gridColumn?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  titleBg?: string;
  columns?: number;
  fields: TemplateField[];
}

// ─── Template Layout (Structured rendering config) ──────────
export interface TemplateLayout {
  version: number;
  pageSize?: "A4" | "letter";
  direction?: "rtl" | "ltr";
  layoutType?: LayoutType;
  fieldStyle?: FieldStyle;
  titleStyle?: TitleStyle;
  signatureStyle?: SignatureStyle;
  footerStyle?: FooterStyle;
  headerStyle?: "full-width" | "centered" | "minimal";
  showMoeLogo?: boolean;
  showSchoolLogo?: boolean;
  showEvidenceSection?: boolean;
  evidenceDisplay?: "images" | "qr" | "mixed";
  sections: TemplateSection[];
  footerText?: string;
  signatureLabels?: { right: string; left: string };
}

// ─── A4 Constants ───────────────────────────────────────────
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

// ─── Font Options ───────────────────────────────────────────
export const ARABIC_FONTS = [
  { id: "Cairo", label: "القاهرة" },
  { id: "Tajawal", label: "تجوال" },
  { id: "Noto Kufi Arabic", label: "نوتو كوفي" },
  { id: "Amiri", label: "أميري" },
  { id: "Almarai", label: "المراعي" },
  { id: "IBM Plex Sans Arabic", label: "آي بي إم" },
];

// ─── Color Palette ──────────────────────────────────────────
export const COLOR_PALETTE = [
  "#059669", "#047857", "#0D9488", "#0891B2", "#2563EB", "#4F46E5", "#7C3AED",
  "#9333EA", "#C026D3", "#DB2777", "#DC2626", "#EA580C", "#D97706", "#CA8A04",
  "#65A30D", "#1a1a1a", "#374151", "#6B7280", "#9CA3AF", "#ffffff",
];
