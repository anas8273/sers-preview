/**
 * Wishlist Store — Zustand
 * قائمة الأمنيات (قوالب مفضلة)
 * مستوردة ومكيّفة من GitHub SERS wishlistStore.ts
 * يُحفظ في localStorage عبر persist middleware
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────
export interface WishlistItem {
  id: string;
  templateId: number;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  addedAt: number;
}

interface WishlistState {
  items: WishlistItem[];
  // ─── Actions ─────
  addItem: (item: Omit<WishlistItem, 'id' | 'addedAt'>) => void;
  removeItem: (id: string) => void;
  removeByTemplateId: (templateId: number) => void;
  clearAll: () => void;
  isInWishlist: (templateId: number) => boolean;
  toggleWishlist: (item: Omit<WishlistItem, 'id' | 'addedAt'>) => void;
}

// ─── Store ───────────────────────────────────────────────
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        if (get().isInWishlist(item.templateId)) return;
        set(state => ({
          items: [
            ...state.items,
            {
              ...item,
              id: `wish_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              addedAt: Date.now(),
            },
          ],
        }));
      },

      removeItem: (id) =>
        set(state => ({
          items: state.items.filter(i => i.id !== id),
        })),

      removeByTemplateId: (templateId) =>
        set(state => ({
          items: state.items.filter(i => i.templateId !== templateId),
        })),

      clearAll: () => set({ items: [] }),

      isInWishlist: (templateId) => get().items.some(i => i.templateId === templateId),

      toggleWishlist: (item) => {
        if (get().isInWishlist(item.templateId)) {
          get().removeByTemplateId(item.templateId);
        } else {
          get().addItem(item);
        }
      },
    }),
    {
      name: 'sers-wishlist',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
