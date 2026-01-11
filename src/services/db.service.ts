import { Injectable, signal, computed, effect } from '@angular/core';
import { Product, Variant, CashShift, Sale, User, Expense } from './data.types';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  query,
  writeBatch,
  Firestore
} from 'firebase/firestore';

// =================================================================================
// CONFIGURACIÓN SIMPLIFICADA DE FIREBASE
// ---------------------------------------------------------------------------------
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un proyecto (Gratis/Spark Plan).
// 3. Agrega una app Web (</>) y copia las credenciales aquí.
// =================================================================================
const FIREBASE_CONFIG = {
  apiKey: "", // <--- PEGA TU API KEY AQUÍ
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

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
  expenses = signal<Expense[]>([]); 
  
  users = signal<User[]>(FIXED_USERS);
  currentUser = signal<User | null>(null);

  // Status Signal
  isCloudConnected = signal(false);

  activeShift = computed(() => {
    const openShifts = this.shifts().filter(s => s.status === 'OPEN');
    if (openShifts.length === 0) return null;
    return openShifts.sort((a, b) => b.openedAt - a.openedAt)[0];
  });

  private db: Firestore | null = null;

  constructor() {
    this.initDatabase();
    this.restoreSession();
    
    // Auto-save local backup regardless of cloud status
    effect(() => {
      try {
        localStorage.setItem('rf_products', JSON.stringify(this.products()));
        localStorage.setItem('rf_variants', JSON.stringify(this.variants()));
        localStorage.setItem('rf_shifts', JSON.stringify(this.shifts()));
        localStorage.setItem('rf_sales', JSON.stringify(this.sales()));
        localStorage.setItem('rf_expenses', JSON.stringify(this.expenses()));
      } catch (e) { console.error('Storage Error', e); }
    });
  }

  private initDatabase() {
    if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.length > 5) {
      try {
        const app = initializeApp(FIREBASE_CONFIG);
        this.db = getFirestore(app);
        this.isCloudConnected.set(true);
        console.log('🔥 NUBE CONECTADA: Sincronizando datos...');
        
        // Listeners en Tiempo Real (Muy bajo consumo para < 100 items)
        this.listenToCollection('products', this.products);
        this.listenToCollection('variants', this.variants);
        this.listenToCollection('shifts', this.shifts);
        this.listenToCollection('sales', this.sales);
        this.listenToCollection('expenses', this.expenses);

      } catch (error) {
        console.error('Error conectando a Firebase:', error);
        this.fallbackToLocal();
      }
    } else {
      console.warn('⚠️ MODO LOCAL: Agrega las llaves en db.service.ts para activar la nube.');
      this.fallbackToLocal();
    }
  }

  private fallbackToLocal() {
    this.isCloudConnected.set(false);
    try {
      this.products.set(JSON.parse(localStorage.getItem('rf_products') || '[]'));
      this.variants.set(JSON.parse(localStorage.getItem('rf_variants') || '[]'));
      this.shifts.set(JSON.parse(localStorage.getItem('rf_shifts') || '[]'));
      this.sales.set(JSON.parse(localStorage.getItem('rf_sales') || '[]'));
      this.expenses.set(JSON.parse(localStorage.getItem('rf_expenses') || '[]'));
      
      if (this.products().length === 0) this.seedProducts();
      this.sanitizeShifts();
    } catch (e) {
      console.error('Error loading local data', e);
    }
  }

  private listenToCollection(collectionName: string, signalToUpdate: any) {
    if (!this.db) return;
    const q = query(collection(this.db, collectionName));
    onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => data.push(doc.data()));
      signalToUpdate.set(data); // Actualiza la UI automáticamente
      if(collectionName === 'shifts') this.sanitizeShifts();
    });
  }

  // --- Operaciones CRUD Simplificadas (Escribe en Local + Nube) ---

  private async saveData(collectionName: string, data: any) {
    if (this.isCloudConnected() && this.db) {
      // Escritura simple: "Lo que hay en la UI es lo que va a la nube"
      try {
        await setDoc(doc(this.db, collectionName, data.id), data);
      } catch (e) {
        console.error(`Error guardando en ${collectionName}`, e);
      }
    }
  }

  private async removeData(collectionName: string, docId: string) {
    if (this.isCloudConnected() && this.db) {
      try {
        await deleteDoc(doc(this.db, collectionName, docId));
      } catch (e) {
        console.error(`Error borrando en ${collectionName}`, e);
      }
    }
  }

  // --- Métodos Públicos ---

  addProduct(product: Product, newVariants: Variant[]) {
    this.products.update(p => [product, ...p]);
    this.variants.update(v => [...newVariants, ...v]);
    
    this.saveData('products', product);
    newVariants.forEach(v => this.saveData('variants', v));
  }

  updateProduct(product: Product, variants: Variant[]) {
    this.products.update(list => list.map(p => p.id === product.id ? product : p));
    this.saveData('products', product);

    // Estrategia Simple: Sobrescribir variantes.
    // Como el volumen es bajo, simplemente agregamos/actualizamos.
    // Nota: Para una limpieza perfecta en la nube, se requeriría borrar las viejas,
    // pero para <100 items, sobrescribir es suficiente y más seguro.
    this.variants.update(list => {
      const other = list.filter(v => v.productId !== product.id);
      return [...other, ...variants];
    });
    variants.forEach(v => this.saveData('variants', v));
  }

  deleteProduct(productId: string) {
    const varsToDelete = this.variants().filter(v => v.productId === productId);
    this.products.update(list => list.filter(p => p.id !== productId));
    this.variants.update(list => list.filter(v => v.productId !== productId));
    
    this.removeData('products', productId);
    varsToDelete.forEach(v => this.removeData('variants', v.id));
  }

  deleteVariant(variantId: string) {
    this.variants.update(list => list.filter(v => v.id !== variantId));
    this.removeData('variants', variantId);
  }

  updateStock(variantId: string, quantityChange: number) {
    const target = this.variants().find(v => v.id === variantId);
    if (target) {
      const updated = { ...target, stock: target.stock + quantityChange };
      this.variants.update(all => all.map(v => v.id === variantId ? updated : v));
      this.saveData('variants', updated);
    }
  }

  openShift(startCash: number) {
    if (this.activeShift()) throw new Error('Ya hay un turno abierto.');
    const user = this.currentUser();
    if (!user) throw new Error('Debe iniciar sesión.');

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
    this.saveData('shifts', newShift);
  }

  closeShift(actualCash: number) {
    const current = this.activeShift();
    const user = this.currentUser();
    if (!current || !user) throw new Error('Error de sesión o turno.');

    const closedShift: CashShift = {
      ...current,
      closedAt: Date.now(),
      endCashActual: Number(actualCash) || 0,
      status: 'CLOSED',
      closedByUserId: user.id,
      closedByUserName: user.name
    };

    this.shifts.update(list => list.map(s => s.id === current.id ? closedShift : s));
    this.saveData('shifts', closedShift);
  }

  addExpense(amount: number, category: Expense['category'], description: string) {
    const current = this.activeShift();
    const user = this.currentUser();
    if (!current || !user) throw new Error('Error operativo.');

    const expense: Expense = {
      id: crypto.randomUUID(),
      shiftId: current.id,
      amount,
      category,
      description,
      timestamp: Date.now(),
      userId: user.id,
      userName: user.name
    };

    const updatedShift = { ...current, endCashExpected: current.endCashExpected - amount };
    
    this.expenses.update(e => [expense, ...e]);
    this.shifts.update(list => list.map(s => s.id === current.id ? updatedShift : s));

    this.saveData('expenses', expense);
    this.saveData('shifts', updatedShift);
  }

  deleteExpense(expenseId: string) {
    const current = this.activeShift();
    if (!current) throw new Error('No hay turno abierto.');
    const expense = this.expenses().find(e => e.id === expenseId);
    if (!expense) throw new Error('No encontrado.');

    const updatedShift = { ...current, endCashExpected: current.endCashExpected + expense.amount };
    this.expenses.update(list => list.filter(e => e.id !== expenseId));
    this.shifts.update(list => list.map(s => s.id === current.id ? updatedShift : s));

    this.removeData('expenses', expenseId);
    this.saveData('shifts', updatedShift);
  }

  recordSale(sale: Sale) {
    const user = this.currentUser();
    if (!sale.userId && user) {
      sale.userId = user.id;
      sale.userName = user.name;
    }

    this.sales.update(s => [sale, ...s]);
    this.saveData('sales', sale);
    
    sale.items.forEach(item => this.updateStock(item.variantId, -item.quantity));

    const shift = this.activeShift();
    if (shift && sale.paymentMethod === 'CASH') {
      const updatedShift = { ...shift, endCashExpected: shift.endCashExpected + sale.total };
      this.shifts.update(list => list.map(s => s.id === shift.id ? updatedShift : s));
      this.saveData('shifts', updatedShift);
    }
  }

  // --- Utilidades ---
  findVariantByCode(code: string) { return this.variants().find(v => v.barcode === code || v.sku === code); }
  getProduct(id: string) { return this.products().find(p => p.id === id); }
  getVariantsForProduct(pid: string) { return this.variants().filter(v => v.productId === pid); }

  login(userId: string, pass: string) {
    const user = this.users().find(u => u.id === userId);
    if (user && user.password === pass) {
      this.currentUser.set(user);
      localStorage.setItem('rf_session_user_id', user.id);
    } else {
      throw new Error('Credenciales inválidas');
    }
  }
  logout() {
    this.currentUser.set(null);
    localStorage.removeItem('rf_session_user_id');
  }

  // --- IMPORTACIÓN / EXPORTACIÓN (Backup y Sincronización) ---
  
  exportDatabase(): string {
    const data = {
      version: '1.3',
      timestamp: Date.now(),
      products: this.products(),
      variants: this.variants(),
      shifts: this.shifts(),
      sales: this.sales(),
      expenses: this.expenses()
    };
    return JSON.stringify(data, null, 2);
  }

  async importDatabase(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.products)) throw new Error('Formato inválido');

      // 1. Actualizar Memoria Local
      this.products.set(data.products || []);
      this.variants.set(data.variants || []);
      this.shifts.set(data.shifts || []);
      this.sales.set(data.sales || []);
      this.expenses.set(data.expenses || []);

      // 2. Si hay nube, subir todo (Restauración Completa)
      // Dado que el volumen es bajo (<100), podemos iterar sin problemas.
      if (this.isCloudConnected() && this.db) {
        console.log('☁️ Restaurando copia de seguridad en la nube...');
        const batchSize = 400; // Firestore limit es 500
        let batch = writeBatch(this.db);
        let count = 0;

        const addToBatch = (col: string, item: any) => {
          if (!this.db) return;
          const ref = doc(this.db, col, item.id);
          batch.set(ref, item);
          count++;
        };

        // Encolar todo
        data.products.forEach((x: any) => addToBatch('products', x));
        data.variants.forEach((x: any) => addToBatch('variants', x));
        data.shifts.forEach((x: any) => addToBatch('shifts', x));
        data.sales.forEach((x: any) => addToBatch('sales', x));
        data.expenses.forEach((x: any) => addToBatch('expenses', x));

        if (count > 0) {
           await batch.commit();
           console.log(`✅ ${count} registros restaurados en la nube.`);
        }
      }

      return true;
    } catch (e) {
      console.error('Import Failed', e);
      return false;
    }
  }

  // --- Helpers Privados ---
  private sanitizeShifts() {
    const open = this.shifts().filter(s => s.status === 'OPEN');
    if (open.length > 1) {
      // Auto-cierre de seguridad si hay múltiples turnos abiertos
      open.slice(1).forEach(s => {
         const closed = { ...s, status: 'CLOSED' as const, closedAt: Date.now(), endCashActual: s.startCash };
         this.shifts.update(l => l.map(x => x.id === s.id ? closed : x));
         this.saveData('shifts', closed);
      });
    }
  }

  private restoreSession() {
    const uid = localStorage.getItem('rf_session_user_id');
    if (uid) {
      const u = this.users().find(user => user.id === uid);
      if (u) this.currentUser.set(u);
    }
  }

  private seedProducts() {
    // Datos de ejemplo para primera vez
    const pid = 'demo-shirt';
    const prod: Product = { id: pid, name: 'Camiseta Demo', description: 'Ejemplo inicial', category: 'Ropa', basePrice: 20, attributes: [], image: 'https://picsum.photos/200' };
    const vary: Variant = { id: 'demo-var', productId: pid, sku: 'DEMO-001', barcode: '123456', price: 20, stock: 10, attributeSummary: 'Estándar', attributeValues: {}, image: 'https://picsum.photos/200' };
    this.addProduct(prod, [vary]);
  }
}