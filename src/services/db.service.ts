import { Injectable, signal, computed, effect } from '@angular/core';
import { Product, Variant, CashShift, Sale, User, Expense } from './data.types';

// DEFINICIÓN ESTRICTA DE USUARIOS (BACKEND SIMULADO)
// Passwords added for security request
const FIXED_USERS: User[] = [
  { id: 'admin-01', name: 'Admin', role: 'ADMIN', createdAt: 1700000000000, password: 'admin123' },
  { id: 'seller-01', name: 'Andrew', role: 'SELLER', createdAt: 1700000000000, password: '1234' },
  { id: 'seller-02', name: 'Xiomara', role: 'SELLER', createdAt: 1700000000000, password: '1234' }
];

@Injectable({
  providedIn: 'root'
})
export class DbService {
  // --- Signals for State ---
  products = signal<Product[]>([]);
  variants = signal<Variant[]>([]);
  shifts = signal<CashShift[]>([]);
  sales = signal<Sale[]>([]);
  expenses = signal<Expense[]>([]); // New Signal for Expenses
  
  // Strict User Management - Always initialized with FIXED_USERS
  users = signal<User[]>(FIXED_USERS);
  currentUser = signal<User | null>(null);

  // Computed: Get active shift
  // Returns the MOST RECENT open shift if multiple exist (handling data corruption)
  activeShift = computed(() => {
    const openShifts = this.shifts().filter(s => s.status === 'OPEN');
    if (openShifts.length === 0) return null;
    // Sort by openedAt desc to get the latest one
    return openShifts.sort((a, b) => b.openedAt - a.openedAt)[0];
  });

  constructor() {
    this.loadFromStorage();
    
    // Seed Data if empty
    if (this.products().length === 0) {
      this.seedProducts();
    }
    
    // SANITIZATION: Check for multiple open shifts or corrupted states
    this.sanitizeShifts();

    // Restore Session
    this.restoreSession();
    
    // Auto-save effect
    effect(() => {
      try {
        localStorage.setItem('rf_products', JSON.stringify(this.products()));
        localStorage.setItem('rf_variants', JSON.stringify(this.variants()));
        localStorage.setItem('rf_shifts', JSON.stringify(this.shifts()));
        localStorage.setItem('rf_sales', JSON.stringify(this.sales()));
        localStorage.setItem('rf_expenses', JSON.stringify(this.expenses())); // Persist Expenses
        // We do NOT save users anymore to enforce strict list on reload
      } catch (e) {
        console.error('Storage Quota Exceeded or Error', e);
      }
    });
  }

