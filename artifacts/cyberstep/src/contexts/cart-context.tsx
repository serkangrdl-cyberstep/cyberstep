import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface CartItem {
  id: number;
  slug: string;
  label: string;
  monthlyPriceTl: number;
  serviceType: string | null;
}

interface CartContextType {
  items: CartItem[];
  billingCycle: "monthly" | "annual";
  addItem: (item: CartItem) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
  setBillingCycle: (c: "monthly" | "annual") => void;
  isInCart: (slug: string) => boolean;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("cs-cart") ?? "[]") as CartItem[]; }
    catch { return []; }
  });
  const [billingCycle, setBillingCycleState] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    localStorage.setItem("cs-cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItem) =>
    setItems(p => p.some(i => i.slug === item.slug) ? p : [...p, item]);
  const removeItem = (slug: string) =>
    setItems(p => p.filter(i => i.slug !== slug));
  const clearCart = () => setItems([]);
  const isInCart = (slug: string) => items.some(i => i.slug === slug);
  const setBillingCycle = (c: "monthly" | "annual") => setBillingCycleState(c);

  return (
    <CartContext.Provider value={{
      items, billingCycle, addItem, removeItem, clearCart,
      setBillingCycle, isInCart, itemCount: items.length,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
