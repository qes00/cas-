import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from './data.types';

@Injectable({
    providedIn: 'root'
})
export class PdfExportService {

    /**
     * Generate PDF report for sales
     */
    generateSalesReport(sales: Sale[], startDate?: Date, endDate?: Date): void {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Reporte de Ventas', 14, 22);

        // Date range
        doc.setFontSize(10);
        if (startDate && endDate) {
            doc.text(`Período: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 14, 30);
        } else {
            doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);
        }

        // Summary statistics
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
        const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;

        doc.setFontSize(12);
        doc.text(`Total de Ventas: ${totalSales}`, 14, 40);
        doc.text(`Ingresos Totales: $${totalRevenue.toFixed(2)}`, 14, 47);
        doc.text(`Promedio por Venta: $${avgSale.toFixed(2)}`, 14, 54);

        // Sales table
        const tableData = sales.map(sale => [
            new Date(sale.timestamp).toLocaleString(),
            sale.userName,
            sale.items.length.toString(),
            sale.paymentMethod,
            `$${sale.total.toFixed(2)}`
        ]);

        autoTable(doc, {
            head: [['Fecha/Hora', 'Usuario', 'Items', 'Pago', 'Total']],
            body: tableData,
            startY: 62,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [52, 152, 219] }
        });

        // Save PDF
        doc.save(`reporte_ventas_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    /**
     * Generate PDF report for inventory
     */
    generateInventoryReport(products: any[]): void {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Reporte de Inventario', 14, 22);

        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

        // Summary
        const totalProducts = products.length;
        const lowStock = products.filter(p => p.stock <= (p.stock_minimo || 5)).length;
        const outOfStock = products.filter(p => p.stock === 0).length;

        doc.setFontSize(12);
        doc.text(`Total de Productos: ${totalProducts}`, 14, 40);
        doc.text(`Stock Bajo: ${lowStock}`, 14, 47);
        doc.text(`Sin Stock: ${outOfStock}`, 14, 54);

        // Inventory table
        const tableData = products.map(product => [
            product.nombre || product.name || '',
            product.codigo_barras || product.barcode || '',
            product.categoria || product.category || '',
            product.stock?.toString() || '0',
            (product.stock_minimo || product.lowStockThreshold || 5).toString(),
            `$${(product.precio || product.price || 0).toFixed(2)}`
        ]);

        autoTable(doc, {
            head: [['Producto', 'Código', 'Categoría', 'Stock', 'Min', 'Precio']],
            body: tableData,
            startY: 62,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [52, 152, 219] },
            columnStyles: {
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'right' }
            }
        });

        // Save PDF
        doc.save(`reporte_inventario_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    /**
     * Generate PDF report for a single shift
     */
    generateShiftReport(shift: any, sales: Sale[], expenses: any[]): void {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Reporte de Turno', 14, 22);

        // Shift info
        doc.setFontSize(10);
        const openDate = new Date(shift.openedAt || shift.timestamp);
        const closeDate = shift.closedAt ? new Date(shift.closedAt) : null;

        doc.text(`Abierto: ${openDate.toLocaleString()}`, 14, 30);
        if (closeDate) {
            doc.text(`Cerrado: ${closeDate.toLocaleString()}`, 14, 37);
        }
        doc.text(`Usuario: ${shift.userName}`, 14, closeDate ? 44 : 37);

        // Financial summary
        const startY = closeDate ? 54 : 47;
        doc.setFontSize(12);
        doc.text('Resumen Financiero', 14, startY);
        doc.setFontSize(10);

        const cashSales = sales.filter(s => s.paymentMethod === 'CASH');
        const cardSales = sales.filter(s => s.paymentMethod === 'CARD');
        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        const startCash = shift.startCash || 0;
        const expectedCash = startCash + cashSales.reduce((sum, s) => sum + s.total, 0) - totalExpenses;

        let yPos = startY + 10;
        doc.text(`Efectivo Inicial: $${startCash.toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.text(`Ventas en Efectivo: $${cashSales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.text(`Ventas con Tarjeta: $${cardSales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.text(`Total Ventas: $${totalSales.toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.text(`Gastos: $${totalExpenses.toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.setFontSize(12);
        doc.text(`Efectivo Esperado: $${expectedCash.toFixed(2)}`, 14, yPos);

        yPos += 15;

        // Sales table
        if (sales.length > 0) {
            doc.setFontSize(12);
            doc.text('Ventas del Turno', 14, yPos);
            yPos += 5;

            const salesData = sales.map(sale => [
                new Date(sale.timestamp).toLocaleTimeString(),
                sale.items.length.toString(),
                sale.paymentMethod,
                `$${sale.total.toFixed(2)}`
            ]);

            autoTable(doc, {
                head: [['Hora', 'Items', 'Método', 'Total']],
                body: salesData,
                startY: yPos,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [46, 204, 113] }
            });
        }

        // Expenses table
        if (expenses.length > 0) {
            const finalY = (doc as any).lastAutoTable?.finalY || yPos + 10;

            doc.setFontSize(12);
            doc.text('Gastos del Turno', 14, finalY + 10);

            const expensesData = expenses.map(exp => [
                new Date(exp.timestamp).toLocaleTimeString(),
                exp.category,
                exp.description,
                `$${exp.amount.toFixed(2)}`
            ]);

            autoTable(doc, {
                head: [['Hora', 'Categoría', 'Descripción', 'Monto']],
                body: expensesData,
                startY: finalY + 15,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [231, 76, 60] }
            });
        }

        // Save PDF
        doc.save(`reporte_turno_${shift.id}_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    /**
     * Generate PDF customer statement
     */
    generateCustomerStatement(customer: any, sales: Sale[]): void {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Estado de Cuenta', 14, 22);

        // Customer info
        doc.setFontSize(12);
        doc.text(`Cliente: ${customer.name}`, 14, 32);
        if (customer.email) doc.text(`Email: ${customer.email}`, 14, 39);
        if (customer.phone) doc.text(`Teléfono: ${customer.phone}`, 14, 46);

        // Summary
        const totalPurchases = sales.length;
        const totalSpent = sales.reduce((sum, sale) => sum + sale.total, 0);

        doc.setFontSize(10);
        doc.text(`Total de Compras: ${totalPurchases}`, 14, 56);
        doc.text(`Total Gastado: $${totalSpent.toFixed(2)}`, 14, 63);
        doc.text(`Promedio por Compra: $${(totalSpent / totalPurchases || 0).toFixed(2)}`, 14, 70);

        // Purchase history table
        const tableData = sales.map(sale => [
            new Date(sale.timestamp).toLocaleDateString(),
            sale.items.length.toString(),
            sale.paymentMethod,
            `$${sale.total.toFixed(2)}`
        ]);

        autoTable(doc, {
            head: [['Fecha', 'Items', 'Método', 'Total']],
            body: tableData,
            startY: 78,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [155, 89, 182] }
        });

        // Save PDF
        doc.save(`estado_cuenta_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    /**
     * Generate daily summary PDF
     */
    generateDailySummary(data: {
        date: Date,
        sales: Sale[],
        expenses: any[],
        topProducts: Array<{ name: string, quantity: number, revenue: number }>
    }): void {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Resumen Diario', 14, 22);

        doc.setFontSize(12);
        doc.text(data.date.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 14, 32);

        // Financial summary
        const totalRevenue = data.sales.reduce((sum, s) => sum + s.total, 0);
        const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalRevenue - totalExpenses;

        doc.setFontSize(14);
        doc.text('Resumen Financiero', 14, 45);
        doc.setFontSize(10);
        doc.text(`Ingresos: $${totalRevenue.toFixed(2)}`, 14, 53);
        doc.text(`Gastos: $${totalExpenses.toFixed(2)}`, 14, 60);
        doc.setFontSize(12);
        doc.text(`Ganancia Neta: $${netProfit.toFixed(2)}`, 14, 70);

        // Top products
        if (data.topProducts.length > 0) {
            doc.setFontSize(14);
            doc.text('Productos Más Vendidos', 14, 85);

            const topProductsData = data.topProducts.map(p => [
                p.name,
                p.quantity.toString(),
                `$${p.revenue.toFixed(2)}`
            ]);

            autoTable(doc, {
                head: [['Producto', 'Cantidad', 'Ingresos']],
                body: topProductsData,
                startY: 90,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [52, 152, 219] }
            });
        }

        // Save PDF
        doc.save(`resumen_diario_${data.date.toISOString().split('T')[0]}.pdf`);
    }
}
