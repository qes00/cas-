import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { GeminiService } from '../../services/gemini.service';
import { ScannerService } from '../../services/scanner.service';
import { TranslationService } from '../../services/translation.service';
import { Product, Variant } from '../../services/data.types';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit, OnDestroy {
  db = inject(DbService);
  gemini = inject(GeminiService);
  scanner = inject(ScannerService);
  translationService = inject(TranslationService);

  showAddModal = signal(false);
  isGenerating = signal(false);
  searchQuery = signal('');

  // Form State
  newName = signal('');
  newCategory = signal('General');
  newBasePrice = signal(0);
  newDesc = signal('');
  newImageBase64 = signal<string | null>(null);
  isImageProcessing = signal(false);
  
  // Matrix Builders
  attributes = signal<{name: string, values: string}[]>([{name: 'Size', values: 'S, M, L'}, {name: 'Color', values: 'Red, Blue'}]);

  // Preview of generated variants
  previewVariants = signal<any[]>([]);

  private scanSub!: Subscription;

  // Filter products based on search or scan
  filteredProducts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.db.products();

    // Find products where Name matches OR where any Variant matches (SKU/Barcode)
    return this.db.products().filter(p => {
      const nameMatch = p.name.toLowerCase().includes(q);
      if (nameMatch) return true;

      const variants = this.db.getVariantsForProduct(p.id);
      return variants.some(v => v.sku.toLowerCase().includes(q) || v.barcode === q);
    });
  });

  ngOnInit() {
    this.scanSub = this.scanner.scanResult.subscribe(code => {
      this.searchQuery.set(code);
    });
  }

  ngOnDestroy() {
    if (this.scanSub) this.scanSub.unsubscribe();
  }

  openModal() {
    this.showAddModal.set(true);
    this.generatePreview();
  }

  closeModal() {
    this.showAddModal.set(false);
    // Reset form
    this.newName.set('');
    this.newDesc.set('');
    this.newImageBase64.set(null);
  }

  // Helper to fix template error with arrow functions
  getProductStock(productId: string): number {
    return this.db.getVariantsForProduct(productId).reduce((sum, v) => sum + v.stock, 0);
  }

  addAttribute() {
    this.attributes.update(a => [...a, {name: '', values: ''}]);
  }

  removeAttribute(index: number) {
    this.attributes.update(a => a.filter((_, i) => i !== index));
    this.generatePreview();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    this.isImageProcessing.set(true);
    try {
      const webpBase64 = await this.convertToWebP(file);
      this.newImageBase64.set(webpBase64);
    } catch (error) {
      console.error("Image conversion failed", error);
      alert("Failed to process image. Please try another one.");
      this.newImageBase64.set(null);
    } finally {
      this.isImageProcessing.set(false);
    }
  }

  private convertToWebP(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 512;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
  
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Could not get canvas context');
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
          resolve(webpDataUrl);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }

  generatePreview() {
    // Cartesian Product Logic
    const attrs = this.attributes().filter(a => a.name && a.values);
    if (attrs.length === 0) {
      this.previewVariants.set([]);
      return;
    }

    const valueArrays = attrs.map(a => a.values.split(',').map(v => v.trim()).filter(v => v));
    
    // Helper to generate combinations
    const cartesian = (args: string[][]): string[][] => {
      const r: string[][] = [];
      const max = args.length - 1;
      function helper(arr: string[], i: number) {
        for (let j = 0, l = args[i].length; j < l; j++) {
          const a = arr.slice(0); // clone arr
          a.push(args[i][j]);
          if (i === max) r.push(a);
          else helper(a, i + 1);
        }
      }
      helper([], 0);
      return r;
    };

    const combinations = cartesian(valueArrays);
    
    const variants = combinations.map(combo => {
      const summaryParts: string[] = [];
      const attrValues: Record<string, string> = {};
      
      attrs.forEach((attr, idx) => {
        summaryParts.push(`${attr.name}: ${combo[idx]}`);
        attrValues[attr.name] = combo[idx];
      });

      return {
        sku: '', // To be filled by user or auto
        price: this.newBasePrice(),
        stock: 0,
        attributeSummary: summaryParts.join(', '),
        attributeValues: attrValues
      };
    });

    this.previewVariants.set(variants);
  }

  async generateAiDescription() {
    this.isGenerating.set(true);
    const attrs = this.attributes().map(a => a.name).join(', ');
    const desc = await this.gemini.generateProductDescription(this.newName(), attrs);
    this.newDesc.set(desc);
    this.isGenerating.set(false);
  }

  saveProduct() {
    const prodId = crypto.randomUUID();
    
    const finalAttributes = this.attributes()
      .filter(a => a.name && a.values)
      .map(a => ({
        name: a.name,
        values: a.values.split(',').map(v => v.trim())
      }));

    const newProduct: Product = {
      id: prodId,
      name: this.newName(),
      description: this.newDesc(),
      category: this.newCategory(),
      basePrice: this.newBasePrice(),
      attributes: finalAttributes,
      image: this.newImageBase64() || `https://picsum.photos/200?random=${Date.now()}`
    };

    const newVariants: Variant[] = this.previewVariants().map((pv, idx) => ({
      id: crypto.randomUUID(),
      productId: prodId,
      sku: pv.sku || `${this.newName().substring(0,3).toUpperCase()}-${idx}`,
      barcode: Math.floor(100000 + Math.random() * 900000).toString(),
      price: pv.price,
      stock: pv.stock,
      attributeSummary: pv.attributeSummary,
      attributeValues: pv.attributeValues,
      image: newProduct.image // inherit parent for now
    }));

    this.db.addProduct(newProduct, newVariants);
    this.closeModal();
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}