import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbService } from '../../services/db.service';
import { ScannerService } from '../../services/scanner.service';
import { TranslationService } from '../../services/translation.service';
import { CartItem, Variant, Sale } from '../../services/data.types';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.component.html'
})
export class PosComponent implements OnInit, OnDestroy {
  db = inject(DbService);
  scanner = inject(ScannerService);
  translationService = inject(TranslationService);

  cart = signal<CartItem[]>([]);
  searchQuery = signal('');
  showScanner = signal(false);
  
  // Computed
  filteredVariants = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.db.variants().filter(v => {
      const p = this.db.getProduct(v.productId);
      const searchStr = `${p?.name} ${v.sku} ${v.attributeSummary}`.toLowerCase();
      return searchStr.includes(q);
    });
  });

  cartTotal = computed(() => this.cart().reduce((sum, item) => sum + (item.price * item.quantity), 0));
  shiftOpen = computed(() => !!this.db.activeShift());

  private scanSub!: Subscription;

  ngOnInit() {
    this.scanSub = this.scanner.scanResult.subscribe(code => {
      this.handleScan(code);
    });
  }

  ngOnDestroy() {
    this.scanSub.unsubscribe();
  }

  handleScan(code: string) {
    const variant = this.db.findVariantByCode(code);
    if (variant) {
      this.addToCart(variant);
      // Play beep sound
      this.playBeep();
    } else {
      alert(`Product not found: ${code}`);
    }
  }

  playBeep() {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.start();
    setTimeout(() => osc.stop(), 100);
  }

  addToCart(variant: Variant) {
    const product = this.db.getProduct(variant.productId);
    if (!product) return;

    this.cart.update(items => {
      const existing = items.find(i => i.variantId === variant.id);
      if (existing) {
        return items.map(i => i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...items, {
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        sku: variant.sku,
        price: variant.price,
        quantity: 1,
        image: variant.image,
        attributeSummary: variant.attributeSummary
      }];
    });
  }

  updateQuantity(variantId: string, delta: number) {
    this.cart.update(items => {
      return items.map(i => {
        if (i.variantId === variantId) {
          const newQ = i.quantity + delta;
          return newQ > 0 ? { ...i, quantity: newQ } : i;
        }
        return i;
      });
    });
  }

  removeFromCart(variantId: string) {
    this.cart.update(items => items.filter(i => i.variantId !== variantId));
  }

  checkout(method: 'CASH' | 'CARD') {
    if (this.cart().length === 0) return;
    
    const sale: Sale = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      total: this.cartTotal(),
      items: this.cart(),
      paymentMethod: method,
      shiftId: this.db.activeShift()?.id || null
    };

    this.db.recordSale(sale);
    this.cart.set([]);
    alert('Sale Completed!');
  }

  toggleCamera() {
    this.showScanner.set(!this.showScanner());
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}