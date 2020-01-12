import { Component, OnInit, Input } from '@angular/core';
import { SmartModel } from './lib/source/smart-model.model';

@Component({
  selector: 'ng-smart-datatable',
  styleUrls: ['./ng-smart-datatable.component.scss'],
  templateUrl: './ng-smart-datatable.component.html'
})
export class NgSmartDatatableComponent implements OnInit {

  @Input() model: SmartModel;
  @Input() data: any[];

  constructor() { }

  ngOnInit() {
  }

}
