import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryComponent } from './components/inventory/inventory.component';
import { PosComponent } from './components/pos/pos.component';
import { CashControlComponent } from './components/cash/cash-control.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ScannerService } from './services/scanner.service';
import { TranslationService } from './services/translation.service';
import { DbService } from './services/db.service';
import { User } from './services/data.types';

type ViewState = 'dashboard' | 'pos' | 'inventory' | 'cash';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, InventoryComponent, PosComponent, CashControlComponent, DashboardComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  scannerService = inject(ScannerService);
  translationService = inject(TranslationService);
  db = inject(DbService);
  
  currentView = signal<ViewState>('dashboard');
  isSidebarOpen = signal(true);
  
  // Login State
  selectedUserForLogin = signal<User | null>(null);
  passwordInput = signal('');
  loginError = signal('');
  
  // Global Keydown for Barcode Scanner Hardware Emulation
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Only handle scanner if logged in
    if (this.db.currentUser()) {
       this.scannerService.handleKeyInput(event);
    } else if (this.selectedUserForLogin() && event.key === 'Enter') {
      // Allow Enter key to submit password
      this.confirmLogin();
    }
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
  
  // --- Auth Flow ---

  initiateLogin(user: User) {
    this.selectedUserForLogin.set(user);
    this.passwordInput.set('');
    this.loginError.set('');
  }

  confirmLogin() {
    const user = this.selectedUserForLogin();
    const pass = this.passwordInput();

    if (!user) return;

    try {
      this.db.login(user.id, pass);
      // Success: reset state
      this.selectedUserForLogin.set(null);
      this.passwordInput.set('');
      this.loginError.set('');
    } catch (e: any) {
      this.loginError.set(e.message || this.t('invalidPassword'));
      // Shake animation trigger logic could go here
    }
  }

  cancelLogin() {
    this.selectedUserForLogin.set(null);
    this.passwordInput.set('');
    this.loginError.set('');
  }

  logout() {
    this.db.logout();
    this.currentView.set('dashboard');
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }

  setLang(lang: 'en' | 'es') {
    this.translationService.setLanguage(lang);
  }
}