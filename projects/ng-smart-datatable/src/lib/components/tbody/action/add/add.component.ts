import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'smart-add',
  templateUrl: './add.component.html',
  styleUrls: ['./add.component.css']
})
export class AddComponent implements OnInit {

  @Output() btnAddClickEvent: EventEmitter<void> = new EventEmitter<void>();
  constructor() { }

  ngOnInit() {
  }

  btnAddClick() {
    this.btnAddClickEvent.emit();
  }
}
