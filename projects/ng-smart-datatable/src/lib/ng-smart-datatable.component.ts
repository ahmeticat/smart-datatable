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
  themeFile = '';
  constructor() { }

  ngOnInit() {
    this.themeFile = 'ng-smart-datatable.component.scss';
    switch (this.cssClass) {
      case this.cssClasses.Bootstrap3:
        this.themeFile = '../lib/themes/bootstrap3/bootstrap.min.css';
        break;
      case this.cssClasses.Bootstrap4:
        this.themeFile = '../lib/themes/bootstrap4/bootstrap.scss';
        break;
      case this.cssClasses.Bulma:
        this.themeFile = '';
        break;
      case this.cssClasses.Custom:
        this.themeFile = 'ng-smart-datatable.component.scss';
        break;
      case this.cssClasses.Foundation:
        this.themeFile = '';
        break;
      case this.cssClasses.JqueryUI:
        this.themeFile = '';
        break;
      case this.cssClasses.Materialize:
        this.themeFile = '';
        break;
      default:
        break;
    }
    this.themeFile = `<link id="theme" href="${this.themeFile}">`;
    // document.getElementById('theme').setAttribute('href', themeFile);
    // this.loadStyle(this.themeFile);
  }

  loadStyle(styleName: string) {
    const head = document.getElementsByTagName('head')[0];

    const themeLink = document.getElementById(
      'theme'
    ) as HTMLLinkElement;
    if (themeLink) {
      themeLink.href = styleName;
    } else {
      const style = document.createElement('link');
      style.id = 'theme';
      // style.rel = 'stylesheet';
      style.href = `${styleName}`;

      head.appendChild(style);
    }
  }

}
