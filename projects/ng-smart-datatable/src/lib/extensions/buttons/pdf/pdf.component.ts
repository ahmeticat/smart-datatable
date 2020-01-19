import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { SmartButton } from '../../../lib/source/smart-button.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'smart-pdf',
  templateUrl: './pdf.component.html',
  styleUrls: ['./pdf.component.css']
})
export class PdfComponent implements OnInit {

  @Input() pdfButton: SmartButton;
  @Output() btnPdfClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.pdfButton.content);
  }

  btnPdfClick() {
    this.btnPdfClickEvent.emit(this.pdfButton);
    if (this.pdfButton.action) {
      this.pdfButton.action();
    }
  }

}
