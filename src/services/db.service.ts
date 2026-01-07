import { Injectable, signal, computed, effect } from '@angular/core';
import { Product, Variant, CashShift, Sale, User } from './data.types';

@Injectable({
  providedIn: 'root'
})
export class DbService {
  // --- Signals for State ---
  products = signal<Product[]>([]);
  variants = signal<Variant[]>([]);
  shifts = signal<CashShift[]>([]);
  sales = signal<Sale[]>([]);
  users = signal<User[]>([]);
  currentUser = signal<User | null>(null);

  // Computed: Get active shift
  activeShift = computed(() => this.shifts().find(s => s.status === 'OPEN') || null);

  constructor() {
    this.loadFromStorage();
    if (this.products().length === 0) {
      this.seedData();
    }
    
    // Auto-save effect
    effect(() => {
      localStorage.setItem('rf_products', JSON.stringify(this.products()));
      localStorage.setItem('rf_variants', JSON.stringify(this.variants()));
      localStorage.setItem('rf_shifts', JSON.stringify(this.shifts()));
      localStorage.setItem('rf_sales', JSON.stringify(this.sales()));
      localStorage.setItem('rf_users', JSON.stringify(this.users()));
    });
  }

  private loadFromStorage() {
    try {
      this.products.set(JSON.parse(localStorage.getItem('rf_products') || '[]'));
      this.variants.set(JSON.parse(localStorage.getItem('rf_variants') || '[]'));
      this.shifts.set(JSON.parse(localStorage.getItem('rf_shifts') || '[]'));
      this.sales.set(JSON.parse(localStorage.getItem('rf_sales') || '[]'));
      this.users.set(JSON.parse(localStorage.getItem('rf_users') || '[]'));
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }

  // --- Auth ---

  login(name: string) {
    const existingUser = this.users().find(u => u.name.toLowerCase() === name.toLowerCase());
    
    if (existingUser) {
      this.currentUser.set(existingUser);
    } else {
      const newUser: User = {
        id: crypto.randomUUID(),
        name: name,
        role: 'SELLER',
        createdAt: Date.now()
      };
      this.users.update(u => [...u, newUser]);
      this.currentUser.set(newUser);
    }
  }

  logout() {
    this.currentUser.set(null);
  }

  // --- Products ---

  addProduct(product: Product, newVariants: Variant[]) {
    this.products.update(p => [product, ...p]);
    this.variants.update(v => [...newVariants, ...v]);
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

  // --- Cash & Sales ---

  openShift(startCash: number) {
    if (this.activeShift()) throw new Error('Shift already open');
    const user = this.currentUser();
    if (!user) throw new Error('No user logged in. Please log in first.');

    const newShift: CashShift = {
      id: crypto.randomUUID(),
      openedAt: Date.now(),
      closedAt: null,
      startCash,
      endCashExpected: startCash,
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

    if (!current) throw new Error('No open shift found to close.');
    if (!user) throw new Error('You must be logged in to close a shift.');

    // Ensure actualCash is a number
    const safeActualCash = Number(actualCash) || 0;
    
    const closedShift: CashShift = {
      ...current,
      closedAt: Date.now(),
      endCashActual: safeActualCash,
      status: 'CLOSED',
      closedByUserId: user.id,
      closedByUserName: user.name
    };

    // Replace the open shift with the closed one
    this.shifts.update(list => list.map(s => s.id === current.id ? closedShift : s));
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

  private seedData() {
    const shirtId = crypto.randomUUID();

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
      { id: crypto.randomUUID(), productId: shirtId, sku: 'TEE-RED-M', barcode: '1001', price: 20, stock: 10, attributeSummary: 'Color: Red, Size: M', attributeValues: {'Color':'Red','Size':'M'}, image: 'https://picsum.photos/200/200?random=2' },
      { id: crypto.randomUUID(), productId: shirtId, sku: 'TEE-RED-L', barcode: '1002', price: 22, stock: 5, attributeSummary: 'Color: Red, Size: L', attributeValues: {'Color':'Red','Size':'L'}, image: 'https://picsum.photos/200/200?random=3' },
      { id: crypto.randomUUID(), productId: shirtId, sku: 'TEE-BLU-M', barcode: '1003', price: 20, stock: 8, attributeSummary: 'Color: Blue, Size: M', attributeValues: {'Color':'Blue','Size':'M'}, image: 'https://picsum.photos/200/200?random=4' },
    ];

    this.products.set([shirt]);
    this.variants.set(shirtVariants);
  }
}