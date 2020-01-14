import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { SmartLength } from '../../../lib/helpers/smart-length.model';

@Component({
  selector: 'smart-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.css']
})
export class FilterComponent {

  filterValue:string = '';
  @Output() filterChangeEvent: EventEmitter<string> = new EventEmitter<string>();
  constructor() { }

  onKeyup(){
    this.filterChangeEvent.emit(this.filterValue);
  }

}
