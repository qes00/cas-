import { Injectable, signal, inject, effect } from '@angular/core';
import { Discount, AppliedDiscount, CartItem } from './data.types';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
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
export class DiscountService {
    private authService = inject(AuthService);
    private productService = inject(ProductService);
    private db: Firestore | null = null;
    private listenersActive = false;

    discounts = signal<Discount[]>([]);

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
                localStorage.setItem('rf_discounts', JSON.stringify(this.discounts()));
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
        const q = query(collection(this.db, 'discounts'));
        onSnapshot(q, (snapshot) => {
            const data: Discount[] = [];
            snapshot.forEach((d) => data.push(d.data() as Discount));
            this.discounts.set(data);
        }, (error) => {
            console.error('Error listening to discounts:', error);
        });
    }

    private loadFromLocal() {
        try {
            this.discounts.set(JSON.parse(localStorage.getItem('rf_discounts') || '[]'));
        } catch (e) {
            console.error('Error loading local discounts data', e);
        }
    }

    private clearData() {
        this.listenersActive = false;
        this.discounts.set([]);
    }

    private async saveData(data: Discount) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, 'discounts', data.id), data);
            } catch (e) {
                console.error('Error saving discount', e);
            }
        }
    }

    private async removeData(discountId: string) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await deleteDoc(doc(this.db, 'discounts', discountId));
            } catch (e) {
                console.error('Error deleting discount', e);
            }
        }
    }

    // --- Public API ---

    createDiscount(discount: Omit<Discount, 'id' | 'usageCount' | 'createdAt'>): Discount {
        const newDiscount: Discount = {
            ...discount,
            id: crypto.randomUUID(),
            usageCount: 0,
            createdAt: Date.now()
        };

        this.discounts.update(d => [newDiscount, ...d]);
        this.saveData(newDiscount);
        return newDiscount;
    }

    updateDiscount(discount: Discount): void {
        this.discounts.update(list => list.map(d => d.id === discount.id ? discount : d));
        this.saveData(discount);
    }

    deleteDiscount(discountId: string): void {
        this.discounts.update(list => list.filter(d => d.id !== discountId));
        this.removeData(discountId);
    }

    toggleActive(discountId: string): void {
        const discount = this.discounts().find(d => d.id === discountId);
        if (discount) {
            this.updateDiscount({ ...discount, active: !discount.active });
        }
    }

    // --- Discount Application Logic ---

    getActiveDiscounts(): Discount[] {
        const now = Date.now();
        return this.discounts().filter(d => {
            if (!d.active) return false;
            if (d.validFrom && now < d.validFrom) return false;
            if (d.validUntil && now > d.validUntil) return false;
            if (d.usageLimit && d.usageCount >= d.usageLimit) return false;
            return true;
        });
    }

    validateCoupon(code: string): Discount | null {
        const discount = this.getActiveDiscounts().find(
            d => d.couponCode && d.couponCode.toUpperCase() === code.toUpperCase()
        );
        return discount || null;
    }

    calculateDiscounts(cart: CartItem[], cartTotal: number, couponCode?: string): AppliedDiscount[] {
        const applied: AppliedDiscount[] = [];
        const activeDiscounts = this.getActiveDiscounts();

        // Apply automatic discounts (no coupon required)
        for (const discount of activeDiscounts.filter(d => !d.couponCode)) {
            const result = this.applyDiscount(discount, cart, cartTotal);
            if (result) {
                applied.push(result);
            }
        }

        // Apply coupon discount if provided
        if (couponCode) {
            const couponDiscount = this.validateCoupon(couponCode);
            if (couponDiscount) {
                const result = this.applyDiscount(couponDiscount, cart, cartTotal);
                if (result) {
                    applied.push(result);
                }
            }
        }

        return applied;
    }

    private applyDiscount(discount: Discount, cart: CartItem[], cartTotal: number): AppliedDiscount | null {
        // Check minimum purchase
        if (discount.minPurchase && cartTotal < discount.minPurchase) {
            return null;
        }

        let discountAmount = 0;

        switch (discount.scope) {
            case 'CART':
                discountAmount = this.calculateAmount(discount, cartTotal);
                break;

            case 'PRODUCT':
                if (!discount.productIds || discount.productIds.length === 0) return null;
                const productItems = cart.filter(item => discount.productIds!.includes(item.productId));
                const productTotal = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                discountAmount = this.calculateAmount(discount, productTotal);
                break;

            case 'CATEGORY':
                if (!discount.categoryNames || discount.categoryNames.length === 0) return null;
                const categoryItems = cart.filter(item => {
                    const product = this.productService.getProduct(item.productId);
                    return product && discount.categoryNames!.includes(product.category);
                });
                const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                discountAmount = this.calculateAmount(discount, categoryTotal);
                break;
        }

        if (discountAmount <= 0) return null;

        return {
            discountId: discount.id,
            discountName: discount.name,
            type: discount.type,
            value: discount.value,
            amount: discountAmount
        };
    }

    private calculateAmount(discount: Discount, baseAmount: number): number {
        let amount = 0;

        if (discount.type === 'PERCENTAGE') {
            amount = baseAmount * (discount.value / 100);
            // Apply max discount cap if set
            if (discount.maxDiscount && amount > discount.maxDiscount) {
                amount = discount.maxDiscount;
            }
        } else {
            amount = discount.value;
        }

        // Don't exceed the base amount
        return Math.min(amount, baseAmount);
    }

    incrementUsage(discountId: string): void {
        const discount = this.discounts().find(d => d.id === discountId);
        if (discount) {
            this.updateDiscount({ ...discount, usageCount: discount.usageCount + 1 });
        }
    }
}
