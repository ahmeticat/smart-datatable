import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartButton } from '../../lib/source/smart-button.model';
import { SmartButtonType } from '../../lib/source/smart-button-type.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SmartProperty } from '../../lib/source/smart-property.model';

@Component({
  selector: 'smart-buttons',
  templateUrl: './buttons.component.html',
  styleUrls: ['./buttons.component.scss']
})
export class ButtonsComponent implements OnInit {

  @Input() buttons: SmartButton[];
  @Input() columns: SmartProperty[];
  @Output() btnCopyClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  @Output() btnCsvClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  @Output() btnExcelClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  @Output() btnPdfClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  @Output() btnColvisClickEvent: EventEmitter<SmartProperty> = new EventEmitter<SmartProperty>();


  excelButton: SmartButton;
  colvisButton: SmartButton;
  csvButton: SmartButton;
  pdfButton: SmartButton;
  copyButton: SmartButton;
  customButtons: SmartButton[];
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
    this.copyButton = this.buttons.find(a => a.type === SmartButtonType.Copy);
    this.pdfButton = this.buttons.find(a => a.type === SmartButtonType.Pdf);
    this.csvButton = this.buttons.find(a => a.type === SmartButtonType.Csv);
    this.excelButton = this.buttons.find(a => a.type === SmartButtonType.Excel);
    this.colvisButton = this.buttons.find(a => a.type === SmartButtonType.Colvis);
    this.customButtons = this.buttons.filter(a => a.type === SmartButtonType.Custom);
  }

  getContent(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }

  btnColvisClick(property: SmartProperty) {
    this.btnColvisClickEvent.emit(property);
  }
}
