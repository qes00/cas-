import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';

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

  scanner = inject(ScannerService);
  translationService = inject(TranslationService);

  showAddModal = signal(false);

  searchQuery = signal('');

  // UI State for Collapsible Rows
  expandedProductIds = signal<Set<string>>(new Set());

  // Editing State
  editingProductId = signal<string | null>(null);

  // Form State
  newName = signal('');
  newCategory = signal('General');
  newBasePrice = signal(0);
  newLowStockThreshold = signal(10); // Default to 10
  newDesc = signal('');
  newImageBase64 = signal<string | null>(null);
  newImageUrl = signal('');
  isImageProcessing = signal(false);

  // Image Loading State Management
  imageLoadStates = signal<Map<string, 'loading' | 'loaded' | 'error'>>(new Map());
  imageErrors = signal<Set<string>>(new Set());

  // Default fallback image
  readonly DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4=';

  // Matrix Builders
  attributes = signal<{ name: string, values: string }[]>([{ name: 'Size', values: 'S, M, L' }, { name: 'Color', values: 'Red, Blue' }]);

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

  // --- Collapsible Logic ---
  toggleExpand(productId: string) {
    this.expandedProductIds.update(currentSet => {
      const newSet = new Set(currentSet);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }

  isExpanded(productId: string): boolean {
    return this.expandedProductIds().has(productId);
  }

  openModal() {
    // Clean state for new product
    this.editingProductId.set(null);
    this.newName.set('');
    this.newDesc.set('');
    this.newBasePrice.set(0);
    this.newLowStockThreshold.set(10);
    this.newCategory.set('General');
    this.newImageBase64.set(null);
    this.attributes.set([{ name: 'Size', values: 'S, M, L' }, { name: 'Color', values: 'Red, Blue' }]);

    this.showAddModal.set(true);
    this.showAddModal.set(true);
    this.newImageUrl.set('');
    this.generatePreview();
  }

  editProduct(product: Product) {
    this.editingProductId.set(product.id);
    this.newName.set(product.name);
    this.newDesc.set(product.description);
    this.newBasePrice.set(product.basePrice);
    this.newLowStockThreshold.set(product.lowStockThreshold || 10);
    this.newCategory.set(product.category);
    this.newCategory.set(product.category);

    // Check if image is URL or Base64 (simple heuristic: starts with http)
    const img = product.image || null;
    if (img && img.startsWith('http')) {
      this.newImageUrl.set(img);
      this.newImageBase64.set(null);
    } else {
      this.newImageBase64.set(img);
      this.newImageUrl.set('');
    }

    // Reconstruct Attributes for the Form (convert arrays back to CSV string)
    if (product.attributes && product.attributes.length > 0) {
      const formAttributes = product.attributes.map(a => ({
        name: a.name,
        values: a.values.join(', ')
      }));
      this.attributes.set(formAttributes);
    } else {
      this.attributes.set([]);
    }

    // Load Existing Variants into Preview
    const existingVariants = this.db.getVariantsForProduct(product.id);
    const mappedVariants = existingVariants.map(v => ({
      id: v.id, // Keep ID for update
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      attributeSummary: v.attributeSummary,
      attributeValues: v.attributeValues
    }));

    this.previewVariants.set(mappedVariants);
    this.showAddModal.set(true);
  }

  deleteProduct(product: Product) {
    if (confirm(this.t('confirmDeleteProduct'))) {
      this.db.deleteProduct(product.id);
    }
  }

  deleteVariant(variantId: string) {
    if (confirm(this.t('confirmDeleteVariant'))) {
      this.db.deleteVariant(variantId);
    }
  }

  closeModal() {
    this.showAddModal.set(false);
    this.editingProductId.set(null);
  }

  // Helper to fix template error with arrow functions
  getProductStock(productId: string): number {
    return this.db.getVariantsForProduct(productId).reduce((sum, v) => sum + v.stock, 0);
  }

  addAttribute() {
    this.attributes.update(a => [...a, { name: '', values: '' }]);
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
    // If editing and we haven't touched attributes, we might want to keep existing variants
    // But for simplicity, we regenerate if attributes change.

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

    const variants = combinations.map((combo, idx) => {
      const summaryParts: string[] = [];
      const attrValues: Record<string, string> = {};

      attrs.forEach((attr, idx) => {
        summaryParts.push(`${attr.name}: ${combo[idx]}`);
        attrValues[attr.name] = combo[idx];
      });

      // Try to preserve existing values if editing (Basic matching by summary)
      const existing = this.editingProductId()
        ? this.db.getVariantsForProduct(this.editingProductId()!).find(v => v.attributeSummary === summaryParts.join(', '))
        : null;

      return {
        id: existing?.id, // Preserve ID if match found
        sku: existing?.sku || '',
        price: existing?.price || this.newBasePrice(),
        stock: existing?.stock || 0,
        attributeSummary: summaryParts.join(', '),
        attributeValues: attrValues
      };
    });

    this.previewVariants.set(variants);
  }

  processImageUrl() {
    const url = this.newImageUrl().trim();
    if (!url) return;

    // Google Drive Link Converter
    let finalUrl = url;
    let fileId = '';

    const patterns = [
      /\/file\/d\/([^\/]+)/,           // Standard share link
      /id=([^\&]+)/,                   // Query parameter format
      /\/d\/([^\/\?]+)/,               // Short format
      /\/open\?id=([^\&]+)/            // Open format
    ];

    if (url.includes('drive.google.com')) {
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          fileId = match[1];
          break;
        }
      }

      if (fileId) {
        // Use the thumbnail format which is more reliable for CORS
        finalUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
        this.newImageUrl.set(finalUrl);
        console.log('✅ Google Drive URL converted:', finalUrl);
      } else {
        console.warn('⚠️ No se pudo extraer el ID del archivo de Google Drive. Asegúrate de que el link sea público.');
      }
    }

    // Clear base64 if URL is set
    this.newImageBase64.set(null);

    // Validate URL format
    try {
      new URL(finalUrl);
    } catch (e) {
      console.error('❌ URL inválida:', finalUrl);
      alert('La URL proporcionada no es válida. Por favor verifica el formato.');
      this.newImageUrl.set('');
    }
  }

  get previewImageSrc(): string | null {
    return this.newImageBase64() || this.newImageUrl() || null;
  }

  saveProduct() {
    const isEdit = !!this.editingProductId();
    const prodId = isEdit ? this.editingProductId()! : crypto.randomUUID();

    // Prioritize Base64 (uploaded) if present, else URL, else Random
    const finalImage = this.newImageBase64() || this.newImageUrl() || `https://picsum.photos/200?random=${Date.now()}`;

    const finalAttributes = this.attributes()
      .filter(a => a.name && a.values)
      .map(a => ({
        name: a.name,
        values: a.values.split(',').map(v => v.trim())
      }));

    const productData: Product = {
      id: prodId,
      name: this.newName(),
      description: this.newDesc(),
      category: this.newCategory(),
      basePrice: this.newBasePrice(),
      lowStockThreshold: this.newLowStockThreshold(),
      attributes: finalAttributes,
      image: finalImage
    };

    const finalVariants: Variant[] = this.previewVariants().map((pv, idx) => ({
      id: pv.id || crypto.randomUUID(), // Use existing ID if available (update) or new
      productId: prodId,
      sku: pv.sku || `${this.newName().substring(0, 3).toUpperCase()}-${idx}`,
      barcode: Math.floor(100000 + Math.random() * 900000).toString(),
      price: pv.price,
      stock: pv.stock,
      attributeSummary: pv.attributeSummary,
      attributeValues: pv.attributeValues,
      image: productData.image // inherit parent for now
    }));

    if (isEdit) {
      this.db.updateProduct(productData, finalVariants);
    } else {
      this.db.addProduct(productData, finalVariants);
    }

    this.closeModal();
  }

  // Image Loading Handlers
  onImageError(event: Event, imageId: string) {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.src = this.DEFAULT_IMAGE;
      this.imageErrors.update(errors => {
        const newErrors = new Set(errors);
        newErrors.add(imageId);
        return newErrors;
      });
      this.imageLoadStates.update(states => {
        const newStates = new Map(states);
        newStates.set(imageId, 'error');
        return newStates;
      });
    }
  }

  onImageLoad(event: Event, imageId: string) {
    this.imageLoadStates.update(states => {
      const newStates = new Map(states);
      newStates.set(imageId, 'loaded');
      return newStates;
    });
  }

  getImageSrc(product: Product): string {
    if (this.imageErrors().has(product.id)) {
      return this.DEFAULT_IMAGE;
    }
    return product.image || this.DEFAULT_IMAGE;
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}