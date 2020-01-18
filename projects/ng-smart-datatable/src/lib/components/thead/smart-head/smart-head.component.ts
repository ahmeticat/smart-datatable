import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { SmartModel } from '../../../lib/source/smart-model.model';
import { SmartSortProperty } from '../../../lib/source/smart-sort-property.model';
import { SmartProperty } from '../../../lib/source/smart-property.model';

@Component({
  selector: '[smart-head]',
  templateUrl: './smart-head.component.html',
  styleUrls: ['./smart-head.component.scss']
})
export class SmartHeadComponent {

  @Input() model: SmartModel;
  @Input() activeSortProperty: SmartSortProperty;
  @Input() showActions = true;
  @Input() actionsColumnOrder: number;
  @Output() sortChangeEvent: EventEmitter<SmartSortProperty> = new EventEmitter<SmartSortProperty>();
  @Output() propertyChangeEvent: EventEmitter<any> = new EventEmitter<any>();
  @Input() beforeActionProperties: SmartProperty[];
  @Input() afterActionProperties: SmartProperty[];

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

  onTextChange(property: SmartProperty, text) {
    this.propertyChangeEvent.emit({ property, text });
  }

}
