import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScannerService {
  
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private readonly TIMEOUT = 50; // ms between keystrokes for scanner detection

  public scanResult = new Subject<string>();

  handleKeyInput(event: KeyboardEvent) {
    // Ignore input if user is typing in a form field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    const currentTime = Date.now();
    
    if (currentTime - this.lastKeyTime > this.TIMEOUT) {
      this.buffer = ''; // Reset buffer if too slow (manual typing)
    }

    this.lastKeyTime = currentTime;

    if (event.key === 'Enter') {
      if (this.buffer.length > 2) { // Minimal length validation
        this.scanResult.next(this.buffer);
        console.log('Scanned:', this.buffer);
      }
      this.buffer = '';
    } else if (event.key.length === 1) { // Printable chars only
      this.buffer += event.key;
    }
  }

  // Camera Scanning Logic Helper
  // Note: We'll emit simulated scans here for now as robust cam-scan requires complex setup in single file
  simulateScan(code: string) {
    this.scanResult.next(code);
  }
}