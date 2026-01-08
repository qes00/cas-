import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbService } from '../../services/db.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 class="text-3xl font-bold text-slate-800">{{ t('dashboardTitle') }}</h2>
           <p class="text-slate-500">{{ t('dashboardSubtitle') }}</p>
        </div>
        <button (click)="generateWeeklyReport()" class="bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-bold hover:bg-blue-700 transition flex items-center gap-2">
           <span class="material-icons">assessment</span>
           {{ t('downloadWeeklyReport') }}
        </button>
      </header>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        
        <!-- Total Revenue -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <div class="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
            <span class="material-icons text-3xl">attach_money</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">{{ t('totalRevenue') }}</p>
            <p class="text-2xl font-bold text-slate-900">S/.{{ totalRevenue() | number:'1.2-2' }}</p>
          </div>
        </div>

        <!-- Weekly Revenue (New) -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <div class="p-3 rounded-full bg-emerald-100 text-emerald-600 mr-4">
            <span class="material-icons text-3xl">date_range</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">{{ t('weeklyRevenue') }}</p>
            <p class="text-2xl font-bold text-slate-900">S/.{{ weeklyRevenue() | number:'1.2-2' }}</p>
          </div>
        </div>

        <!-- Transactions -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <div class="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
            <span class="material-icons text-3xl">receipt</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">{{ t('transactions') }}</p>
            <p class="text-2xl font-bold text-slate-900">{{ totalTransactions() }}</p>
          </div>
        </div>

        <!-- Low Stock -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <div class="p-3 rounded-full bg-orange-100 text-orange-600 mr-4">
            <span class="material-icons text-3xl">inventory</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">{{ t('lowStockItems') }}</p>
            <p class="text-2xl font-bold text-slate-900">{{ lowStockCount() }}</p>
          </div>
        </div>

        <!-- Shift Status -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <div class="p-3 rounded-full mr-4" [class.bg-green-100]="isShiftOpen()" [class.text-green-600]="isShiftOpen()" [class.bg-red-100]="!isShiftOpen()" [class.text-red-600]="!isShiftOpen()">
            <span class="material-icons text-3xl">{{ isShiftOpen() ? 'lock_open' : 'lock' }}</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">{{ t('registerStatus') }}</p>
            <p class="text-xl font-bold text-slate-900">{{ isShiftOpen() ? t('open') : t('closed') }}</p>
          </div>
        </div>
      </div>

      <!-- Low Stock Alert List -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 class="font-bold text-slate-700">{{ t('stockAlerts') }}</h3>
          <span class="text-xs font-semibold bg-orange-100 text-orange-800 px-2 py-1 rounded-full">{{ t('below5Units') }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50 text-slate-500 font-medium uppercase text-xs">
              <tr>
                <th class="px-6 py-3">{{ t('product') }}</th>
                <th class="px-6 py-3">{{ t('variant') }}</th>
                <th class="px-6 py-3">{{ t('sku') }}</th>
                <th class="px-6 py-3 text-right">{{ t('remaining') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (item of lowStockItems(); track item.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-6 py-3 font-medium text-slate-900">
                    {{ getProductName(item.productId) }}
                  </td>
                  <td class="px-6 py-3">{{ item.attributeSummary }}</td>
                  <td class="px-6 py-3 font-mono text-xs">{{ item.sku }}</td>
                  <td class="px-6 py-3 text-right text-red-600 font-bold">{{ item.stock }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-6 py-8 text-center text-slate-400">{{ t('stockHealthy') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  db = inject(DbService);
  translationService = inject(TranslationService);

  totalRevenue = computed(() => this.db.sales().reduce((sum, s) => sum + s.total, 0));
  
  // Weekly Revenue Logic (Current Week: Monday to Sunday)
  weeklyRevenue = computed(() => {
    const now = new Date();
    const day = now.getDay(); 
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0); 
    
    const timestampStart = startOfWeek.getTime();

    return this.db.sales()
      .filter(s => s.timestamp >= timestampStart)
      .reduce((sum, s) => sum + s.total, 0);
  });

  totalTransactions = computed(() => this.db.sales().length);
  
  lowStockItems = computed(() => this.db.variants().filter(v => v.stock < 5));
  lowStockCount = computed(() => this.lowStockItems().length);
  
  isShiftOpen = computed(() => !!this.db.activeShift());

  getProductName(pid: string) {
    return this.db.products().find(p => p.id === pid)?.name || 'Unknown';
  }
  
  generateWeeklyReport() {
    const now = new Date();
    // 7 Days ago at 00:00:00
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0,0,0,0);
    const fromTime = sevenDaysAgo.getTime();
    
    const reportSales = this.db.sales().filter(s => s.timestamp >= fromTime);
    const reportExpenses = this.db.expenses().filter(e => e.timestamp >= fromTime);
    
    // Aggregates
    const totalSales = reportSales.reduce((acc, s) => acc + s.total, 0);
    const totalExpenses = reportExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = totalSales - totalExpenses;

    // Aggregate by Day (Sales)
    const dailyMap = new Map<string, number>();
    // Aggregate by Product
    const productMap = new Map<string, {name: string, qty: number, total: number}>();
    
    reportSales.forEach(s => {
       const dateKey = new Date(s.timestamp).toLocaleDateString();
       dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + s.total);
       
       s.items.forEach(i => {
         if (!productMap.has(i.variantId)) {
           productMap.set(i.variantId, { name: `${i.productName} (${i.attributeSummary})`, qty: 0, total: 0});
         }
         const p = productMap.get(i.variantId)!;
         p.qty += i.quantity;
         p.total += (i.price * i.quantity);
       });
    });
    
    // Sort Maps
    const sortedDays = Array.from(dailyMap.entries()).sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const sortedProducts = Array.from(productMap.values()).sort((a,b) => b.qty - a.qty); // Top selling first

    const lines = [
      "==============================================",
      " SOPHIE POS - REPORTE SEMANAL (7 DIAS)",
      "==============================================",
      ` Fecha Generación: ${now.toLocaleString()}`,
      ` Periodo: ${sevenDaysAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      "==============================================",
      " RESUMEN FINANCIERO",
      "----------------------------------------------",
      ` (+) Total Ventas:    S/.${totalSales.toFixed(2)}`,
      ` (-) Total Gastos:    S/.${totalExpenses.toFixed(2)}`,
      "----------------------------------------------",
      ` (=) BALANCE NETO:    S/.${netProfit.toFixed(2)}`,
      "==============================================",
      " VENTAS POR DÍA",
      "----------------------------------------------",
      " FECHA       | INGRESOS",
      "----------------------------------------------",
      ...sortedDays.map(d => ` ${d[0].padEnd(12)}| S/.${d[1].toFixed(2)}`),
      "----------------------------------------------",
      "==============================================",
      " PRODUCTOS MÁS VENDIDOS (TOP)",
      "----------------------------------------------",
      " QTY  | TOTAL     | PRODUCTO",
      "----------------------------------------------",
      ...sortedProducts.map(p => ` ${p.qty.toString().padEnd(5)}| S/.${p.total.toFixed(2).padEnd(7)}| ${p.name}`),
      "==============================================",
      " DETALLE DE GASTOS",
      "----------------------------------------------",
       ...reportExpenses.map(e => ` ${new Date(e.timestamp).toLocaleDateString().padEnd(12)} | S/.${e.amount.toFixed(2).padEnd(8)} | ${e.category} - ${e.description}`),
       reportExpenses.length === 0 ? " (Sin gastos)" : "",
      "=============================================="
    ];
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Semanal_${now.toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}