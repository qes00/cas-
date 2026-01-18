import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { TranslationService } from '../../services/translation.service';
import { CashShift, Expense } from '../../services/data.types';

@Component({
  selector: 'app-cash-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-6">
      
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
           <h2 class="text-3xl font-bold text-slate-800">{{ t('cashControlTitle') }}</h2>
           <p class="text-slate-500">{{ t('cashControlSubtitle') }}</p>
        </div>
        <div class="text-right">
           <span class="block text-sm text-slate-500">{{ t('currentStatus') }}</span>
           <span class="font-bold text-xl" [class.text-green-600]="activeShift()" [class.text-red-500]="!activeShift()">
             {{ activeShift() ? t('shiftOpen') : t('shiftClosed') }}
           </span>
        </div>
      </div>

      <!-- Action Card -->
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        @if (!activeShift()) {
          <!-- OPEN SHIFT UI -->
          <div class="p-8 flex flex-col items-center text-center space-y-4">
            <div class="p-4 bg-green-100 rounded-full text-green-600 mb-2">
              <span class="material-icons text-4xl">storefront</span>
            </div>
            <h3 class="text-2xl font-bold text-slate-800">{{ t('startNewShift') }}</h3>
            <p class="text-slate-500 max-w-sm">{{ t('startShiftInstruction') }}</p>
            
            <div class="w-full max-w-xs">
              <label class="block text-left text-sm font-bold text-slate-700 mb-1">{{ t('openingCash') }}</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-slate-400">S/.</span>
                <input type="number" [(ngModel)]="openingAmount" class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none bg-white">
              </div>
            </div>

            <button (click)="openShift()" class="w-full max-w-xs bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">
              {{ t('openRegister') }}
            </button>
          </div>
        } @else {
          <!-- OPEN SHIFT DASHBOARD -->
          <div class="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            
            <!-- LEFT: Shift Details & Close -->
            <div class="flex-1 p-6 space-y-6">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">{{ t('shiftInfo') }}</span>
                <div class="mt-2 space-y-2">
                   <div class="flex justify-between">
                     <span class="text-slate-600">{{ t('openedAt') }}</span>
                     <span class="font-mono">{{ activeShift()?.openedAt | date:'shortTime' }}</span>
                   </div>
                   <div class="flex justify-between">
                     <span class="text-slate-600">Opened By</span>
                     <span class="font-mono font-bold">{{ activeShift()?.userName }}</span>
                   </div>
                   <div class="flex justify-between">
                     <span class="text-slate-600">{{ t('startCash') }}</span>
                     <span class="font-mono font-bold">S/.{{ activeShift()?.startCash | number:'1.2-2' }}</span>
                   </div>
                   <div class="flex justify-between pt-2 border-t border-slate-100">
                     <span class="text-slate-800 font-bold">{{ t('expectedCash') }}</span>
                     <span class="font-mono font-bold text-2xl text-blue-600">S/.{{ activeShift()?.endCashExpected | number:'1.2-2' }}</span>
                   </div>
                </div>
              </div>

              <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                <p><strong>{{ t('blindCount') }}</strong></p>
              </div>

              <div class="pt-4 border-t border-slate-100">
                 <h3 class="font-bold text-lg text-slate-800 mb-4">{{ t('closeShift') }}</h3>
                 
                 <div class="mb-4">
                    <label class="block text-sm font-bold text-slate-700 mb-1">{{ t('actualCashCounted') }}</label>
                    <div class="relative">
                      <span class="absolute left-3 top-2 text-slate-400">S/.</span>
                      <input type="number" [(ngModel)]="closingAmount" class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
                    </div>
                 </div>

                 @if (currentDiff !== 0 && closingAmount > 0) {
                   <div class="text-sm font-bold mb-4" [class.text-red-500]="currentDiff < 0" [class.text-green-500]="currentDiff > 0">
                      {{ t('difference') }}: {{ currentDiff > 0 ? '+' : '' }}S/.{{ currentDiff | number:'1.2-2' }}
                   </div>
                 }

                 <button (click)="closeShift()" class="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">
                    {{ t('closeAndPrint') }}
                 </button>
              </div>
            </div>

            <!-- RIGHT: Tabs (Expenses / Sales) -->
            <div class="flex-1 p-6 bg-slate-50 flex flex-col">
               
               <!-- Tabs -->
               <div class="flex gap-2 mb-4 bg-white p-1 rounded-lg border border-slate-200">
                 <button 
                   (click)="currentView.set('expenses')" 
                   class="flex-1 py-2 rounded-md text-sm font-bold transition-colors"
                   [class.bg-slate-100]="currentView() === 'expenses'"
                   [class.text-slate-800]="currentView() === 'expenses'"
                   [class.text-slate-500]="currentView() !== 'expenses'"
                 >
                   {{ t('expenses') }}
                 </button>
                 <button 
                   (click)="currentView.set('sales')" 
                   class="flex-1 py-2 rounded-md text-sm font-bold transition-colors"
                   [class.bg-slate-100]="currentView() === 'sales'"
                   [class.text-slate-800]="currentView() === 'sales'"
                   [class.text-slate-500]="currentView() !== 'sales'"
                 >
                   {{ t('sales') }}
                 </button>
               </div>

               @if (currentView() === 'expenses') {
                   <div class="flex justify-between items-center mb-4 animate-in fade-in">
                     <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
                       <span class="material-icons text-orange-600">money_off</span>
                       {{ t('expenses') }}
                     </h3>
                     <span class="text-sm font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                       {{ t('total') }}: S/.{{ totalExpenses() | number:'1.2-2' }}
                     </span>
                   </div>

                   <!-- Expense Form -->
                   <div class="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6 animate-in fade-in">
                     <div class="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label class="block text-xs font-bold text-slate-500 mb-1">{{ t('amount') }}</label>
                          <input type="number" [(ngModel)]="newExpenseAmount" class="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50">
                        </div>
                        <div>
                          <label class="block text-xs font-bold text-slate-500 mb-1">{{ t('category') }}</label>
                          <select [(ngModel)]="newExpenseCategory" class="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50">
                            <option value="SUPPLIES">{{ t('catSupplies') }}</option>
                            <option value="FOOD">{{ t('catFood') }}</option>
                            <option value="SERVICES">{{ t('catServices') }}</option>
                            <option value="OTHER">{{ t('catOther') }}</option>
                          </select>
                        </div>
                     </div>
                     <div class="mb-3">
                       <label class="block text-xs font-bold text-slate-500 mb-1">{{ t('description') }}</label>
                       <input type="text" [(ngModel)]="newExpenseDesc" class="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50" placeholder="e.g. Lunch">
                     </div>
                     <button (click)="addExpense()" class="w-full bg-orange-600 text-white py-2 rounded font-bold text-sm hover:bg-orange-700">
                       {{ t('saveExpense') }}
                     </button>
                   </div>

                   <!-- Expense List -->
                   <div class="flex-1 overflow-hidden flex flex-col animate-in fade-in">
                      <div class="space-y-2 flex-1 overflow-y-auto">
                        @for (exp of currentShiftExpenses(); track exp.id) {
                          <div class="flex justify-between items-center p-3 bg-white border border-slate-200 rounded shadow-sm hover:border-red-300 transition-colors group">
                            <div class="flex-1">
                              <p class="font-bold text-sm text-slate-800">{{ exp.description }}</p>
                              <p class="text-xs text-slate-500">{{ exp.category }} • {{ exp.userName }}</p>
                            </div>
                            <div class="flex items-center gap-3">
                              <span class="font-bold text-red-600">-S/.{{ exp.amount | number:'1.2-2' }}</span>
                              <button (click)="deleteExpense(exp.id)" class="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" [title]="t('delete')">
                                <span class="material-icons text-lg">delete</span>
                              </button>
                            </div>
                          </div>
                        } @empty {
                          <div class="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
                            <span class="material-icons mb-2">receipt_long</span>
                            <p class="text-sm italic">{{ t('noExpenses') }}</p>
                          </div>
                        }
                      </div>
                   </div>
               } @else {
                   <!-- SALES VIEW -->
                   <div class="flex justify-between items-center mb-4 animate-in fade-in">
                     <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
                       <span class="material-icons text-blue-600">receipt</span>
                       {{ t('sales') }}
                     </h3>
                     <span class="text-sm font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                       {{ t('total') }}: S/.{{ totalSales() | number:'1.2-2' }}
                     </span>
                   </div>

                   <div class="flex-1 overflow-hidden flex flex-col animate-in fade-in">
                      <div class="space-y-2 flex-1 overflow-y-auto">
                        @for (sale of currentShiftSales(); track sale.id) {
                          <div class="p-3 bg-white border border-slate-200 rounded shadow-sm hover:border-blue-300 transition-colors">
                            <div class="flex justify-between items-start mb-2">
                              <div>
                                <p class="font-bold text-sm text-slate-800">{{ sale.timestamp | date:'mediumTime' }}</p>
                                <p class="text-xs text-slate-500">
                                  {{ sale.paymentMethod }} • {{ sale.userName }}
                                </p>
                              </div>
                              <span class="font-bold text-blue-600">S/.{{ sale.total | number:'1.2-2' }}</span>
                            </div>
                            <!-- Detailed Items within Sales Ticket -->
                            <div class="bg-slate-50 p-2 rounded text-xs text-slate-600 space-y-1">
                               @for (item of sale.items; track item.variantId) {
                                 <div class="flex justify-between">
                                    <span class="truncate pr-2">{{ item.quantity }}x {{ item.productName }}</span>
                                    <span>{{ (item.price * item.quantity) | number:'1.2-2' }}</span>
                                 </div>
                               }
                            </div>
                          </div>
                        } @empty {
                          <div class="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
                            <span class="material-icons mb-2">shopping_bag</span>
                            <p class="text-sm italic">{{ t('noSales') }}</p>
                          </div>
                        }
                      </div>
                   </div>
               }
            </div>
          </div>
        }
      </div>

      <!-- History List (Global) -->
      @if (db.shifts().length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 class="font-bold text-slate-700">{{ t('shiftHistory') }}</h3>
          </div>
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-6 py-3">{{ t('date') }}</th>
                <th class="px-6 py-3">User</th>
                <th class="px-6 py-3">{{ t('status') }}</th>
                <th class="px-6 py-3 text-right">{{ t('expected') }}</th>
                <th class="px-6 py-3 text-right">{{ t('actual') }}</th>
                <th class="px-6 py-3 text-right">{{ t('diff') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (shift of db.shifts(); track shift.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-6 py-3">{{ shift.openedAt | date:'medium' }}</td>
                  <td class="px-6 py-3">
                    <div class="font-medium">{{ shift.userName }}</div>
                    @if(shift.closedByUserName && shift.closedByUserName !== shift.userName) {
                      <div class="text-xs text-slate-400">Closed by: {{ shift.closedByUserName }}</div>
                    }
                  </td>
                  <td class="px-6 py-3">
                    <span class="px-2 py-0.5 rounded text-xs font-bold" [class.bg-green-100]="shift.status=='OPEN'" [class.text-green-700]="shift.status=='OPEN'" [class.bg-slate-200]="shift.status=='CLOSED'">
                      {{ t(shift.status.toLowerCase()) }}
                    </span>
                  </td>
                  <td class="px-6 py-3 text-right">S/.{{ shift.endCashExpected | number:'1.2-2' }}</td>
                  <td class="px-6 py-3 text-right">{{ shift.endCashActual ? 'S/.'+(shift.endCashActual | number:'1.2-2') : '-' }}</td>
                  <td class="px-6 py-3 text-right font-bold" [class.text-red-500]="(shift.endCashActual || 0) - shift.endCashExpected < 0">
                     @if(shift.status === 'CLOSED') {
                        {{ (shift.endCashActual || 0) - shift.endCashExpected | number:'1.2-2' }}
                     }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

    </div>
  `
})
export class CashControlComponent {
  db = inject(DbService);
  translationService = inject(TranslationService);

  activeShift = this.db.activeShift;

  // View State (Expenses vs Sales)
  currentView = signal<'expenses' | 'sales'>('expenses');

  // Separate properties for opening and closing amounts
  openingAmount: number = 0;
  closingAmount: number = 0;

  // Expense Form Props
  newExpenseAmount = 0;
  newExpenseCategory: Expense['category'] = 'SUPPLIES';
  newExpenseDesc = '';

  get currentDiff(): number {
    const shift = this.activeShift();
    if (!shift) return 0;
    return this.closingAmount - shift.endCashExpected;
  }

  currentShiftExpenses = computed(() => {
    const shift = this.activeShift();
    if (!shift) return [];
    return this.db.expenses().filter(e => e.shiftId === shift.id).sort((a, b) => b.timestamp - a.timestamp);
  });

  // New computed for detailed sales list
  currentShiftSales = computed(() => {
    const shift = this.activeShift();
    if (!shift) return [];
    return this.db.sales().filter(s => s.shiftId === shift.id).sort((a, b) => b.timestamp - a.timestamp);
  });

  totalExpenses = computed(() => {
    return this.currentShiftExpenses().reduce((sum, e) => sum + e.amount, 0);
  });

  totalSales = computed(() => {
    return this.currentShiftSales().reduce((sum, s) => sum + s.total, 0);
  });

  addExpense() {
    try {
      this.db.addExpense(this.newExpenseAmount, this.newExpenseCategory, this.newExpenseDesc);
      // Reset form
      this.newExpenseAmount = 0;
      this.newExpenseDesc = '';
      // No alert needed for better UX, visualized in list
    } catch (e: any) {
      alert(e.message);
    }
  }

  deleteExpense(id: string) {
    if (confirm(this.t('confirmDeleteExpense'))) {
      try {
        this.db.deleteExpense(id);
      } catch (e: any) {
        alert(e.message);
      }
    }
  }

  openShift() {
    try {
      if (this.openingAmount < 0) throw new Error('Cannot open with negative cash.');
      this.db.openShift(this.openingAmount);
      this.openingAmount = 0;
    } catch (e: any) {
      alert(e.message);
    }
  }

  closeShift() {
    const shift = this.activeShift();
    if (!shift) {
      alert("No active shift found.");
      return;
    }

    // Get the closing amount
    const finalAmount = Number(this.closingAmount) || 0;

    // Validate amount
    if (finalAmount <= 0) {
      alert('Por favor ingrese el monto de efectivo real contado.');
      return;
    }

    try {
      const difference = finalAmount - shift.endCashExpected;

      // Close logic - save a copy before closing
      const shiftToReport = { ...shift };

      this.db.closeShift(finalAmount);
      this.closingAmount = 0;

      try {
        this.generateAndDownloadReport(shiftToReport, finalAmount, difference);
      } catch (reportError) {
        console.error("Report generation failed:", reportError);
      }

      alert('¡Turno cerrado exitosamente! Cerrando sesión...');
      this.db.logout();

    } catch (e: any) {
      console.error('Error closing shift:', e);
      alert('ERROR al cerrar turno: ' + e.message);
    }
  }

  generateAndDownloadReport(shift: CashShift, actual: number, diff: number) {
    const currentUser = this.db.currentUser();
    const date = new Date();

    // 1. Calculate Aggregates
    const shiftSales = this.db.sales().filter(s => s.shiftId === shift.id);
    const shiftExpenses = this.db.expenses().filter(e => e.shiftId === shift.id);

    const totalSalesCash = shiftSales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
    const totalSalesCard = shiftSales.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = shiftExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 2. Itemized Sales Audit
    const itemMap = new Map<string, { name: string, sku: string, qty: number, subtotal: number }>();

    shiftSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!itemMap.has(item.variantId)) {
          itemMap.set(item.variantId, {
            name: item.productName,
            sku: item.sku,
            qty: 0,
            subtotal: 0
          });
        }
        const entry = itemMap.get(item.variantId)!;
        entry.qty += item.quantity;
        entry.subtotal += (item.price * item.quantity);
      });
    });

    const lines = [
      "==========================================",
      "     SOPHIE POS - REPORTE DE CIERRE       ",
      "==========================================",
      `ID Turno:      ${shift.id.substring(0, 8)}`,
      `Fecha:         ${date.toLocaleDateString()}`,
      `Hora Cierre:   ${date.toLocaleTimeString()}`,
      `Responsable:   ${shift.userName} -> ${currentUser?.name}`,
      "==========================================",
      " BALANCE FINANCIERO",
      "------------------------------------------",
      ` (+) Fondo Inicial:      S/. ${shift.startCash.toFixed(2)}`,
      ` (+) Ventas Efectivo:    S/. ${totalSalesCash.toFixed(2)}`,
      ` (-) Gastos/Salidas:     S/. ${totalExpenses.toFixed(2)}`,
      "------------------------------------------",
      ` (=) Efectivo Esperado:  S/. ${shift.endCashExpected.toFixed(2)}`,
      `     Efectivo Real:      S/. ${actual.toFixed(2)}`,
      `     DIFERENCIA:         S/. ${diff.toFixed(2)}`,
      "------------------------------------------",
      ` (*) Ventas Tarjeta:     S/. ${totalSalesCard.toFixed(2)}`,
      "==========================================",
      " DETALLE DE GASTOS (Caja Chica)",
      "------------------------------------------",
      ...shiftExpenses.map(e =>
        ` [${new Date(e.timestamp).toLocaleTimeString()}] ${e.category.padEnd(8)} S/.${e.amount.toFixed(2)} - ${e.description}`
      ),
      shiftExpenses.length === 0 ? " (Sin gastos registrados)" : "",
      "------------------------------------------",
      ` TOTAL GASTOS:           S/. ${totalExpenses.toFixed(2)}`,
      "==========================================",
      " DETALLE DE VENTAS (TICKETS)",
      "------------------------------------------",
      ...shiftSales.map(s => {
        const t = new Date(s.timestamp).toLocaleTimeString();
        const head = ` [${t}] ${s.paymentMethod} | S/.${s.total.toFixed(2)} | ${s.userName}`;
        const body = s.items.map(i => `     ${i.quantity}x ${i.productName} (${i.attributeSummary})`).join('\n');
        return `${head}\n${body}\n- - - - - - - - - - - - - - - - - - - - -`;
      }),
      shiftSales.length === 0 ? " (Sin ventas registradas)" : "",
      "==========================================",
      " AUDITORIA DE PRODUCTOS VENDIDOS (AGRUPADO)",
      "------------------------------------------",
      " SKU       | QTY | SUBTOTAL  | PRODUCTO",
      "------------------------------------------",
      ...Array.from(itemMap.values()).map(i =>
        ` ${i.sku.padEnd(10)}| ${i.qty.toString().padEnd(4)}| S/.${i.subtotal.toFixed(2).padEnd(6)}| ${i.name}`
      ),
      "==========================================",
      diff === 0 ? "           BALANCE EXACTO                 " : "          REVISAR DIFERENCIAS             ",
      "=========================================="
    ];

    const textContent = lines.join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Cierre_${date.toISOString().slice(0, 10)}_${shift.userName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(url);
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}