/**
 * زر التعبئة بالذكاء الاصطناعي - مكون مشترك
 * يستخدم في جميع النماذج التفاعلية
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIFillButtonProps {
  onFill: () => Promise<void>;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
  color?: string;
}

export default function AIFillButton({
  onFill,
  label = "تعبئة بالذكاء الاصطناعي",
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
  color,
}: AIFillButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await onFill();
    } catch (err) {
      console.error("AI fill error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      disabled={loading || disabled}
      className={`gap-1.5 transition-all ${loading ? "opacity-70" : ""} ${className}`}
      style={color ? { borderColor: color + "40", color: color } : undefined}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>جاري التوليد...</span>
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}
