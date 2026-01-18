import { Injectable, signal, inject, effect } from '@angular/core';
import { Customer } from './data.types';
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
export class CustomerService {
    private authService = inject(AuthService);
    private db: Firestore | null = null;
    private listenersActive = false;

    customers = signal<Customer[]>([]);

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
                localStorage.setItem('rf_customers', JSON.stringify(this.customers()));
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
        const q = query(collection(this.db, 'customers'));
        onSnapshot(q, (snapshot) => {
            const data: Customer[] = [];
            snapshot.forEach((d) => data.push(d.data() as Customer));
            this.customers.set(data);
        }, (error) => {
            console.error('Error listening to customers:', error);
        });
    }

    private loadFromLocal() {
        try {
            this.customers.set(JSON.parse(localStorage.getItem('rf_customers') || '[]'));
        } catch (e) {
            console.error('Error loading local customers data', e);
        }
    }

    private clearData() {
        this.listenersActive = false;
        this.customers.set([]);
    }

    private async saveData(data: Customer) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await setDoc(doc(this.db, 'customers', data.id), data);
            } catch (e) {
                console.error('Error saving customer', e);
            }
        }
    }

    private async removeData(customerId: string) {
        if (this.authService.isCloudConnected() && this.db) {
            try {
                await deleteDoc(doc(this.db, 'customers', customerId));
            } catch (e) {
                console.error('Error deleting customer', e);
            }
        }
    }

    // --- Public API ---

    addCustomer(name: string, email?: string, phone?: string, address?: string, notes?: string): Customer {
        const customer: Customer = {
            id: crypto.randomUUID(),
            name,
            email,
            phone,
            address,
            notes,
            totalPurchases: 0,
            totalSpent: 0,
            createdAt: Date.now()
        };

        this.customers.update(c => [customer, ...c]);
        this.saveData(customer);
        return customer;
    }

    updateCustomer(customer: Customer): void {
        this.customers.update(list => list.map(c => c.id === customer.id ? customer : c));
        this.saveData(customer);
    }

    deleteCustomer(customerId: string): void {
        this.customers.update(list => list.filter(c => c.id !== customerId));
        this.removeData(customerId);
    }

    getCustomer(id: string): Customer | undefined {
        return this.customers().find(c => c.id === id);
    }

    searchCustomers(query: string): Customer[] {
        const q = query.toLowerCase();
        return this.customers().filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        );
    }

    recordPurchase(customerId: string, amount: number): void {
        const customer = this.getCustomer(customerId);
        if (customer) {
            const updated: Customer = {
                ...customer,
                totalPurchases: customer.totalPurchases + 1,
                totalSpent: customer.totalSpent + amount,
                lastPurchaseAt: Date.now()
            };
            this.updateCustomer(updated);
        }
    }

    getTopCustomers(limit: number = 10): Customer[] {
        return [...this.customers()]
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, limit);
    }
}
