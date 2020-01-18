import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartModel } from '../../../lib/source/smart-model.model';
import { SmartSortProperty } from '../../../lib/source/smart-sort-property.model';
import { SmartProperty } from '../../../lib/source/smart-property.model';

@Component({
  selector: '[smart-head-column]',
  templateUrl: './column.component.html',
  styleUrls: ['./column.component.scss']
})
export class ColumnComponent {

  @Input() model: SmartModel;
  @Input() activeSortProperty: SmartSortProperty;
  @Input() showActions = true;
  @Output() sortChangeEvent: EventEmitter<SmartSortProperty> = new EventEmitter<SmartSortProperty>();

  sortClick(property: SmartProperty) {
    if (this.activeSortProperty.property === property.key) {
      this.activeSortProperty.isAsc = !this.activeSortProperty.isAsc;
      this.sortChangeEvent.emit(this.activeSortProperty);
    } else {
      this.activeSortProperty.property = property.key;
      this.activeSortProperty.isAsc = true;
      this.sortChangeEvent.emit(this.activeSortProperty);
    }
  }

  getLength() {
    return Number(100 / this.model.properties.length);
  }
}
