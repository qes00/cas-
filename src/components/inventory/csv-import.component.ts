import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { Product } from '../../services/data.types';

interface CSVRow {
    nombre: string;
    codigo_barras: string;
    categoria: string;
    precio: string;
    costo: string;
    stock: string;
    stock_minimo: string;
    proveedor?: string;
    imagen_url?: string;
}

interface ValidationError {
    row: number;
    field: string;
    message: string;
}

@Component({
    selector: 'app-csv-import',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './csv-import.component.html'
})
export class CsvImportComponent {
    parsedData = signal<CSVRow[]>([]);
    validationErrors = signal<ValidationError[]>([]);
    isProcessing = signal(false);
    importSuccess = signal(false);
    importedCount = signal(0);

    constructor(private productService: ProductService) { }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        if (!file.name.endsWith('.csv')) {
            alert('Por favor selecciona un archivo CSV válido');
            return;
        }

        this.readCSVFile(file);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const files = event.dataTransfer?.files;
        if (!files?.length) return;

        const file = files[0];
        if (!file.name.endsWith('.csv')) {
            alert('Por favor arrastra un archivo CSV válido');
            return;
        }

        this.readCSVFile(file);
    }

    private readCSVFile(file: File): void {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            this.parseCSV(text);
        };
        reader.readAsText(file);
    }

    private parseCSV(text: string): void {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            alert('El archivo CSV debe contener al menos una fila de encabezados y una fila de datos');
            return;
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate required columns
        const requiredColumns = ['nombre', 'codigo_barras', 'categoria', 'precio', 'costo', 'stock'];
        const missingColumns = requiredColumns.filter(col => !header.includes(col));

        if (missingColumns.length > 0) {
            alert(`Columnas requeridas faltantes: ${missingColumns.join(', ')}\n\nColumnas esperadas: nombre, codigo_barras, categoria, precio, costo, stock, stock_minimo, proveedor (opcional), imagen_url (opcional)`);
            return;
        }

        // Parse data rows
        const data: CSVRow[] = [];
        const errors: ValidationError[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: any = {};

            header.forEach((col, idx) => {
                row[col] = values[idx] || '';
            });

            // Validate row
            this.validateRow(row, i, errors);
            data.push(row);
        }

        this.parsedData.set(data);
        this.validationErrors.set(errors);
    }

    private validateRow(row: CSVRow, rowNumber: number, errors: ValidationError[]): void {
        if (!row.nombre) {
            errors.push({ row: rowNumber, field: 'nombre', message: 'Nombre es requerido' });
        }

        if (!row.codigo_barras) {
            errors.push({ row: rowNumber, field: 'codigo_barras', message: 'Código de barras es requerido' });
        }

        if (!row.precio || isNaN(parseFloat(row.precio))) {
            errors.push({ row: rowNumber, field: 'precio', message: 'Precio debe ser un número válido' });
        }

        if (!row.costo || isNaN(parseFloat(row.costo))) {
            errors.push({ row: rowNumber, field: 'costo', message: 'Costo debe ser un número válido' });
        }

        if (!row.stock || isNaN(parseInt(row.stock))) {
            errors.push({ row: rowNumber, field: 'stock', message: 'Stock debe ser un número entero válido' });
        }

        if (row.stock_minimo && isNaN(parseInt(row.stock_minimo))) {
            errors.push({ row: rowNumber, field: 'stock_minimo', message: 'Stock mínimo debe ser un número entero válido' });
        }
    }

    async importProducts(): Promise<void> {
        if (this.validationErrors().length > 0) {
            alert('Por favor corrige los errores de validación antes de importar');
            return;
        }

        if (!confirm(`¿Estás seguro de importar ${this.parsedData().length} productos?`)) {
            return;
        }

        this.isProcessing.set(true);
        let successCount = 0;

        try {
            for (const row of this.parsedData()) {
                const product: Omit<Product, 'id'> = {
                    nombre: row.nombre,
                    codigo_barras: row.codigo_barras,
                    categoria: row.categoria,
                    precio: parseFloat(row.precio),
                    costo: parseFloat(row.costo),
                    stock: parseInt(row.stock),
                    stock_minimo: row.stock_minimo ? parseInt(row.stock_minimo) : 5,
                    proveedor: row.proveedor || '',
                    imagen_url: row.imagen_url || '',
                    activo: true,
                    fecha_creacion: new Date()
                };

                await this.productService.addProduct(product);
                successCount++;
            }

            this.importedCount.set(successCount);
            this.importSuccess.set(true);

            // Reset after 3 seconds
            setTimeout(() => {
                this.resetImport();
            }, 3000);
        } catch (error) {
            console.error('Error importing products:', error);
            alert(`Error durante la importación. Se importaron ${successCount} de ${this.parsedData().length} productos.`);
        } finally {
            this.isProcessing.set(false);
        }
    }

    resetImport(): void {
        this.parsedData.set([]);
        this.validationErrors.set([]);
        this.importSuccess.set(false);
        this.importedCount.set(0);
    }

    downloadTemplate(): void {
        const template = 'nombre,codigo_barras,categoria,precio,costo,stock,stock_minimo,proveedor,imagen_url\n' +
            'Producto Ejemplo,1234567890,Electrónicos,99.99,50.00,100,10,Proveedor ABC,https://example.com/image.jpg';

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_productos.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    }
}
