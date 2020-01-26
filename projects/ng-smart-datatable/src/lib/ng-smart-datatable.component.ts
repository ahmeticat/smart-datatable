import { Component, OnInit, Input, ViewEncapsulation, EventEmitter, Output } from '@angular/core';
import { SmartModel } from './lib/source/smart-model.model';
import { SmartSort } from './lib/helpers/smart-sort.model';
import { SmartFilter } from './lib/helpers/smart-filter.model';
import { SmartProperty } from './lib/source/smart-property.model';
import { SmartAction } from './lib/source/smart-action-property.model';
import { ExcelService } from './extensions/buttons/excel/excel.service';
import { Guid } from './lib/helpers/smart-guid.model';
import { PdfService } from './extensions/buttons/pdf/pdf.service';
import { UTF8 } from './lib/helpers/smart-utf8.model';
import { CopyService } from './extensions/buttons/copy/copy.service';
import { SmartCssClass } from './lib/helpers/smart-css-class.model';
import { SmartLength } from './lib/helpers/smart-length.model';
import { SmartSortProperty } from './lib/source/smart-sort-property.model';
import { ActionType } from './lib/source/smart-action-type.model';
import { SmartButtonType } from './lib/source/smart-button-type.model';

@Component({
  selector: 'ng-smart-datatable',
  styleUrls: ['./ng-smart-datatable.component.scss'],
  templateUrl: './ng-smart-datatable.component.html',
  encapsulation: ViewEncapsulation.None
})
export class NgSmartDatatableComponent implements OnInit {

  @Input() model: SmartModel;
  @Input() data: any[];
  @Input() cssClass: SmartCssClass = SmartCssClass.Bootstrap4;
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
  @Input() showActions = true;
  @Input() showButtons = false;
  @Input() length = 10;
  @Input() tableId: string;
  @Input() actionsColumnWidth: string;
  @Input() actionsColumnOrder?: number = null;
  @Output() btnAddClickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() btnEditClickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() btnDeleteClickEvent: EventEmitter<any> = new EventEmitter<any>();
  pageCount = 0;
  activeData = [];
  activeSortProperty: SmartSortProperty;
  pages: number[] = [];
  tempData: any[] = [];
  firstEntryOrder = 1;
  lastEntryOrder = 1;
  beforeActionProperties: SmartProperty[] = [];
  afterActionProperties: SmartProperty[] = [];
  addActionButton: SmartAction;
  showCopyMessage = false;
  cssClasses = SmartCssClass;
  constructor(
    private excelService: ExcelService,
    private pdfService: PdfService,
    private copyService: CopyService
  ) {
  }

  ngOnInit() {
    this.tableId = this.tableId ? this.tableId : Guid.newGuid();
    this.actionsColumnOrder = this.actionsColumnOrder === null ? this.model.properties.length : this.actionsColumnOrder;
    this.tempData = this.data;
    this.initializeActions();
    this.initializeButtons();
    this.initializeLanguage();
    this.refreshTable();
    this.activeSortProperty = {
      isAsc: true,
      property: this.model.properties[0].key
    };
    this.initializeColumns();
  }
  initializePages() {
    this.pages = [];
    for (let index = 0; index < this.pageCount; index++) {
      this.pages.push(index + 1);
    }
  }

  initializeColumns() {
    this.beforeActionProperties = this.model.properties.slice(0, this.actionsColumnOrder).filter(a => a.visible !== false);
    this.afterActionProperties = this.model.properties
      .slice(this.actionsColumnOrder, this.model.properties.length).filter(a => a.visible !== false);
  }

  initializeButtons() {
    if (!this.model.buttons) {
      this.model.buttons = SmartModel.initializeDefaultButtons();
    } else {
      this.model.buttons = [...this.model.buttons, ...SmartModel.initializeDefaultButtons()];
    }
  }

  initializeActions() {
    if (!this.model.actions) {
      this.model.actions = SmartModel.initializeDefaultActions();
    } else {
      this.model.actions = [...this.model.actions, ...SmartModel.initializeDefaultActions()];
    }
    this.addActionButton = this.model.actions.find(a => a.type === ActionType.Add);
  }

  initializeLanguage() {
    if (!this.model.language) {
      this.model.language = SmartModel.initializeDefaultLanguage();
    } else {
      this.model.language = { ...this.model.language, ...SmartModel.initializeDefaultLanguage() };
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
    this.length = Number(newLength);
    this.activePage = 1;
    this.refreshTable();
  }

  sortProperty(activeProperty: SmartSortProperty) {
    this.activeData = SmartSort.sort(this.tempData, activeProperty.property, activeProperty.isAsc);
    this.refreshTable();
  }

  updateFilter(filterValue: string) {
    this.tempData = SmartFilter.filterAllProperty(this.data, filterValue);
    this.refreshTable();
  }

  refreshTable() {
    this.calculatePageCount();
    this.updatePageData();
    this.updateInfo();
  }

  updateInfo() {
    this.firstEntryOrder = (this.activePage - 1) * this.length + 1;
    this.lastEntryOrder = this.length === -1 ? this.tempData.length : this.firstEntryOrder + this.length >
      this.tempData.length ? this.tempData.length : this.firstEntryOrder + this.length;

  }

  btnEditClick(item: any) {
    this.btnEditClickEvent.emit(item);
  }

  btnDeleteClick(item: any) {
    this.btnDeleteClickEvent.emit(item);
  }

  btnAddClick() {
    this.btnAddClickEvent.emit();
  }

  onPropertyChanged(event) {
    this.tempData = SmartFilter.filter(this.data, (event.property as SmartProperty).key, event.text);
    this.refreshTable();
  }

  btnCopyClick() {
    const table = document.getElementById(this.tableId);
    this.copyService.copyText(UTF8.parseUTF(table.innerText));
    this.showCopyMessage = true;
    setTimeout(() => {
      this.showCopyMessage = false;
    }, 3000);
  }

  btnExcelClick() {
    const excelExportData: any[] = this.data.map(item => {
      const temp: any = new Object();
      Object.keys(item).forEach(currentItem => {
        const tempProperty: SmartProperty = this.model.properties.find(a => a.key === currentItem);
        if (tempProperty) {
          temp[tempProperty.title.replace(`'`, '')] = item[currentItem];
        }
      });
      return temp;
    });
    this.excelService.exportAsExcelFile(excelExportData, this.model.buttons.find(a => a.type === SmartButtonType.Excel).title);
  }

  btnCsvClick() {
    const excelExportData: any[] = this.data.map(item => {
      const temp: any = new Object();
      Object.keys(item).forEach(currentItem => {
        const tempProperty: SmartProperty = this.model.properties.find(a => a.key === currentItem);
        if (tempProperty) {
          temp[tempProperty.title.replace(`'`, '')] = item[currentItem];
        }
      });
      return temp;
    });
    this.excelService.exportAsCsvFile(excelExportData, this.model.buttons.find(a => a.type === SmartButtonType.Csv).title);
  }

  btnPdfClick() {
    const table = document.getElementById(this.tableId);
    this.pdfService.exportAsPdfFile(UTF8.parseUTF(table.outerHTML), this.model.buttons.find(a => a.type === SmartButtonType.Pdf).title);
  }

  btnColvisClick(property: SmartProperty) {
    if (property.key === 'smart-action') {
      this.showActions = !this.showActions;
    } else {
      this.initializeColumns();
    }
  }
}
