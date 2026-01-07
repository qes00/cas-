import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { TranslationService } from '../../services/translation.service';
import { CashShift } from '../../services/data.types';

@Component({
  selector: 'app-cash-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      
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
                <!-- Use standard property binding, not signal, for input stability -->
                <input type="number" [(ngModel)]="amountInput" class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none bg-white">
              </div>
            </div>

            <button (click)="openShift()" class="w-full max-w-xs bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">
              {{ t('openRegister') }}
            </button>
          </div>
        } @else {
          <!-- CLOSE SHIFT UI -->
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-6">
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
                     <span class="font-mono font-bold text-lg text-blue-600">S/.{{ activeShift()?.endCashExpected | number:'1.2-2' }}</span>
                   </div>
                </div>
              </div>

              <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                <p><strong>{{ t('blindCount') }}</strong></p>
              </div>
            </div>

            <div class="flex flex-col justify-center space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
               <h3 class="font-bold text-lg text-slate-800">{{ t('closeShift') }}</h3>
               
               <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">{{ t('actualCashCounted') }}</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-slate-400">S/.</span>
                    <input type="number" [(ngModel)]="amountInput" class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
                  </div>
               </div>

               @if (currentDiff !== 0 && amountInput > 0) {
                 <div class="text-sm font-bold" [class.text-red-500]="currentDiff < 0" [class.text-green-500]="currentDiff > 0">
                    {{ t('difference') }}: {{ currentDiff > 0 ? '+' : '' }}S/.{{ currentDiff | number:'1.2-2' }}
                 </div>
               }

               <button (click)="closeShift()" class="bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">
                  {{ t('closeAndPrint') }}
               </button>
            </div>
          </div>
        }
      </div>

      <!-- History List (Simplified) -->
      @if (db.shifts().length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 class="font-bold text-slate-700">{{ t('shiftHistory') }}</h3>
          </div>
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-6 py-3">{{ t('date') }}</th>
                <th class="px-6 py-3">Seller</th>
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
  
  // Use a simple number property to avoid Signal/Model binding conflicts
  amountInput: number = 0;
  
  get currentDiff(): number {
    const shift = this.activeShift();
    if (!shift) return 0;
    return this.amountInput - shift.endCashExpected;
  }

  openShift() {
    try {
      if (this.amountInput < 0) throw new Error('Cannot open with negative cash.');
      this.db.openShift(this.amountInput);
      this.amountInput = 0;
    } catch (e: any) {
      alert(e.message);
    }
  }

  closeShift() {
    const shift = this.activeShift();
    if (!shift) return;

    if (confirm('Are you sure you want to close this shift? This will generate a report.')) {
      try {
        const finalAmount = Number(this.amountInput);
        const difference = finalAmount - shift.endCashExpected;
        
        // 1. Generate Report Blob
        this.generateAndDownloadReport(shift, finalAmount, difference);

        // 2. Perform DB Closure
        this.db.closeShift(finalAmount);
        
        // 3. Reset
        this.amountInput = 0;
        alert('Shift Closed & Report Downloaded.');
        
      } catch (e: any) {
        console.error(e);
        alert('Error closing shift: ' + e.message);
      }
    }
  }

  generateAndDownloadReport(shift: CashShift, actual: number, diff: number) {
    const currentUser = this.db.currentUser();
    const date = new Date();
    
    const lines = [
      "==========================================",
      "       RETAIL FLOW - REPORTE DE CAJA      ",
      "==========================================",
      `Fecha Reporte: ${date.toLocaleString()}`,
      `ID Turno:      ${shift.id.substring(0, 8)}`,
      "------------------------------------------",
      "DETALLES DEL USUARIO",
      `Apertura por:  ${shift.userName}`,
      `Cierre por:    ${currentUser?.name || 'Desconocido'}`,
      "------------------------------------------",
      "TIEMPO",
      `Inicio:        ${new Date(shift.openedAt).toLocaleString()}`,
      `Fin:           ${date.toLocaleString()}`,
      "------------------------------------------",
      "RESUMEN DE EFECTIVO (PEN)",
      `Base Inicial:       S/. ${shift.startCash.toFixed(2)}`,
      `Ventas (Efectivo):  S/. ${(shift.endCashExpected - shift.startCash).toFixed(2)}`,
      "------------------------------------------",
      `TOTAL ESPERADO:     S/. ${shift.endCashExpected.toFixed(2)}`,
      `TOTAL REAL (Caja):  S/. ${actual.toFixed(2)}`,
      "------------------------------------------",
      `DIFERENCIA:         S/. ${diff.toFixed(2)}`,
      "==========================================",
      diff === 0 ? "             BALANCE EXACTO               " : (diff < 0 ? "           FALTANTE DE CAJA               " : "           SOBRANTE DE CAJA               "),
      "=========================================="
    ];

    const textContent = lines.join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cierre_caja_${date.toISOString().slice(0,10)}_${shift.id.substring(0,4)}.txt`;
    a.click();
    
    window.URL.revokeObjectURL(url);
  }
  
  t(key: string): string {
    return this.translationService.translate(key);
  }
}