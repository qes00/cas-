import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../../services/sales.service';
import { ProductService } from '../../services/product.service';
import { ShiftService } from '../../services/shift.service';
import { Sale, Product } from '../../services/data.types';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

interface DashboardMetrics {
    todaySales: number;
    todayRevenue: number;
    todayProfit: number;
    activeProducts: number;
    lowStockProducts: number;
}

interface TopProduct {
    nombre: string;
    cantidad_vendida: number;
    revenue: number;
}

@Component({
    selector: 'app-analytics-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './analytics-dashboard.component.html'
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('salesTrendCanvas') salesTrendCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('topProductsCanvas') topProductsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('categoryRevenueCanvas') categoryRevenueCanvas!: ElementRef<HTMLCanvasElement>;

    metrics = signal<DashboardMetrics>({
        todaySales: 0,
        todayRevenue: 0,
        todayProfit: 0,
        activeProducts: 0,
        lowStockProducts: 0
    });

    dateRange = signal<'today' | 'week' | 'month' | 'year'>('week');
    isLoading = signal(true);

    private salesTrendChart?: Chart;
    private topProductsChart?: Chart;
    private categoryRevenueChart?: Chart;

    constructor(
        private salesService: SalesService,
        private productService: ProductService,
        private shiftService: ShiftService
    ) { }

    async ngOnInit(): Promise<void> {
        await this.loadDashboardData();
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.createCharts();
        }, 100);
    }

    async loadDashboardData(): Promise<void> {
        this.isLoading.set(true);
        try {
            await this.loadMetrics();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    private async loadMetrics(): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all sales
        const allSales = await this.salesService.getAllSales();

        // Filter today's sales
        const todaySales = allSales.filter(sale => {
            const saleDate = sale.fecha.toDate();
            return saleDate >= today;
        });

        // Calculate metrics
        const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
        const todayProfit = todaySales.reduce((sum, sale) => {
            const profit = sale.productos.reduce((p, item) => {
                const cost = (item as any).costo || 0;
                return p + ((item.precio - cost) * item.cantidad);
            }, 0);
            return sum + profit;
        }, 0);

        // Get products
        const products = await this.productService.getAllProducts();
        const activeProducts = products.filter(p => p.activo).length;
        const lowStockProducts = products.filter(p => p.stock <= p.stock_minimo).length;

        this.metrics.set({
            todaySales: todaySales.length,
            todayRevenue,
            todayProfit,
            activeProducts,
            lowStockProducts
        });
    }

    private createCharts(): void {
        this.createSalesTrendChart();
        this.createTopProductsChart();
        this.createCategoryRevenueChart();
    }

    private async createSalesTrendChart(): Promise<void> {
        const ctx = this.salesTrendCanvas?.nativeElement;
        if (!ctx) return;

        const { labels, data } = await this.getSalesTrendData();

        if (this.salesTrendChart) {
            this.salesTrendChart.destroy();
        }

        const config: ChartConfiguration = {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Ventas ($)',
                    data,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Tendencia de Ventas'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `$${value}`
                        }
                    }
                }
            }
        };

        this.salesTrendChart = new Chart(ctx, config);
    }

    private async createTopProductsChart(): Promise<void> {
        const ctx = this.topProductsCanvas?.nativeElement;
        if (!ctx) return;

        const topProducts = await this.getTopProducts();

        if (this.topProductsChart) {
            this.topProductsChart.destroy();
        }

        const config: ChartConfiguration = {
            type: 'bar',
            data: {
                labels: topProducts.map(p => p.nombre),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: topProducts.map(p => p.cantidad_vendida),
                    backgroundColor: [
                        '#3498db',
                        '#2ecc71',
                        '#f39c12',
                        '#e74c3c',
                        '#9b59b6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Top 5 Productos Más Vendidos'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        this.topProductsChart = new Chart(ctx, config);
    }

    private async createCategoryRevenueChart(): Promise<void> {
        const ctx = this.categoryRevenueCanvas?.nativeElement;
        if (!ctx) return;

        const categoryData = await this.getCategoryRevenue();

        if (this.categoryRevenueChart) {
            this.categoryRevenueChart.destroy();
        }

        const config: ChartConfiguration = {
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.data,
                    backgroundColor: [
                        '#3498db',
                        '#2ecc71',
                        '#f39c12',
                        '#e74c3c',
                        '#9b59b6',
                        '#1abc9c'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Ingresos por Categoría'
                    }
                }
            }
        };

        this.categoryRevenueChart = new Chart(ctx, config);
    }

    private async getSalesTrendData(): Promise<{ labels: string[], data: number[] }> {
        const range = this.dateRange();
        const sales = await this.salesService.getAllSales();
        const now = new Date();

        let days = 7;
        if (range === 'today') days = 1;
        else if (range === 'month') days = 30;
        else if (range === 'year') days = 365;

        const labels: string[] = [];
        const data: number[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const daySales = sales.filter(sale => {
                const saleDate = sale.fecha.toDate();
                return saleDate >= date && saleDate < nextDate;
            });

            const dayRevenue = daySales.reduce((sum, sale) => sum + sale.total, 0);

            labels.push(date.toLocaleDateString('es', { month: 'short', day: 'numeric' }));
            data.push(dayRevenue);
        }

        return { labels, data };
    }

    private async getTopProducts(): Promise<TopProduct[]> {
        const sales = await this.salesService.getAllSales();
        const productMap = new Map<string, TopProduct>();

        sales.forEach(sale => {
            sale.productos.forEach(item => {
                const existing = productMap.get(item.nombre);
                if (existing) {
                    existing.cantidad_vendida += item.cantidad;
                    existing.revenue += item.precio * item.cantidad;
                } else {
                    productMap.set(item.nombre, {
                        nombre: item.nombre,
                        cantidad_vendida: item.cantidad,
                        revenue: item.precio * item.cantidad
                    });
                }
            });
        });

        return Array.from(productMap.values())
            .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
            .slice(0, 5);
    }

    private async getCategoryRevenue(): Promise<{ labels: string[], data: number[] }> {
        const sales = await this.salesService.getAllSales();
        const products = await this.productService.getAllProducts();
        const categoryMap = new Map<string, number>();

        sales.forEach(sale => {
            sale.productos.forEach(item => {
                const product = products.find(p => p.nombre === item.nombre);
                const category = product?.categoria || 'Sin categoría';
                const revenue = item.precio * item.cantidad;

                categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
            });
        });

        const labels = Array.from(categoryMap.keys());
        const data = Array.from(categoryMap.values());

        return { labels, data };
    }

    async onDateRangeChange(range: 'today' | 'week' | 'month' | 'year'): Promise<void> {
        this.dateRange.set(range);
        await this.createSalesTrendChart();
    }
}
