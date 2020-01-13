import { Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { SmartModel } from './lib/source/smart-model.model';
import { SmartCssClass } from './lib/helpers/smart-css-class.model';


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

  private cssClasses = SmartCssClass;
  constructor() { }

  ngOnInit() {
  }

}
