import { Component, OnInit, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'smart-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  @Output() btnEditClickEvent: EventEmitter<void> = new EventEmitter<void>();
  constructor() { }

  ngOnInit() {
  }

  btnEditClick() {
    this.btnEditClickEvent.emit();
  }
}
