import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartModel } from '../../lib/source/smart-model.model';
import { SmartProperty } from '../../lib/source/smart-property.model';

@Component({
  selector: '[smart-body]',
  templateUrl: './smart-body.component.html',
  styleUrls: ['./smart-body.component.scss']
})
export class SmartBodyComponent {

  @Input() data: any[];
  @Input() model: SmartModel;
  @Input() showActions = true;
  @Input() actionsColumnOrder: number;
  @Output() btnEditClickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() btnDeleteClickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Input() beforeActionProperties: SmartProperty[] = [];
  @Input() afterActionProperties: SmartProperty[] = [];

  getValue(item: any, key: string): string {
    return item[`${key}`];
  }

  btnEditClick(item: any) {
    this.btnEditClickEvent.emit(item);
  }

  btnDeleteClick(item: any) {
    this.btnDeleteClickEvent.emit(item);
  }
}
