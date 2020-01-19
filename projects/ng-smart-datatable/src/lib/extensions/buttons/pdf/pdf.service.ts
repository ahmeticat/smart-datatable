import { Injectable } from '@angular/core';
import * as jsPDF from 'jspdf';

@Injectable()
export class PdfService {

    constructor() { }

    public exportAsPdfFile(innerHTML: string, pdfFileName: string): void {
        const doc = new jsPDF();
        const specialElementHandlers = {
            '#editor': (element, renderer) => {
                return true;
            }
        };

        doc.fromHTML(innerHTML, 15, 15, {
            width: 190,
            elementHandlers: specialElementHandlers
        });

        doc.save(pdfFileName + '.pdf');
    }
}
