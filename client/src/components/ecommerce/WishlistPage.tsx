/**
 * WishlistPage — صفحة قائمة الأمنيات
 * يعرض العناصر المفضلة مع إمكانية النقل للسلة أو الحذف
 */
import React from 'react';
import { Heart, Trash2, ShoppingCart, HeartOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';

export default function WishlistPage() {
  const { items, removeItem, clearAll } = useWishlistStore();
  const addToCart = useCartStore(s => s.addItem);
  const isInCart = useCartStore(s => s.isInCart);

  const moveToCart = (item: typeof items[0]) => {
    addToCart({
      templateId: item.templateId,
      name: item.name,
      description: item.description,
      price: item.price || 0,
      imageUrl: item.imageUrl,
    });
    removeItem(item.id);
    toast.success('تم نقل العنصر إلى السلة');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            قائمة الأمنيات
          </h2>
          <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-bold">
            {items.length}
          </span>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            مسح الكل
          </button>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <HeartOff className="w-16 h-16 mb-4" />
          <p className="text-sm font-medium" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            لا توجد عناصر في قائمة الأمنيات
          </p>
          <p className="text-xs mt-1">اضغط على ♥ لإضافة خدمات أو قوالب</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Card Image */}
              <div className="h-32 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
                <Heart className="w-10 h-10 text-teal-300" />
              </div>

              {/* Card Body */}
              <div className="p-3 space-y-2">
                <h4 className="text-sm font-bold text-gray-800 truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                  {item.name}
                </h4>
                {item.description && (
                  <p className="text-[10px] text-gray-500 line-clamp-2">{item.description}</p>
                )}
                {item.price != null && item.price > 0 && (
                  <p className="text-xs font-bold text-teal-700">{item.price.toFixed(2)} ر.س</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => moveToCart(item)}
                    disabled={isInCart(item.templateId)}
                    className="flex-1 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {isInCart(item.templateId) ? 'في السلة' : 'نقل للسلة'}
                  </Button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
