import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { CashShift, Expense } from './data.types';
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
export class ShiftService {
    private authService = inject(AuthService);
    private db: Firestore | null = null;
    private listenersActive = false;

    // Signals for reactive state
    shifts = signal<CashShift[]>([]);
    expenses = signal<Expense[]>([]);

    // Computed
    activeShift = computed(() => {
        const openShifts = this.shifts().filter(s => s.status === 'OPEN');
        if (openShifts.length === 0) return null;
        return openShifts.sort((a, b) => b.openedAt - a.openedAt)[0];
    });

    isShiftOpen = computed(() => !!this.activeShift());

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
                localStorage.setItem('rf_shifts', JSON.stringify(this.shifts()));
                localStorage.setItem('rf_expenses', JSON.stringify(this.expenses()));
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

        const shiftsQuery = query(collection(this.db, 'shifts'));
        onSnapshot(shiftsQuery, (snapshot) => {
            const data: CashShift[] = [];
            snapshot.forEach((d) => data.push(d.data() as CashShift));
            this.shifts.set(data);
            this.sanitizeShifts();
        }, (error) => {
            console.error('Error listening to shifts:', error);
        });

        const expensesQuery = query(collection(this.db, 'expenses'));
        onSnapshot(expensesQuery, (snapshot) => {
            const data: Expense[] = [];
            snapshot.forEach((d) => data.push(d.data() as Expense));
            this.expenses.set(data);
        }, (error) => {
            console.error('Error listening to expenses:', error);
        });
    }

    private loadFromLocal() {
        try {
            this.shifts.set(JSON.parse(localStorage.getItem('rf_shifts') || '[]'));
            this.expenses.set(JSON.parse(localStorage.getItem('rf_expenses') || '[]'));
            this.sanitizeShifts();
        } catch (e) {
            console.error('Error loading local shift data', e);
        }
    }

    private clearData() {
        this.listenersActive = false;
        this.shifts.set([]);
        this.expenses.set([]);
    }

    private sanitizeShifts() {
        const open = this.shifts().filter(s => s.status === 'OPEN');
        if (open.length > 1) {
            // Auto-close duplicate open shifts
            open.slice(1).forEach(s => {
                const closed: CashShift = {
                    ...s,
                    status: 'CLOSED',
                    closedAt: Date.now(),
                    endCashActual: s.startCash
                };
                this.shifts.update(l => l.map(x => x.id === s.id ? closed : x));
                this.saveShift(closed);
            });
        }
    }

    private async saveShift(data: CashShift) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, 'shifts', data.id), data);
            } catch (e) {
                console.error('Error saving shift', e);
            }
        }
    }

    private async saveExpense(data: Expense) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, 'expenses', data.id), data);
            } catch (e) {
                console.error('Error saving expense', e);
            }
        }
    }

    private async removeExpense(expenseId: string) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await deleteDoc(doc(this.db, 'expenses', expenseId));
            } catch (e) {
                console.error('Error deleting expense', e);
            }
        }
    }

    // --- Public API ---

    openShift(startCash: number): void {
        if (this.activeShift()) {
            throw new Error('Ya hay un turno abierto.');
        }

        const user = this.authService.currentUser();
        if (!user) {
            throw new Error('Debe iniciar sesión.');
        }

        const newShift: CashShift = {
            id: crypto.randomUUID(),
            openedAt: Date.now(),
            closedAt: null,
            startCash,
            endCashExpected: startCash,
            endCashActual: null,
            status: 'OPEN',
            movements: [],
            userId: user.id,
            userName: user.name
        };

        this.shifts.update(s => [newShift, ...s]);
        this.saveShift(newShift);
    }

    closeShift(actualCash: number): CashShift {
        const current = this.activeShift();
        const user = this.authService.currentUser();

        if (!current || !user) {
            throw new Error('Error de sesión o turno.');
        }

        const closedShift: CashShift = {
            ...current,
            closedAt: Date.now(),
            endCashActual: Number(actualCash) || 0,
            status: 'CLOSED',
            closedByUserId: user.id,
            closedByUserName: user.name
        };

        this.shifts.update(list => list.map(s => s.id === current.id ? closedShift : s));
        this.saveShift(closedShift);

        return closedShift;
    }

    updateExpectedCash(amount: number): void {
        const current = this.activeShift();
        if (!current) return;

        const updatedShift: CashShift = {
            ...current,
            endCashExpected: current.endCashExpected + amount
        };

        this.shifts.update(list => list.map(s => s.id === current.id ? updatedShift : s));
        this.saveShift(updatedShift);
    }

    addExpense(amount: number, category: Expense['category'], description: string): void {
        const current = this.activeShift();
        const user = this.authService.currentUser();

        if (!current || !user) {
            throw new Error('Error operativo.');
        }

        const expense: Expense = {
            id: crypto.randomUUID(),
            shiftId: current.id,
            amount,
            category,
            description,
            timestamp: Date.now(),
            userId: user.id,
            userName: user.name
        };

        this.expenses.update(e => [expense, ...e]);
        this.saveExpense(expense);

        // Update expected cash
        this.updateExpectedCash(-amount);
    }

    deleteExpense(expenseId: string): void {
        const current = this.activeShift();
        if (!current) {
            throw new Error('No hay turno abierto.');
        }

        const expense = this.expenses().find(e => e.id === expenseId);
        if (!expense) {
            throw new Error('Gasto no encontrado.');
        }

        this.expenses.update(list => list.filter(e => e.id !== expenseId));
        this.removeExpense(expenseId);

        // Return amount to expected cash
        this.updateExpectedCash(expense.amount);
    }

    // --- Query Methods ---

    getExpensesByShift(shiftId: string): Expense[] {
        return this.expenses().filter(e => e.shiftId === shiftId);
    }

    getShiftHistory(limit: number = 30): CashShift[] {
        return this.shifts()
            .filter(s => s.status === 'CLOSED')
            .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0))
            .slice(0, limit);
    }

    getTotalExpensesByShift(shiftId: string): number {
        return this.getExpensesByShift(shiftId).reduce((sum, e) => sum + e.amount, 0);
    }
}
