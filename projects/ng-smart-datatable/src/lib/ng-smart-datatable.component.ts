import { Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { SmartModel } from './lib/source/smart-model.model';
import { SmartCssClass } from './lib/helpers/smart-css-class.model';
import { SmartLength } from './lib/helpers/smart-length.model';
import { SmartSortProperty } from './lib/source/smart-sort-property.model';
import { SmartSort } from './lib/helpers/smart-sort.model';


@Component({
  selector: 'ng-smart-datatable',
  styleUrls: ['./ng-smart-datatable.component.scss'],
  templateUrl: './ng-smart-datatable.component.html',
  encapsulation: ViewEncapsulation.None
})
export class NgSmartDatatableComponent implements OnInit {

  @Input() model: SmartModel;
  @Input() data: any[];
  @Input() cssClass: SmartCssClass;
  @Input() lengthMenu =
    [
      {
        value: 10,
        title: '10'
      },
      {
        value: 25,
        title: '25'
      },
      {
        value: 50,
        title: '50'
      },
      {
        value: 100,
        title: '100'
      },
      {
        value: -1,
        title: 'Tümü'
      }
    ] as SmartLength[];

  @Input() activePage = 1;
  @Input() pageCount = 0;
  @Input() length = 10;
  activeData = [];
  activeSortProperty: SmartSortProperty;
  pages: number[] = [];
  private cssClasses = SmartCssClass;
  constructor() {
  }

  ngOnInit() {
    this.calculatePageCount();
    this.updatePageData();
    this.activeSortProperty = {
      isAsc : true,
      property: this.model.properties[0].key
    };
  }

  initializePages() {
    this.pages = [];
    for (let index = 0; index < this.pageCount; index++) {
      this.pages.push(index + 1);
    }
  }

  updatePageData() {
    this.activeData = this.data.slice(((this.activePage - 1) * this.length), ((this.activePage) * this.length));
  }

  calculatePageCount() {
    this.pageCount = Math.ceil(this.data.length / this.length);
    this.initializePages();
  }

  updatePageNumber(newPageNumber) {
    this.activePage = newPageNumber;
    this.calculatePageCount();
    this.updatePageData();
  }

  updateLength(newLength) {
    this.length = newLength;
    this.activePage = 1;
    this.calculatePageCount();
    this.updatePageData();
  }

  sortProperty(activeProperty:SmartSortProperty){
    this.activeData = SmartSort.sort(this.data,activeProperty.property,activeProperty.isAsc);
    this.calculatePageCount();
    this.updatePageData();
  }
}
