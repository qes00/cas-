import { Injectable, signal, computed, effect } from '@angular/core';
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    updateProfile,
    Auth,
    User as FirebaseUser
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    onSnapshot,
    query,
    Firestore
} from 'firebase/firestore';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { environment } from '../environments/environment';

export interface AppUser {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'SELLER';
    createdAt: number;
    lastLogin?: number;
    active: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private app: FirebaseApp;
    private auth: Auth;
    private db: Firestore;

    // Signals for reactive state
    firebaseUser = signal<FirebaseUser | null>(null);
    currentUser = signal<AppUser | null>(null);
    users = signal<AppUser[]>([]);
    isLoading = signal(true);
    authError = signal<string | null>(null);
    isCloudConnected = signal(false);

    // Computed properties
    isAuthenticated = computed(() => !!this.currentUser());
    isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
    isManager = computed(() => ['ADMIN', 'MANAGER'].includes(this.currentUser()?.role || ''));

    constructor() {
        // Initialize Firebase
        this.app = initializeApp(environment.firebase);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.isCloudConnected.set(true);

        // Listen for auth state changes
        onAuthStateChanged(this.auth, async (user) => {
            this.firebaseUser.set(user);

            if (user) {
                // Fetch user profile from Firestore
                await this.loadUserProfile(user.uid);
                // Update last login
                await this.updateLastLogin(user.uid);
            } else {
                this.currentUser.set(null);
            }

            this.isLoading.set(false);
        });

        // Listen for all users (for admin panel)
        this.listenToUsers();
    }

    getFirestore(): Firestore {
        return this.db;
    }

    private async loadUserProfile(uid: string): Promise<void> {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // IMPORTANT: Always ensure id is set from document ID, not from data
                const user: AppUser = {
                    id: uid, // Always use the document ID
                    email: userData['email'] || '',
                    name: userData['name'] || 'Usuario',
                    role: userData['role'] || 'SELLER',
                    createdAt: userData['createdAt'] || Date.now(),
                    lastLogin: userData['lastLogin'],
                    active: userData['active'] !== false
                };
                this.currentUser.set(user);

                // Update the document if id was missing
                if (!userData['id'] || userData['id'] !== uid) {
                    await setDoc(doc(this.db, 'users', uid), { id: uid }, { merge: true });
                }
            } else {
                // User exists in Auth but not in Firestore - create profile
                const fbUser = this.firebaseUser();
                if (fbUser) {
                    const newUser: AppUser = {
                        id: uid,
                        email: fbUser.email || '',
                        name: fbUser.displayName || 'Usuario',
                        role: 'SELLER', // Default role
                        createdAt: Date.now(),
                        active: true
                    };
                    await setDoc(doc(this.db, 'users', uid), newUser);
                    this.currentUser.set(newUser);
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.authError.set('Error al cargar perfil de usuario');
        }
    }

    private async updateLastLogin(uid: string): Promise<void> {
        try {
            await setDoc(doc(this.db, 'users', uid), { lastLogin: Date.now() }, { merge: true });
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    private listenToUsers(): void {
        const q = query(collection(this.db, 'users'));
        onSnapshot(q, (snapshot) => {
            const users: AppUser[] = [];
            snapshot.forEach((doc) => users.push(doc.data() as AppUser));
            this.users.set(users);
        });
    }

    // --- Authentication Methods ---

    async login(email: string, password: string): Promise<void> {
        this.isLoading.set(true);
        this.authError.set(null);

        try {
            await signInWithEmailAndPassword(this.auth, email, password);
        } catch (error: any) {
            console.error('Login error:', error);
            this.authError.set(this.getErrorMessage(error.code));
            throw error;
        } finally {
            this.isLoading.set(false);
        }
    }

    async logout(): Promise<void> {
        try {
            await signOut(this.auth);
            this.currentUser.set(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async register(email: string, password: string, name: string, role: AppUser['role'] = 'SELLER'): Promise<void> {
        this.isLoading.set(true);
        this.authError.set(null);

        try {
            const credential = await createUserWithEmailAndPassword(this.auth, email, password);

            // Update display name
            await updateProfile(credential.user, { displayName: name });

            // Create user profile in Firestore
            const newUser: AppUser = {
                id: credential.user.uid,
                email,
                name,
                role,
                createdAt: Date.now(),
                active: true
            };

            await setDoc(doc(this.db, 'users', credential.user.uid), newUser);
            this.currentUser.set(newUser);
        } catch (error: any) {
            console.error('Registration error:', error);
            this.authError.set(this.getErrorMessage(error.code));
            throw error;
        } finally {
            this.isLoading.set(false);
        }
    }

    // --- User Management (Admin only) ---

    async createUser(email: string, password: string, name: string, role: AppUser['role']): Promise<void> {
        if (!this.isAdmin()) {
            throw new Error('Solo administradores pueden crear usuarios');
        }

        // Note: In production, this should be done via Cloud Functions
        // to avoid losing the current admin session
        await this.register(email, password, name, role);
    }

    async updateUserRole(userId: string, role: AppUser['role']): Promise<void> {
        if (!this.isAdmin()) {
            throw new Error('Solo administradores pueden cambiar roles');
        }

        try {
            await setDoc(doc(this.db, 'users', userId), { role }, { merge: true });
        } catch (error) {
            console.error('Error updating user role:', error);
            throw error;
        }
    }

    async deactivateUser(userId: string): Promise<void> {
        if (!this.isAdmin()) {
            throw new Error('Solo administradores pueden desactivar usuarios');
        }

        try {
            await setDoc(doc(this.db, 'users', userId), { active: false }, { merge: true });
        } catch (error) {
            console.error('Error deactivating user:', error);
            throw error;
        }
    }

    // --- Helper Methods ---

    private getErrorMessage(errorCode: string): string {
        const errorMessages: Record<string, string> = {
            'auth/invalid-email': 'Email inválido',
            'auth/user-disabled': 'Usuario deshabilitado',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/email-already-in-use': 'El email ya está en uso',
            'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
            'auth/invalid-credential': 'Credenciales inválidas',
            'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.'
        };

        return errorMessages[errorCode] || 'Error de autenticación';
    }
}
