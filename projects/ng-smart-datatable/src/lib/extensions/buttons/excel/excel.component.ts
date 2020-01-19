import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartButton } from '../../../lib/source/smart-button.model';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'smart-excel',
  templateUrl: './excel.component.html',
  styleUrls: ['./excel.component.css']
})
export class ExcelComponent implements OnInit {
  @Input() excelButton: SmartButton;
  @Output() btnExcelClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.excelButton.content);
  }

  btnExcelClick() {
    this.btnExcelClickEvent.emit(this.excelButton);
    if (this.excelButton.action) {
      this.excelButton.action();
    }
  }
}
