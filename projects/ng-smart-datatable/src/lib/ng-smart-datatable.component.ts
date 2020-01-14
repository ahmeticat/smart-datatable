import { Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { SmartModel } from './lib/source/smart-model.model';
import { SmartCssClass } from './lib/helpers/smart-css-class.model';
import { SmartLength } from './lib/helpers/smart-length.model';
import { SmartSortProperty } from './lib/source/smart-sort-property.model';
import { SmartSort } from './lib/helpers/smart-sort.model';
import { SmartFilter } from './lib/helpers/smart-filter.model';


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
  tempData: any[] = [];
  private cssClasses = SmartCssClass;
  constructor() {
  }

  ngOnInit() {
    this.tempData = this.data;
    this.refreshTable();
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
    this.activeData = this.tempData.slice(((this.activePage - 1) * this.length), ((this.activePage) * this.length));
  }

  calculatePageCount() {
    this.pageCount = Math.ceil(this.tempData.length / this.length);
    this.initializePages();
  }

  updatePageNumber(newPageNumber) {
    this.activePage = newPageNumber;
    this.refreshTable();
  }

  updateLength(newLength) {
    this.length = newLength;
    this.activePage = 1;
    this.refreshTable();
  }

  sortProperty(activeProperty:SmartSortProperty){
    this.activeData = SmartSort.sort(this.tempData,activeProperty.property,activeProperty.isAsc);
    this.refreshTable();
  }

  updateFilter(filterValue:string){
    this.tempData = SmartFilter.filterAllProperty(this.data, filterValue);
    this.refreshTable();
  }

  refreshTable(){
    this.calculatePageCount();
    this.updatePageData();
  }
}
