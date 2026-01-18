import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { Sale, CartItem } from './data.types';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import {
    collection,
    onSnapshot,
    setDoc,
    doc,
    query,
    Firestore
} from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class SalesService {
    private authService = inject(AuthService);
    private productService = inject(ProductService);
    private db: Firestore | null = null;
    private listenersActive = false;

    // Signals for reactive state
    sales = signal<Sale[]>([]);

    // Computed stats
    totalRevenue = computed(() => this.sales().reduce((sum, s) => sum + s.total, 0));

    weeklyRevenue = computed(() => {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return this.sales()
            .filter(s => s.timestamp >= oneWeekAgo)
            .reduce((sum, s) => sum + s.total, 0);
    });

    todayRevenue = computed(() => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return this.sales()
            .filter(s => s.timestamp >= startOfDay.getTime())
            .reduce((sum, s) => sum + s.total, 0);
    });

    transactionCount = computed(() => this.sales().length);

    constructor() {
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
                localStorage.setItem('rf_sales', JSON.stringify(this.sales()));
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
        const q = query(collection(this.db, 'sales'));
        onSnapshot(q, (snapshot) => {
            const data: Sale[] = [];
            snapshot.forEach((d) => data.push(d.data() as Sale));
            this.sales.set(data);
        }, (error) => {
            console.error('Error listening to sales:', error);
        });
    }

    private loadFromLocal() {
        try {
            this.sales.set(JSON.parse(localStorage.getItem('rf_sales') || '[]'));
        } catch (e) {
            console.error('Error loading local sales data', e);
        }
    }

    private clearData() {
        this.listenersActive = false;
        this.sales.set([]);
    }

    private async saveData(data: Sale) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, 'sales', data.id), data);
            } catch (e) {
                console.error('Error saving sale', e);
            }
        }
    }

    // --- Public API ---

    recordSale(sale: Sale, updateStock: boolean = true): { success: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate stock before sale
        for (const item of sale.items) {
            const variant = this.productService.variants().find(v => v.id === item.variantId);
            if (!variant) {
                errors.push(`Producto no encontrado: ${item.productName}`);
                continue;
            }
            if (variant.stock < item.quantity) {
                errors.push(`Stock insuficiente para ${item.productName}: disponible ${variant.stock}, solicitado ${item.quantity}`);
            }
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // Record sale
        const user = this.authService.currentUser();
        if (!sale.userId && user) {
            sale.userId = user.id;
            sale.userName = user.name;
        }

        this.sales.update(s => [sale, ...s]);
        this.saveData(sale);

        // Update stock
        if (updateStock) {
            sale.items.forEach(item => {
                this.productService.updateStock(item.variantId, -item.quantity);
            });
        }

        return { success: true, errors: [] };
    }

    getSalesByShift(shiftId: string): Sale[] {
        return this.sales().filter(s => s.shiftId === shiftId);
    }

    getSalesByDateRange(startDate: number, endDate: number): Sale[] {
        return this.sales().filter(s => s.timestamp >= startDate && s.timestamp <= endDate);
    }

    getSalesByUser(userId: string): Sale[] {
        return this.sales().filter(s => s.userId === userId);
    }

    getTopProducts(limit: number = 10): { productId: string; productName: string; quantity: number; revenue: number }[] {
        const productStats = new Map<string, { productName: string; quantity: number; revenue: number }>();

        this.sales().forEach(sale => {
            sale.items.forEach(item => {
                const existing = productStats.get(item.productId) || { productName: item.productName, quantity: 0, revenue: 0 };
                existing.quantity += item.quantity;
                existing.revenue += item.price * item.quantity;
                productStats.set(item.productId, existing);
            });
        });

        return Array.from(productStats.entries())
            .map(([productId, stats]) => ({ productId, ...stats }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    }
}
