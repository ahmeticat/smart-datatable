import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartButton } from '../../../lib/source/smart-button.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'smart-csv',
  templateUrl: './csv.component.html',
  styleUrls: ['./csv.component.css']
})
export class CsvComponent implements OnInit {

  @Input() csvButton: SmartButton;
  @Output() btnCsvClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.csvButton.content);
  }

  btnCsvClick() {
    this.btnCsvClickEvent.emit(this.csvButton);
    if (this.csvButton.action) {
      this.csvButton.action();
    }
  }

}
