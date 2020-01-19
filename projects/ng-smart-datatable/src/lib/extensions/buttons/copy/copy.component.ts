import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartButton } from '../../../lib/source/smart-button.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'smart-copy',
  templateUrl: './copy.component.html',
  styleUrls: ['./copy.component.css']
})
export class CopyComponent implements OnInit {

  @Input() copyButton: SmartButton;
  @Output() btnCopyClickEvent: EventEmitter<SmartButton> = new EventEmitter<SmartButton>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.copyButton.content);
  }

  btnCopyClick() {
    this.btnCopyClickEvent.emit(this.copyButton);
    if (this.copyButton.action) {
      this.copyButton.action();
    }
  }
}