  private generateId(): string {
    // Robust UUID generator polyfill
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private loadFromStorage() {
    try {
      this.products.set(JSON.parse(localStorage.getItem('rf_products') || '[]'));
      this.variants.set(JSON.parse(localStorage.getItem('rf_variants') || '[]'));
      this.shifts.set(JSON.parse(localStorage.getItem('rf_shifts') || '[]'));
      this.sales.set(JSON.parse(localStorage.getItem('rf_sales') || '[]'));
      this.expenses.set(JSON.parse(localStorage.getItem('rf_expenses') || '[]'));
      
      // NOTE: We intentionally IGNORE rf_users from storage to enforce the fixed list.
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }

  private sanitizeShifts() {
    // Ensure we don't have multiple OPEN shifts. If so, close older ones.
    const allShifts = this.shifts();
    const openShifts = allShifts.filter(s => s.status === 'OPEN').sort((a, b) => b.openedAt - a.openedAt);
    
    if (openShifts.length > 1) {
      console.warn('Data Corruption Detected: Multiple Open Shifts. Closing older ones.');
      // Keep index 0 (newest), close the rest
      const toClose = openShifts.slice(1);
      const toCloseIds = new Set(toClose.map(s => s.id));
      
      this.shifts.update(list => list.map(s => {
        if (toCloseIds.has(s.id)) {
          return {
            ...s,
            status: 'CLOSED',
            closedAt: Date.now(),
            endCashActual: s.startCash, // Auto-close with start cash to be safe
            closedByUserName: 'System Auto-Close'
          };
        }
        return s;
      }));
    }
  }

  private restoreSession() {
    const lastUserId = localStorage.getItem('rf_session_user_id');
    if (lastUserId) {
      // Check against our FIXED list
      const user = this.users().find(u => u.id === lastUserId);
      if (user) {
        this.currentUser.set(user);
      } else {
        // If ID in storage is not in fixed list, clear session
        localStorage.removeItem('rf_session_user_id');
      }
    }
  }

  // --- Auth (STRICT MODE WITH PASSWORD) ---

  login(userId: string, passwordInput: string) {
    const user = this.users().find(u => u.id === userId);
    
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    if (user.password !== passwordInput) {
      throw new Error('Contraseña incorrecta.');
    }
    
    this.currentUser.set(user);
    localStorage.setItem('rf_session_user_id', user.id); 
  }

  logout() {
    this.currentUser.set(null);
    localStorage.removeItem('rf_session_user_id');
  }

  // --- Products ---

  addProduct(product: Product, newVariants: Variant[]) {
    this.products.update(p => [product, ...p]);
    this.variants.update(v => [...newVariants, ...v]);
  }

  updateProduct(product: Product, variants: Variant[]) {
    // 1. Update Product
    this.products.update(list => list.map(p => p.id === product.id ? product : p));

    // 2. Handle Variants (Simplification: Remove old for this product, add new/updated ones)
    // In a real DB, we would upsert based on ID, but for this local storage model, replacement is safer to ensure consistency
    this.variants.update(list => {
      const otherVariants = list.filter(v => v.productId !== product.id);
      return [...otherVariants, ...variants];
    });
  }

  deleteProduct(productId: string) {
    // Remove Product
    this.products.update(list => list.filter(p => p.id !== productId));
    // Remove all associated Variants
    this.variants.update(list => list.filter(v => v.productId !== productId));
  }

  deleteVariant(variantId: string) {
    this.variants.update(list => list.filter(v => v.id !== variantId));
  }

  getVariantsForProduct(productId: string): Variant[] {
    return this.variants().filter(v => v.productId === productId);
  }

  updateStock(variantId: string, quantityChange: number) {
    this.variants.update(all => all.map(v => {
      if (v.id === variantId) {
        return { ...v, stock: v.stock + quantityChange };
      }
      return v;
    }));
  }

  // --- Cash & Sales & Expenses ---

  openShift(startCash: number) {
    if (this.activeShift()) throw new Error('Ya hay un turno abierto.');
    const user = this.currentUser();
    if (!user) throw new Error('Debe iniciar sesión para abrir caja.');

    const newShift: CashShift = {
      id: this.generateId(),
      openedAt: Date.now(),
      closedAt: null,
      startCash,
      endCashExpected: startCash, // Initializes equal to start
      endCashActual: null,
      status: 'OPEN',
      movements: [],
      userId: user.id,
      userName: user.name
    };
    this.shifts.update(s => [newShift, ...s]);
  }

  closeShift(actualCash: number) {
    const current = this.activeShift();
    const user = this.currentUser();

    if (!current) throw new Error('No hay turno abierto para cerrar.');
    if (!user) throw new Error('Error: Usuario no identificado. Inicie sesión.');

    const safeActualCash = Number(actualCash); // Allow 0
    
    const closedShift: CashShift = {
      ...current,
      closedAt: Date.now(),
      endCashActual: isNaN(safeActualCash) ? 0 : safeActualCash,
      status: 'CLOSED',
      closedByUserId: user.id,
      closedByUserName: user.name
    };

    console.log('Closing Shift:', closedShift);

    // Update the specific shift in the list by ID
    this.shifts.update(list => list.map(s => s.id === current.id ? closedShift : s));
  }

  addExpense(amount: number, category: Expense['category'], description: string) {
    const current = this.activeShift();
    const user = this.currentUser();

    if (!current) throw new Error('No hay turno abierto para registrar gastos.');
    if (!user) throw new Error('Usuario no identificado.');
    
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0.');
    
    // Safe guard: Prevent taking more money than what is currently expected in cash drawer
    if (amount > current.endCashExpected) {
      throw new Error(`Fondos insuficientes. Monto máximo: S/.${current.endCashExpected.toFixed(2)}`);
    }

    const expense: Expense = {
      id: this.generateId(),
      shiftId: current.id,
      amount,
      category,
      description,
      timestamp: Date.now(),
      userId: user.id,
      userName: user.name
    };

    // 1. Add to Expenses list
    this.expenses.update(e => [expense, ...e]);

    // 2. Update Shift Cash Expected (Subtract Expense)
    const updatedShift: CashShift = {
      ...current,
      endCashExpected: current.endCashExpected - amount
    };
    
    this.shifts.update(list => list.map(s => s.id === current.id ? updatedShift : s));
  }

  deleteExpense(expenseId: string) {
    const current = this.activeShift();
    if (!current) throw new Error('No hay turno abierto.');

    const expense = this.expenses().find(e => e.id === expenseId);
    if (!expense) throw new Error('Gasto no encontrado.');

    if (expense.shiftId !== current.id) throw new Error('No se puede eliminar un gasto de un turno cerrado.');

    // 1. Restore the amount to expected cash
    const updatedShift: CashShift = {
      ...current,
      endCashExpected: current.endCashExpected + expense.amount
    };
    this.shifts.update(list => list.map(s => s.id === current.id ? updatedShift : s));

    // 2. Remove expense
    this.expenses.update(list => list.filter(e => e.id !== expenseId));
  }

  recordSale(sale: Sale) {
    const user = this.currentUser();
    if (!sale.userId && user) {
      sale.userId = user.id;
      sale.userName = user.name;
    }

    this.sales.update(s => [sale, ...s]);
    
    // Reduce Stock
    sale.items.forEach(item => {
      this.updateStock(item.variantId, -item.quantity);
    });

    // Update Cash Shift if Cash
    const shift = this.activeShift();
    if (shift && sale.paymentMethod === 'CASH') {
      const updatedShift: CashShift = {
        ...shift,
        endCashExpected: shift.endCashExpected + sale.total
      };
      this.shifts.update(list => list.map(s => s.id === shift.id ? updatedShift : s));
    }
  }

  findVariantByCode(code: string): Variant | undefined {
    return this.variants().find(v => v.barcode === code || v.sku === code);
  }
  
  getProduct(id: string): Product | undefined {
    return this.products().find(p => p.id === id);
  }

  // --- Seeding ---

  private seedProducts() {
    const shirtId = this.generateId();

    const shirt: Product = {
      id: shirtId,
      name: 'Classic T-Shirt',
      description: '100% Cotton basic tee.',
      category: 'Apparel',
      basePrice: 20,
      attributes: [
        { name: 'Color', values: ['Red', 'Blue'] },
        { name: 'Size', values: ['M', 'L'] }
      ],
      image: 'https://picsum.photos/200/200?random=1'
    };

    const shirtVariants: Variant[] = [
      { id: this.generateId(), productId: shirtId, sku: 'TEE-RED-M', barcode: '1001', price: 20, stock: 10, attributeSummary: 'Color: Red, Size: M', attributeValues: {'Color':'Red','Size':'M'}, image: 'https://picsum.photos/200/200?random=2' },
      { id: this.generateId(), productId: shirtId, sku: 'TEE-RED-L', barcode: '1002', price: 22, stock: 5, attributeSummary: 'Color: Red, Size: L', attributeValues: {'Color':'Red','Size':'L'}, image: 'https://picsum.photos/200/200?random=3' },
      { id: this.generateId(), productId: shirtId, sku: 'TEE-BLU-M', barcode: '1003', price: 20, stock: 8, attributeSummary: 'Color: Blue, Size: M', attributeValues: {'Color':'Blue','Size':'M'}, image: 'https://picsum.photos/200/200?random=4' },
    ];

    this.products.set([shirt]);
    this.variants.set(shirtVariants);
  }
}