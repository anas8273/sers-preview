/**
 * CartDrawer — درج جانبي للسلة
 * يعرض العناصر المضافة مع إمكانية تعديل الكمية والحذف
 */
import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingCart, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout?: () => void;
}

export default function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, getTotal, getItemCount } = useCartStore();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 left-0 h-full w-[380px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col transform transition-transform"
        dir="rtl"
        style={{ right: 0, left: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              السلة
            </h3>
            <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">
              {getItemCount()}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingBag className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                السلة فارغة
              </p>
              <p className="text-xs mt-1">أضف خدمات أو قوالب للبدء</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  {/* Image placeholder */}
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-6 h-6 text-teal-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-gray-800 truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {/* Qty controls */}
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-bold text-teal-700">
                        {(item.price * item.quantity).toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500 p-1 self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 font-medium" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                الإجمالي
              </span>
              <span className="font-bold text-gray-900 text-base">
                {getTotal().toFixed(2)} ر.س
              </span>
            </div>

            <Button
              onClick={onCheckout}
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <ShoppingBag className="w-4 h-4" />
              إتمام الشراء
            </Button>

            <button
              onClick={clearCart}
              className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
            >
              تفريغ السلة
            </button>
          </div>
        )}
      </div>
    </>
  );
}
