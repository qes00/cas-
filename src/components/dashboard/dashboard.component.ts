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
      <header class="mb-6">
        <h2 class="text-3xl font-bold text-slate-800">{{ t('dashboardTitle') }}</h2>
        <p class="text-slate-500">{{ t('dashboardSubtitle') }}</p>
      </header>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <!-- Total Sales -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <div class="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
            <span class="material-icons text-3xl">attach_money</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">{{ t('totalRevenue') }}</p>
            <p class="text-2xl font-bold text-slate-900">S/.{{ totalRevenue() | number:'1.2-2' }}</p>
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
  totalTransactions = computed(() => this.db.sales().length);
  
  lowStockItems = computed(() => this.db.variants().filter(v => v.stock < 5));
  lowStockCount = computed(() => this.lowStockItems().length);
  
  isShiftOpen = computed(() => !!this.db.activeShift());

  getProductName(pid: string) {
    return this.db.products().find(p => p.id === pid)?.name || 'Unknown';
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}