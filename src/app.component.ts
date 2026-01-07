import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryComponent } from './components/inventory/inventory.component';
import { PosComponent } from './components/pos/pos.component';
import { CashControlComponent } from './components/cash/cash-control.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ScannerService } from './services/scanner.service';
import { TranslationService } from './services/translation.service';

type ViewState = 'dashboard' | 'pos' | 'inventory' | 'cash';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, InventoryComponent, PosComponent, CashControlComponent, DashboardComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  scannerService = inject(ScannerService);
  translationService = inject(TranslationService);
  
  currentView = signal<ViewState>('dashboard');
  
  isSidebarOpen = signal(true);

  // Global Keydown for Barcode Scanner Hardware Emulation
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    this.scannerService.handleKeyInput(event);
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  setView(view: ViewState) {
    this.currentView.set(view);
    // On mobile, auto-close sidebar after navigation
    if (window.innerWidth < 768) {
      this.isSidebarOpen.set(false);
    }
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }

  setLang(lang: 'en' | 'es') {
    this.translationService.setLanguage(lang);
  }
}
