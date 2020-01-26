import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { SmartLength } from '../../../lib/helpers/smart-length.model';
@Component({
  selector: 'smart-length',
  templateUrl: './length.component.html',
  styleUrls: ['./length.component.css']
})
export class LengthComponent implements OnInit {

  @Input() lengthMenuLanguage: string;
  @Input() lengthMenu: SmartLength[];
  @Input() length: number;
  @Output() lengthChangeEvent: EventEmitter<number> = new EventEmitter<number>();

  lengthBefore: string;
  lengthAfter: string;
  constructor() { }

  ngOnInit() {
    this.lengthBefore = this.lengthMenuLanguage.split('**LENGTH**')[0];
    this.lengthAfter = this.lengthMenuLanguage.split('**LENGTH**')[1];
  }

  lengthChange(length) {
    this.lengthChangeEvent.emit(length);
  }


}
