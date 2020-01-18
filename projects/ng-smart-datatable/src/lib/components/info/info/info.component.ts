import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'smart-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css']
})
export class InfoComponent implements OnInit {

  @Input() firstEntryOrder: number;
  @Input() lastEntryOrder: number;
  @Input() filteredEntryCount: number;
  @Input() totalEntryCount: number;

  constructor() { }

  ngOnInit() {
  }

  getFiltered() {
    return this.filteredEntryCount !== this.totalEntryCount
      ? `(Filtered from ${this.totalEntryCount} entries)` : '';
  }
}
