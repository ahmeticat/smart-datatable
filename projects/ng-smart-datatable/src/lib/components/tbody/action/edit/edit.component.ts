import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SmartAction } from '../../../../lib/source/smart-action-property.model';

@Component({
  selector: 'smart-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  @Input() action: SmartAction;
  @Output() btnEditClickEvent: EventEmitter<void> = new EventEmitter<void>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  btnEditClick() {
    this.btnEditClickEvent.emit();
  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.action.content);
  }
}
