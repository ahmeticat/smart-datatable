import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'smart-add',
  templateUrl: './add.component.html',
  styleUrls: ['./add.component.css']
})
export class AddComponent implements OnInit {

  @Input() btnAddContent: string;
  @Output() btnAddClickEvent: EventEmitter<void> = new EventEmitter<void>();
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  btnAddClick() {
    this.btnAddClickEvent.emit();
  }

  getHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.btnAddContent);
  }
}
