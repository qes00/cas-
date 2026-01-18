import { Injectable, signal, inject, effect } from '@angular/core';
import { Return, CartItem } from './data.types';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { ShiftService } from './shift.service';
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
export class ReturnService {
    private authService = inject(AuthService);
    private productService = inject(ProductService);
    private shiftService = inject(ShiftService);
    private db: Firestore | null = null;
    private listenersActive = false;

    returns = signal<Return[]>([]);

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
                localStorage.setItem('rf_returns', JSON.stringify(this.returns()));
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
        const q = query(collection(this.db, 'returns'));
        onSnapshot(q, (snapshot) => {
            const data: Return[] = [];
            snapshot.forEach((d) => data.push(d.data() as Return));
            this.returns.set(data);
        }, (error) => {
            console.error('Error listening to returns:', error);
        });
    }

    private loadFromLocal() {
        try {
            this.returns.set(JSON.parse(localStorage.getItem('rf_returns') || '[]'));
        } catch (e) {
            console.error('Error loading local returns data', e);
        }
    }

    private clearData() {
        this.listenersActive = false;
        this.returns.set([]);
    }

    private async saveData(data: Return) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, 'returns', data.id), data);
            } catch (e) {
                console.error('Error saving return', e);
            }
        }
    }

    // --- Public API ---

    createReturn(
        saleId: string,
        items: CartItem[],
        reason: string,
        refundMethod: Return['refundMethod'],
        notes?: string
    ): Return {
        const user = this.authService.currentUser();
        if (!user) {
            throw new Error('Usuario no autenticado');
        }

        const refundAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const returnEntry: Return = {
            id: crypto.randomUUID(),
            saleId,
            items,
            reason,
            refundAmount,
            refundMethod,
            timestamp: Date.now(),
            userId: user.id,
            userName: user.name,
            status: 'PENDING',
            notes
        };

        this.returns.update(r => [returnEntry, ...r]);
        this.saveData(returnEntry);
        return returnEntry;
    }

    processReturn(returnId: string): void {
        const returnEntry = this.returns().find(r => r.id === returnId);
        if (!returnEntry) {
            throw new Error('Devolución no encontrada');
        }

        if (returnEntry.status !== 'PENDING') {
            throw new Error('Esta devolución ya fue procesada');
        }

        // Restore stock
        for (const item of returnEntry.items) {
            this.productService.updateStock(item.variantId, item.quantity);
        }

        // Update shift if cash refund
        if (returnEntry.refundMethod === 'CASH' && this.shiftService.isShiftOpen()) {
            this.shiftService.updateExpectedCash(-returnEntry.refundAmount);
        }

        // Mark as completed
        const completed: Return = { ...returnEntry, status: 'COMPLETED' };
        this.returns.update(list => list.map(r => r.id === returnId ? completed : r));
        this.saveData(completed);
    }

    rejectReturn(returnId: string, notes?: string): void {
        const returnEntry = this.returns().find(r => r.id === returnId);
        if (!returnEntry) {
            throw new Error('Devolución no encontrada');
        }

        const rejected: Return = {
            ...returnEntry,
            status: 'REJECTED',
            notes: notes || returnEntry.notes
        };

        this.returns.update(list => list.map(r => r.id === returnId ? rejected : r));
        this.saveData(rejected);
    }

    getReturnsBySale(saleId: string): Return[] {
        return this.returns().filter(r => r.saleId === saleId);
    }

    getPendingReturns(): Return[] {
        return this.returns().filter(r => r.status === 'PENDING');
    }

    getReturnsByDateRange(startDate: number, endDate: number): Return[] {
        return this.returns().filter(r => r.timestamp >= startDate && r.timestamp <= endDate);
    }

    getTotalRefunds(startDate?: number, endDate?: number): number {
        let filtered = this.returns().filter(r => r.status === 'COMPLETED');

        if (startDate) {
            filtered = filtered.filter(r => r.timestamp >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(r => r.timestamp <= endDate);
        }

        return filtered.reduce((sum, r) => sum + r.refundAmount, 0);
    }
}
