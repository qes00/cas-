import { Injectable, inject, computed } from '@angular/core';
import { Product, Variant, CashShift, Sale, Expense } from './data.types';
import { AuthService, AppUser } from './auth.service';
import { ProductService } from './product.service';
import { SalesService } from './sales.service';
import { ShiftService } from './shift.service';
import { writeBatch, doc } from 'firebase/firestore';

/**
 * DbService - Coordinator service that delegates to specialized services
 * Maintained for backward compatibility with existing components
 */
@Injectable({
  providedIn: 'root'
})
export class DbService {
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private salesService = inject(SalesService);
  private shiftService = inject(ShiftService);

  // --- Delegate signals for backward compatibility ---

  get products() { return this.productService.products; }
  get variants() { return this.productService.variants; }
  get sales() { return this.salesService.sales; }
  get shifts() { return this.shiftService.shifts; }
  get expenses() { return this.shiftService.expenses; }

  get users() { return this.authService.users; }
  get currentUser() { return this.authService.currentUser; }
  get isCloudConnected() { return this.authService.isCloudConnected; }

  get activeShift() { return this.shiftService.activeShift; }

  // --- Delegate Product methods ---

  addProduct(product: Product, newVariants: Variant[]) {
    this.productService.addProduct(product, newVariants);
  }

  updateProduct(product: Product, variants: Variant[]) {
    this.productService.updateProduct(product, variants);
  }

  deleteProduct(productId: string) {
    this.productService.deleteProduct(productId);
  }

  deleteVariant(variantId: string) {
    this.productService.deleteVariant(variantId);
  }

  updateStock(variantId: string, quantityChange: number) {
    this.productService.updateStock(variantId, quantityChange);
  }

  findVariantByCode(code: string) {
    return this.productService.findVariantByCode(code);
  }

  getProduct(id: string) {
    return this.productService.getProduct(id);
  }

  getVariantsForProduct(pid: string) {
    return this.productService.getVariantsForProduct(pid);
  }

  // --- Delegate Shift methods ---

  openShift(startCash: number) {
    this.shiftService.openShift(startCash);
  }

  closeShift(actualCash: number) {
    return this.shiftService.closeShift(actualCash);
  }

  addExpense(amount: number, category: Expense['category'], description: string) {
    this.shiftService.addExpense(amount, category, description);
  }

  deleteExpense(expenseId: string) {
    this.shiftService.deleteExpense(expenseId);
  }

  // --- Delegate Sales methods ---

  recordSale(sale: Sale) {
    const result = this.salesService.recordSale(sale, true);

    if (result.success) {
      // Update shift expected cash if it's a cash sale
      const shift = this.activeShift();
      if (shift && sale.paymentMethod === 'CASH') {
        this.shiftService.updateExpectedCash(sale.total);
      }
    } else {
      // For backward compatibility, log errors but don't throw
      console.error('Sale validation errors:', result.errors);
    }
  }

  // --- Delegate Auth methods ---

  async login(email: string, password: string) {
    await this.authService.login(email, password);
  }

  logout() {
    this.authService.logout();
  }

  // --- IMPORTACIÓN / EXPORTACIÓN (Backup y Sincronización) ---

  exportDatabase(): string {
    const data = {
      version: '2.0',
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

      // Update local state via services
      this.productService.products.set(data.products || []);
      this.productService.variants.set(data.variants || []);
      this.shiftService.shifts.set(data.shifts || []);
      this.salesService.sales.set(data.sales || []);
      this.shiftService.expenses.set(data.expenses || []);

      // Sync to cloud if connected
      if (this.isCloudConnected()) {
        const db = this.authService.getFirestore();
        if (db) {
          console.log('☁️ Restaurando copia de seguridad en la nube...');
          const batch = writeBatch(db);
          let count = 0;

          const addToBatch = (col: string, item: any) => {
            const ref = doc(db, col, item.id);
            batch.set(ref, item);
            count++;
          };

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
      }

      return true;
    } catch (e) {
      console.error('Import Failed', e);
      return false;
    }
  }
}