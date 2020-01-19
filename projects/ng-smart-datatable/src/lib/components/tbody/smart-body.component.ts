import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SmartModel } from '../../lib/source/smart-model.model';
import { SmartProperty } from '../../lib/source/smart-property.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SmartAction } from '../../lib/source/smart-action-property.model';
import { ActionType } from '../../lib/source/smart-action-type.model';

@Component({
  selector: '[smart-body]',
  templateUrl: './smart-body.component.html',
  styleUrls: ['./smart-body.component.scss']
})
export class SmartBodyComponent implements OnInit {

  @Input() data: any[];
  @Input() model: SmartModel;
  @Input() showActions = true;
  @Input() actionsColumnOrder: number;
  @Input() beforeActionProperties: SmartProperty[] = [];
  @Input() afterActionProperties: SmartProperty[] = [];
  @Output() btnEditClickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() btnDeleteClickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() colDefEvent: EventEmitter<any> = new EventEmitter<any>();
  customActions: SmartAction[];
  editVisibility: boolean;
  deleteVisibility: boolean;
  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
    this.editVisibility = this.model.actions.find(a => a.type === ActionType.Edit).visible;
    this.deleteVisibility = this.model.actions.find(a => a.type === ActionType.Delete).visible;
    this.customActions = this.model.actions.filter(a => a.type === ActionType.Custom);
  }

  getValue(item: any, key: string): string {
    return item[`${key}`];
  }

  getHtml(item: any, smartHtml: any, key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(smartHtml(item, key));
  }

  btnEditClick(item: any) {
    this.btnEditClickEvent.emit(item);
  }

  btnDeleteClick(item: any) {
    this.btnDeleteClickEvent.emit(item);
  }

  getButtonHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }
}
