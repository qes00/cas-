import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';

@Component({
  selector: 'app-cash-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
           <h2 class="text-3xl font-bold text-slate-800">Cash Control</h2>
           <p class="text-slate-500">Manage daily shifts and cash flow.</p>
        </div>
        <div class="text-right">
           <span class="block text-sm text-slate-500">Current Status</span>
           <span class="font-bold text-xl" [class.text-green-600]="activeShift()" [class.text-red-500]="!activeShift()">
             {{ activeShift() ? 'SHIFT OPEN' : 'SHIFT CLOSED' }}
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
            <h3 class="text-2xl font-bold text-slate-800">Start New Shift</h3>
            <p class="text-slate-500 max-w-sm">Enter the amount of cash physically present in the drawer to begin selling.</p>
            
            <div class="w-full max-w-xs">
              <label class="block text-left text-sm font-bold text-slate-700 mb-1">Opening Cash Amount</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-slate-400">$</span>
                <input type="number" [(ngModel)]="inputAmount" class="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none">
              </div>
            </div>

            <button (click)="openShift()" class="w-full max-w-xs bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">
              Open Register
            </button>
          </div>
        } @else {
          <!-- CLOSE SHIFT UI -->
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-6">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Shift Information</span>
                <div class="mt-2 space-y-2">
                   <div class="flex justify-between">
                     <span class="text-slate-600">Opened At</span>
                     <span class="font-mono">{{ activeShift()?.openedAt | date:'shortTime' }}</span>
                   </div>
                   <div class="flex justify-between">
                     <span class="text-slate-600">Start Cash</span>
                     <span class="font-mono font-bold">\${{ activeShift()?.startCash | number:'1.2-2' }}</span>
                   </div>
                   <div class="flex justify-between pt-2 border-t border-slate-100">
                     <span class="text-slate-800 font-bold">Expected Cash</span>
                     <span class="font-mono font-bold text-lg text-blue-600">\${{ activeShift()?.endCashExpected | number:'1.2-2' }}</span>
                   </div>
                </div>
              </div>

              <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                <p><strong>Blind Count:</strong> Count the physical cash in the drawer before entering the amount below.</p>
              </div>
            </div>

            <div class="flex flex-col justify-center space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
               <h3 class="font-bold text-lg text-slate-800">Close Shift</h3>
               
               <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Actual Cash Counted</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-slate-400">$</span>
                    <input type="number" [(ngModel)]="inputAmount" class="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none">
                  </div>
               </div>

               @if (diff() !== 0 && inputAmount() > 0) {
                 <div class="text-sm font-bold" [class.text-red-500]="diff() < 0" [class.text-green-500]="diff() > 0">
                    Difference: {{ diff() > 0 ? '+' : '' }}\${{ diff() | number:'1.2-2' }}
                 </div>
               }

               <button (click)="closeShift()" class="bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">
                  Close Shift & Print Report
               </button>
            </div>
          </div>
        }
      </div>

      <!-- History List (Simplified) -->
      @if (db.shifts().length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 class="font-bold text-slate-700">Shift History</h3>
          </div>
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-6 py-3">Date</th>
                <th class="px-6 py-3">Status</th>
                <th class="px-6 py-3 text-right">Expected</th>
                <th class="px-6 py-3 text-right">Actual</th>
                <th class="px-6 py-3 text-right">Diff</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (shift of db.shifts(); track shift.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-6 py-3">{{ shift.openedAt | date:'medium' }}</td>
                  <td class="px-6 py-3">
                    <span class="px-2 py-0.5 rounded text-xs font-bold" [class.bg-green-100]="shift.status=='OPEN'" [class.text-green-700]="shift.status=='OPEN'" [class.bg-slate-200]="shift.status=='CLOSED'">
                      {{ shift.status }}
                    </span>
                  </td>
                  <td class="px-6 py-3 text-right">\${{ shift.endCashExpected | number:'1.2-2' }}</td>
                  <td class="px-6 py-3 text-right">{{ shift.endCashActual ? '$'+(shift.endCashActual | number:'1.2-2') : '-' }}</td>
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
  
  activeShift = this.db.activeShift;
  inputAmount = signal(0);
  
  diff = computed(() => {
    const shift = this.activeShift();
    if (!shift) return 0;
    return this.inputAmount() - shift.endCashExpected;
  });

  openShift() {
    this.db.openShift(this.inputAmount());
    this.inputAmount.set(0);
  }

  closeShift() {
    if (confirm('Are you sure you want to close this shift? This action cannot be undone.')) {
      this.db.closeShift(this.inputAmount());
      this.inputAmount.set(0);
    }
  }
}