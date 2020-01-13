import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'smart-pager',
  templateUrl: './pager.component.html',
  styleUrls: ['./pager.component.scss']
})
export class PagerComponent implements OnInit {

  @Input() pages: number[] = [];
  @Input() activePage: number;
  @Output() updatePageEvent: EventEmitter<number> = new EventEmitter<number>();
  constructor() {
  }

  ngOnInit() {
  }

  updatePage(pageNumber: number) {
    this.updatePageEvent.emit(pageNumber);
  }
}
