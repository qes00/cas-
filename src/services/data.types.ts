export interface Attribute {
  name: string; // e.g. "Color"
  values: string[]; // e.g. ["Red", "Blue"]
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'MANAGER' | 'SELLER';
  createdAt: number;
  lastLogin?: number;
  active?: boolean;
  // password field removed - now handled by Firebase Auth
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  attributes: Attribute[];
  image?: string;
  basePrice: number;
  lowStockThreshold?: number; // Configurable threshold
}

export interface Variant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  price: number;
  stock: number;
  // combination of attribute values, e.g. "Color: Red, Size: M"
  attributeSummary: string;
  // structured values for logic
  attributeValues: Record<string, string>;
  image?: string;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  attributeSummary: string;
}

export interface Sale {
  id: string;
  timestamp: number;
  total: number;
  items: CartItem[];
  paymentMethod: 'CASH' | 'CARD' | 'OTHER';
  shiftId: string | null;
  userId: string;     // Added
  userName: string;   // Added snapshot of name
}

// New Entity for Petty Cash / Expenses
export interface Expense {
  id: string;
  shiftId: string;
  amount: number;
  category: 'SUPPLIES' | 'FOOD' | 'SERVICES' | 'OTHER';
  description: string;
  timestamp: number;
  userId: string;
  userName: string;
}

export interface CashShift {
  id: string;
  openedAt: number;
  closedAt: number | null;
  startCash: number;
  endCashExpected: number;
  endCashActual: number | null;
  status: 'OPEN' | 'CLOSED';
  movements: CashMovement[];
  userId: string;     // User who opened
  userName: string;   // Name of user who opened
  closedByUserId?: string; // User who closed
  closedByUserName?: string; // Name of user who closed
}

export interface CashMovement {
  id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  timestamp: number;
}

// ============ Phase 4: Customers ============

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  totalPurchases: number;
  totalSpent: number;
  createdAt: number;
  lastPurchaseAt?: number;
}

// ============ Phase 5: Discounts ============

export interface Discount {
  id: string;
  name: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number; // percentage (0-100) or fixed amount
  scope: 'PRODUCT' | 'CATEGORY' | 'CART';
  productIds?: string[]; // applies to specific products
  categoryNames?: string[]; // applies to specific categories
  minPurchase?: number; // minimum cart total to apply
  maxDiscount?: number; // maximum discount amount (for percentage)
  validFrom?: number;
  validUntil?: number;
  couponCode?: string; // if set, requires code to apply
  usageLimit?: number; // max times can be used
  usageCount: number; // times used
  active: boolean;
  createdAt: number;
}

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  amount: number; // actual discount amount applied
}

// ============ Phase 6: Inventory ============

export interface InventoryMovement {
  id: string;
  variantId: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE' | 'RETURN';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string; // saleId, returnId, etc.
  timestamp: number;
  userId: string;
  userName: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: number;
}

// ============ Phase 7: Returns ============

export interface Return {
  id: string;
  saleId: string;
  items: CartItem[];
  reason: string;
  refundAmount: number;
  refundMethod: 'CASH' | 'CARD' | 'CREDIT';
  timestamp: number;
  userId: string;
  userName: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  notes?: string;
}

// ============ Extended Sale with new fields ============

export interface SaleWithDetails extends Sale {
  customerId?: string;
  customerName?: string;
  subtotal: number;
  discounts?: AppliedDiscount[];
  discountTotal: number;
  notes?: string;
}