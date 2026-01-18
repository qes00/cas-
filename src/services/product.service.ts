import { Injectable, signal, inject, effect } from '@angular/core';
import { Product, Variant } from './data.types';
import { AuthService } from './auth.service';
import {
    collection,
    onSnapshot,
    setDoc,
    doc,
    deleteDoc,
    query,
    Firestore
} from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private authService = inject(AuthService);
    private db: Firestore | null = null;
    private listenersActive = false;

    // Signals for reactive state
    products = signal<Product[]>([]);
    variants = signal<Variant[]>([]);

    constructor() {
        // Initialize when authenticated
        effect(() => {
            const isConnected = this.authService.isCloudConnected();
            const user = this.authService.currentUser();

            if (isConnected && user && !this.listenersActive) {
                this.initListeners();
            } else if (!user && this.listenersActive) {
                this.clearData();
            }
        });

        // Auto-save local backup
        effect(() => {
            try {
                localStorage.setItem('rf_products', JSON.stringify(this.products()));
                localStorage.setItem('rf_variants', JSON.stringify(this.variants()));
            } catch (e) { console.error('Storage Error', e); }
        });
    }

    private initListeners() {
        this.db = this.authService.getFirestore();
        if (!this.db) {
            this.loadFromLocal();
            return;
        }

        this.listenersActive = true;
        this.listenToCollection('products', this.products);
        this.listenToCollection('variants', this.variants);
    }

    private listenToCollection(collectionName: string, signalToUpdate: any) {
        if (!this.db) return;
        const q = query(collection(this.db, collectionName));
        onSnapshot(q, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((d) => data.push(d.data()));
            signalToUpdate.set(data);
        }, (error) => {
            console.error(`Error listening to ${collectionName}:`, error);
        });
    }

    private loadFromLocal() {
        try {
            this.products.set(JSON.parse(localStorage.getItem('rf_products') || '[]'));
            this.variants.set(JSON.parse(localStorage.getItem('rf_variants') || '[]'));
            if (this.products().length === 0) this.seedProducts();
        } catch (e) {
            console.error('Error loading local data', e);
        }
    }

    private clearData() {
        this.listenersActive = false;
        this.products.set([]);
        this.variants.set([]);
    }

    private async saveData(collectionName: string, data: any) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, collectionName, data.id), data);
            } catch (e) {
                console.error(`Error saving to ${collectionName}`, e);
            }
        }
    }

    private async removeData(collectionName: string, docId: string) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await deleteDoc(doc(this.db, collectionName, docId));
            } catch (e) {
                console.error(`Error deleting from ${collectionName}`, e);
            }
        }
    }

    // --- Public API ---

    addProduct(product: Product, newVariants: Variant[]) {
        this.products.update(p => [product, ...p]);
        this.variants.update(v => [...newVariants, ...v]);

        this.saveData('products', product);
        newVariants.forEach(v => this.saveData('variants', v));
    }

    updateProduct(product: Product, variants: Variant[]) {
        this.products.update(list => list.map(p => p.id === product.id ? product : p));
        this.saveData('products', product);

        this.variants.update(list => {
            const other = list.filter(v => v.productId !== product.id);
            return [...other, ...variants];
        });
        variants.forEach(v => this.saveData('variants', v));
    }

    deleteProduct(productId: string) {
        const varsToDelete = this.variants().filter(v => v.productId === productId);
        this.products.update(list => list.filter(p => p.id !== productId));
        this.variants.update(list => list.filter(v => v.productId !== productId));

        this.removeData('products', productId);
        varsToDelete.forEach(v => this.removeData('variants', v.id));
    }

    deleteVariant(variantId: string) {
        this.variants.update(list => list.filter(v => v.id !== variantId));
        this.removeData('variants', variantId);
    }

    updateStock(variantId: string, quantityChange: number) {
        const target = this.variants().find(v => v.id === variantId);
        if (target) {
            const updated = { ...target, stock: target.stock + quantityChange };
            this.variants.update(all => all.map(v => v.id === variantId ? updated : v));
            this.saveData('variants', updated);
        }
    }

    // --- Query Methods ---

    findVariantByCode(code: string) {
        return this.variants().find(v => v.barcode === code || v.sku === code);
    }

    getProduct(id: string) {
        return this.products().find(p => p.id === id);
    }

    getVariantsForProduct(pid: string) {
        return this.variants().filter(v => v.productId === pid);
    }

    getLowStockVariants(threshold: number = 5) {
        return this.variants().filter(v => v.stock <= threshold);
    }

    // --- Seed Data ---
    private seedProducts() {
        const DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qcm9kdWN0byBEZW1vPC90ZXh0Pjwvc3ZnPg==';
        const pid = 'demo-shirt';
        const prod: Product = { id: pid, name: 'Camiseta Demo', description: 'Ejemplo inicial', category: 'Ropa', basePrice: 20, attributes: [], image: DEFAULT_IMAGE };
        const vary: Variant = { id: 'demo-var', productId: pid, sku: 'DEMO-001', barcode: '123456', price: 20, stock: 10, attributeSummary: 'Estándar', attributeValues: {}, image: DEFAULT_IMAGE };
        this.addProduct(prod, [vary]);
    }
}
