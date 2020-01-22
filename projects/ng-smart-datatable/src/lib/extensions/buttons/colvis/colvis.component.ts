import { Component, OnInit, Input, Output, EventEmitter, HostListener, ViewChild, ElementRef } from '@angular/core';
import { SmartButton } from '../../../lib/source/smart-button.model';
import { SmartProperty } from '../../../lib/source/smart-property.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'smart-colvis',
  templateUrl: './colvis.component.html',
  styleUrls: ['./colvis.component.scss']
})
export class ColvisComponent implements OnInit {

  @Input() colvisButton: SmartButton;
  @Input() columns: SmartProperty[];
  @Input() showAction = true;
  @Output() btnColvisClickEvent: EventEmitter<SmartProperty> = new EventEmitter<SmartProperty>();
  @ViewChild('ParentMenu', { static: false }) ParentMenu: ElementRef;
  showBackground = false;
  clickedColvis = false;
  left = 0;
  top = 0;
  @HostListener('document:click', ['$event'])
  clickout(event) {
    if (this.ParentMenu) {
      if (!this.ParentMenu.nativeElement.contains(event.target) && !this.clickedColvis) {
        this.showBackground = false;
      }
      this.clickedColvis = false;
    }
  }
  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
    this.columns.forEach(currentItem => {
      if (currentItem.visible === undefined) {
        currentItem.visible = true;
      }
    });
    if (this.showAction) {
      this.columns = [...this.columns,
      {
        key: 'smart-action',
        title: 'Actions',
        visible: true
      } as SmartProperty
      ];
    }

  }

  getContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.colvisButton.content);
  }

  btnColvisClick(element: HTMLElement) {
    this.left = element.offsetLeft;
    this.top = element.offsetTop + element.offsetHeight;
    this.clickedColvis = true;
    this.showBackground = !this.showBackground;
    if (this.colvisButton.action) {
      this.colvisButton.action();
    }
  }

  btnPropertyClick(property: SmartProperty) {
    property.visible = !property.visible;
    this.btnColvisClickEvent.emit(property);
  }
}
