import { Component, OnInit, Input } from '@angular/core';
import { SmartModel } from '../../lib/source/smart-model.model';

@Component({
  selector: '[smart-body]',
  templateUrl: './smart-body.component.html',
  styleUrls: ['./smart-body.component.css']
})
export class SmartBodyComponent implements OnInit {

  @Input() data: any[];
  @Input() model: SmartModel;

  constructor() { }

  ngOnInit() {
  }

  getValue(item: any, key: string): string {
    return item[`${key}`];
  }

}
