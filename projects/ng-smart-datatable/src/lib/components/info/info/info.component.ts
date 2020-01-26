import { Component, OnInit, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'smart-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css']
})
export class InfoComponent implements OnInit {

  @Input() infoLanguage: string;
  @Input() filteredInfoLanguage: string;
  @Input() firstEntryOrder: number;
  @Input() lastEntryOrder: number;
  @Input() filteredEntryCount: number;
  @Input() totalEntryCount: number;

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

  getFiltered(): SafeHtml {
    this.filteredInfoLanguage = this.filteredInfoLanguage.replace('**TOTAL**', this.totalEntryCount.toString());
    return this.filteredEntryCount !== this.totalEntryCount
      ? this.sanitizer.bypassSecurityTrustHtml(this.filteredInfoLanguage) : '';
  }

  getInfo(): SafeHtml {
    this.infoLanguage = this.infoLanguage.replace('**START**', this.firstEntryOrder.toString());
    this.infoLanguage = this.infoLanguage.replace('**END**', this.lastEntryOrder.toString());
    this.infoLanguage = this.infoLanguage.replace('**TOTAL**', this.totalEntryCount.toString());
    this.filteredInfoLanguage = this.filteredInfoLanguage.replace('**TOTAL**', this.totalEntryCount.toString());
    const filtered = this.filteredEntryCount !== this.totalEntryCount
      ? this.filteredInfoLanguage : '';
    return this.sanitizer.bypassSecurityTrustHtml(this.infoLanguage + filtered);
  }
}
