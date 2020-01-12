import { Component, OnInit, Input } from '@angular/core';
import { SmartModel } from '../../../lib/source/smart-model.model';

@Component({
  selector: '[smart-head]',
  templateUrl: './smart-head.component.html',
  styleUrls: ['./smart-head.component.css']
})
export class SmartHeadComponent {

  @Input() model: SmartModel;
  constructor() { }


}
