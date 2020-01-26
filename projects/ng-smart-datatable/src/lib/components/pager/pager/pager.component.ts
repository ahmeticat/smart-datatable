import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'smart-pager',
  templateUrl: './pager.component.html',
  styleUrls: ['./pager.component.scss']
})
export class PagerComponent implements OnInit {

  @Input() pages: number[] = [];
  @Input() pagesCount = 2;
  @Input() previousLanguage: string;
  @Input() nextLanguage: string;
  @Input() activePage: number;
  @Output() updatePageEvent: EventEmitter<number> = new EventEmitter<number>();
  showBeforePages = false;
  showAfterPages = false;
  constructor() {
  }

  ngOnInit() {
  }

  updatePage(pageNumber: number) {
    this.updatePageEvent.emit(pageNumber);
  }

  getPages() {
    this.showAfterPages = false;
    this.showBeforePages = false;
    if (this.activePage === 1) {
      this.showAfterPages = this.pages.length > this.pagesCount;
      return this.pages.slice(0, this.pagesCount);
    } else if (this.activePage === this.pages.length) {
      this.showBeforePages = this.pages.length - this.pagesCount > this.pagesCount;
      return this.pages.slice(this.pages.length - this.pagesCount, this.pages.length);
    } else {
      this.showAfterPages = this.activePage + this.pagesCount < this.pages.length;
      this.showBeforePages = this.activePage - this.pagesCount > 0;
      return this.pages.slice(this.activePage - this.pagesCount, this.activePage + this.pagesCount);
    }
  }
}
