import { Injectable } from '@angular/core';
import { Sale, CashShift, Expense } from './data.types';

@Injectable({
    providedIn: 'root'
})
export class PrintService {

    private businessName = 'Sophie POS';
    private businessAddress = '';
    private businessPhone = '';

    setBusinessInfo(name: string, address?: string, phone?: string) {
        this.businessName = name;
        if (address) this.businessAddress = address;
        if (phone) this.businessPhone = phone;
    }

    printSaleReceipt(sale: Sale, receivedAmount?: number): void {
        const receiptHtml = this.generateSaleReceipt(sale, receivedAmount);
        this.printHtml(receiptHtml);
    }

    printShiftReport(shift: CashShift, expenses: Expense[], sales: Sale[]): void {
        const reportHtml = this.generateShiftReport(shift, expenses, sales);
        this.printHtml(reportHtml);
    }

    private printHtml(html: string): void {
        const printWindow = window.open('', '_blank', 'width=300,height=600');
        if (!printWindow) {
            alert('No se pudo abrir la ventana de impresión. Permita los pop-ups.');
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load then print
        setTimeout(() => {
            printWindow.print();
            // Close after print dialog
            printWindow.onafterprint = () => printWindow.close();
        }, 250);
    }

    private generateSaleReceipt(sale: Sale, receivedAmount?: number): string {
        const date = new Date(sale.timestamp);
        const change = receivedAmount ? receivedAmount - sale.total : 0;

        let itemsHtml = sale.items.map(item => `
      <tr>
        <td style="text-align:left">${item.productName}<br><small style="color:#666">${item.attributeSummary}</small></td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 12px; 
      width: 280px; 
      padding: 10px;
    }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
    .header h1 { font-size: 16px; margin-bottom: 5px; }
    .info { margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { border-bottom: 1px solid #000; padding: 5px 0; font-size: 11px; }
    td { padding: 5px 0; vertical-align: top; }
    .totals { border-top: 1px dashed #000; padding-top: 10px; }
    .totals div { display: flex; justify-content: space-between; margin: 3px 0; }
    .total-row { font-weight: bold; font-size: 14px; }
    .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; font-size: 11px; }
    @media print { body { width: auto; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.businessName}</h1>
    ${this.businessAddress ? `<div>${this.businessAddress}</div>` : ''}
    ${this.businessPhone ? `<div>Tel: ${this.businessPhone}</div>` : ''}
  </div>
  
  <div class="info">
    <div><strong>Fecha:</strong> ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</div>
    <div><strong>Recibo #:</strong> ${sale.id.slice(0, 8).toUpperCase()}</div>
    <div><strong>Vendedor:</strong> ${sale.userName}</div>
    <div><strong>Pago:</strong> ${sale.paymentMethod === 'CASH' ? 'Efectivo' : 'Tarjeta'}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Producto</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">Precio</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>TOTAL:</span>
      <span>$${sale.total.toFixed(2)}</span>
    </div>
    ${receivedAmount ? `
    <div>
      <span>Recibido:</span>
      <span>$${receivedAmount.toFixed(2)}</span>
    </div>
    <div>
      <span>Cambio:</span>
      <span>$${change.toFixed(2)}</span>
    </div>
    ` : ''}
  </div>

  <div class="footer">
    <div>¡Gracias por su compra!</div>
    <div>Vuelva pronto</div>
  </div>
</body>
</html>
    `;
    }

    private generateShiftReport(shift: CashShift, expenses: Expense[], sales: Sale[]): string {
        const openedDate = new Date(shift.openedAt);
        const closedDate = shift.closedAt ? new Date(shift.closedAt) : null;

        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const cashSales = sales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
        const cardSales = sales.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.total, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const difference = (shift.endCashActual || 0) - shift.endCashExpected;

        let expensesHtml = expenses.length > 0
            ? expenses.map(e => `<div style="display:flex;justify-content:space-between"><span>${e.description}</span><span>-$${e.amount.toFixed(2)}</span></div>`).join('')
            : '<div style="color:#666">Sin gastos registrados</div>';

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reporte de Turno</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; width: 280px; padding: 10px; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .header h1 { font-size: 14px; margin-bottom: 5px; }
    .section { margin-bottom: 15px; }
    .section-title { font-weight: bold; background: #eee; padding: 5px; margin-bottom: 5px; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; }
    .total-row { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
    .diff-positive { color: green; }
    .diff-negative { color: red; }
    @media print { body { width: auto; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>REPORTE DE CIERRE DE TURNO</h1>
    <div>${this.businessName}</div>
  </div>

  <div class="section">
    <div class="section-title">INFORMACIÓN DEL TURNO</div>
    <div class="row"><span>Abierto por:</span><span>${shift.userName}</span></div>
    <div class="row"><span>Apertura:</span><span>${openedDate.toLocaleString()}</span></div>
    ${closedDate ? `
    <div class="row"><span>Cerrado por:</span><span>${shift.closedByUserName || shift.userName}</span></div>
    <div class="row"><span>Cierre:</span><span>${closedDate.toLocaleString()}</span></div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">VENTAS</div>
    <div class="row"><span>Total Ventas (${sales.length}):</span><span>$${totalSales.toFixed(2)}</span></div>
    <div class="row"><span>- Efectivo:</span><span>$${cashSales.toFixed(2)}</span></div>
    <div class="row"><span>- Tarjeta:</span><span>$${cardSales.toFixed(2)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">GASTOS</div>
    ${expensesHtml}
    <div class="total-row"><span>Total Gastos:</span><span>-$${totalExpenses.toFixed(2)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">RESUMEN DE CAJA</div>
    <div class="row"><span>Efectivo Inicial:</span><span>$${shift.startCash.toFixed(2)}</span></div>
    <div class="row"><span>+ Ventas Efectivo:</span><span>$${cashSales.toFixed(2)}</span></div>
    <div class="row"><span>- Gastos:</span><span>$${totalExpenses.toFixed(2)}</span></div>
    <div class="total-row"><span>Esperado:</span><span>$${shift.endCashExpected.toFixed(2)}</span></div>
    ${shift.endCashActual !== null ? `
    <div class="row"><span>Contado:</span><span>$${shift.endCashActual.toFixed(2)}</span></div>
    <div class="row ${difference >= 0 ? 'diff-positive' : 'diff-negative'}">
      <span>Diferencia:</span>
      <span>${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}</span>
    </div>
    ` : ''}
  </div>

  <div style="text-align:center;margin-top:20px;border-top:1px dashed #000;padding-top:10px;">
    <div style="font-size:10px;color:#666">Generado: ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>
    `;
    }

    downloadReceiptAsPdf(sale: Sale): void {
        // For browsers that don't support print, offer download
        const receiptHtml = this.generateSaleReceipt(sale);
        const blob = new Blob([receiptHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recibo-${sale.id.slice(0, 8)}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
