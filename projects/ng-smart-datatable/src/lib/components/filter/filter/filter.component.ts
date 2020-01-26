import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'smart-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.css']
})
export class FilterComponent implements OnInit {

  @Input() searchLanguage: string;
  @Input() searchPlaceholderLanguage: string;
  @Output() filterChangeEvent: EventEmitter<string> = new EventEmitter<string>();
  filterValue = '';
  searchBefore = '';
  searchAfter = '';
  constructor() { }

  ngOnInit() {
    this.searchBefore = this.searchLanguage.split('**SEARCH**')[0];
    this.searchAfter = this.searchLanguage.split('**SEARCH**')[1];
  }
  onKeyup() {
    this.filterChangeEvent.emit(this.filterValue);
  }

}
