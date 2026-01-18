import { Component, signal, inject, HostListener, OnInit, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryComponent } from './components/inventory/inventory.component';
import { PosComponent } from './components/pos/pos.component';
import { CashControlComponent } from './components/cash/cash-control.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ScannerService } from './services/scanner.service';
import { TranslationService } from './services/translation.service';
import { DbService } from './services/db.service';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

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
  auth = inject(AuthService);
  theme = inject(ThemeService);

  currentView = signal<ViewState>('dashboard');
  isSidebarOpen = signal(true);

  // Login State - Now uses email/password
  emailInput = signal('');
  passwordInput = signal('');
  isRegistering = signal(false);
  registerName = signal('');

  // Global Keydown for Barcode Scanner Hardware Emulation
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Only handle scanner if logged in
    if (this.auth.currentUser()) {
      this.scannerService.handleKeyInput(event);
    } else if (event.key === 'Enter' && !this.isRegistering()) {
      // Allow Enter key to submit login
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

  async confirmLogin() {
    const email = this.emailInput();
    const pass = this.passwordInput();

    if (!email || !pass) {
      return;
    }

    try {
      await this.auth.login(email, pass);
      // Success: reset state
      this.emailInput.set('');
      this.passwordInput.set('');
    } catch (e: any) {
      // Error is handled by auth service and shown via authError signal
      console.error('Login failed:', e);
    }
  }

  async confirmRegister() {
    const email = this.emailInput();
    const pass = this.passwordInput();
    const name = this.registerName();

    if (!email || !pass || !name) {
      return;
    }

    try {
      await this.auth.register(email, pass, name);
      // Success: reset state
      this.emailInput.set('');
      this.passwordInput.set('');
      this.registerName.set('');
      this.isRegistering.set(false);
    } catch (e: any) {
      console.error('Registration failed:', e);
    }
  }

  toggleRegistration() {
    this.isRegistering.update(v => !v);
    this.auth.authError.set(null);
  }

  logout() {
    this.auth.logout();
    this.currentView.set('dashboard');
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }

  setLang(lang: 'en' | 'es') {
    this.translationService.setLanguage(lang);
  }
}