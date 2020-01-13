import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { SmartLength } from '../../../lib/helpers/smart-length.model';

@Component({
  selector: 'smart-length',
  templateUrl: './length.component.html',
  styleUrls: ['./length.component.css']
})
export class LengthComponent implements OnInit {

  @Input() lengthMenu: SmartLength[];
  @Input() length: number;
  @Output() lengthChangeEvent: EventEmitter<number> = new EventEmitter<number>();
  constructor() { }

  ngOnInit() {
  }

  lengthChange(length) {
    this.lengthChangeEvent.emit(length);
  }

}
