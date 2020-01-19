import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'smart-copy-message',
  templateUrl: './copy-message.component.html',
  styleUrls: ['./copy-message.component.scss']
})
export class CopyMessageComponent implements OnInit {

  @Input() copyRowsCount: number;
  constructor() { }

  ngOnInit() {
  }

}
