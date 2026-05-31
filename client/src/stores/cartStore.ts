/**
 * Cart Store — Zustand
 * سلة المشتريات (خدمات + قوالب)
 * مستوردة ومكيّفة من GitHub SERS cartStore.ts
 * يُحفظ في localStorage عبر persist middleware
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────
export interface CartItem {
  id: string;
  templateId: number;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  addedAt: number;
}

interface CartState {
  items: CartItem[];
  // ─── Actions ─────
  addItem: (item: Omit<CartItem, 'id' | 'addedAt' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  isInCart: (templateId: number) => boolean;
}

// ─── Store ───────────────────────────────────────────────
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find(i => i.templateId === item.templateId);
        if (existing) {
          // Increment quantity
          set(state => ({
            items: state.items.map(i =>
              i.templateId === item.templateId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          }));
        } else {
          set(state => ({
            items: [
              ...state.items,
              {
                ...item,
                id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                quantity: 1,
                addedAt: Date.now(),
              },
            ],
          }));
        }
      },

      removeItem: (id) =>
        set(state => ({
          items: state.items.filter(i => i.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set(state => ({
          items: quantity <= 0
            ? state.items.filter(i => i.id !== id)
            : state.items.map(i => (i.id === id ? { ...i, quantity } : i)),
        })),

      clearCart: () => set({ items: [] }),

      getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      isInCart: (templateId) => get().items.some(i => i.templateId === templateId),
    }),
    {
      name: 'sers-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
