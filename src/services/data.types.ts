export interface Attribute {
  name: string; // e.g. "Color"
  values: string[]; // e.g. ["Red", "Blue"]
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  attributes: Attribute[];
  image?: string;
  basePrice: number;
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
}

export interface CashMovement {
  id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  timestamp: number;
}
