import { Component, OnInit, Input } from '@angular/core';
import { SmartModel } from '../../../lib/source/smart-model.model';

@Component({
  selector: '[smart-head-column]',
  templateUrl: './column.component.html',
  styleUrls: ['./column.component.css']
})
export class ColumnComponent {

  @Input() model: SmartModel;

}
