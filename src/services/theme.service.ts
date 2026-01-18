import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly STORAGE_KEY = 'app-theme';

    currentTheme = signal<Theme>(this.getInitialTheme());

    constructor() {
        this.applyTheme(this.currentTheme());
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme(): void {
        const newTheme: Theme = this.currentTheme() === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Set a specific theme
     */
    setTheme(theme: Theme): void {
        this.currentTheme.set(theme);
        this.applyTheme(theme);
        this.saveTheme(theme);
    }

    /**
     * Get the initial theme from localStorage or system preference
     */
    private getInitialTheme(): Theme {
        // Check localStorage first
        const savedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme;
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    }

    /**
     * Apply theme to document
     */
    private applyTheme(theme: Theme): void {
        document.documentElement.setAttribute('data-theme', theme);

        // Also add a class for easier CSS targeting
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
        } else {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
        }
    }

    /**
     * Save theme preference to localStorage
     */
    private saveTheme(theme: Theme): void {
        localStorage.setItem(this.STORAGE_KEY, theme);
    }

    /**
     * Listen to system theme changes
     */
    listenToSystemThemeChanges(): void {
        if (!window.matchMedia) return;

        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        darkModeQuery.addEventListener('change', (e) => {
            // Only auto-change if user hasn't manually set a preference
            const savedTheme = localStorage.getItem(this.STORAGE_KEY);
            if (!savedTheme) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}
