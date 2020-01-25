import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';
import { SmartAction } from '../../../../lib/source/smart-action-property.model';

@Component({
  selector: 'smart-delete',
  templateUrl: './delete.component.html',
  styleUrls: ['./delete.component.css']
})
export class DeleteComponent implements OnInit {
  @Input() action: SmartAction;
  @Output() btnDeleteClickEvent: EventEmitter<void> = new EventEmitter<void>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  btnDeleteClick() {
    this.btnDeleteClickEvent.emit();
  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.action.content);
  }
}
