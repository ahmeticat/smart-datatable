import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { SmartModel } from '../../../lib/source/smart-model.model';
import { SmartSortProperty } from '../../../lib/source/smart-sort-property.model';

@Component({
  selector: '[smart-head]',
  templateUrl: './smart-head.component.html',
  styleUrls: ['./smart-head.component.css']
})
export class SmartHeadComponent {

  @Input() model: SmartModel;
  @Input() activeSortProperty: SmartSortProperty;
  @Output() sortChangeEvent: EventEmitter<SmartSortProperty> = new EventEmitter<SmartSortProperty>();

  constructor() { }


}
