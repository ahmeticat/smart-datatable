import { Component, OnInit, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'smart-delete',
  templateUrl: './delete.component.html',
  styleUrls: ['./delete.component.css']
})
export class DeleteComponent implements OnInit {
  @Output() btnDeleteClickEvent: EventEmitter<void> = new EventEmitter<void>();
  constructor() { }

  ngOnInit() {
  }

  btnDeleteClick() {
    this.btnDeleteClickEvent.emit();
  }
}
