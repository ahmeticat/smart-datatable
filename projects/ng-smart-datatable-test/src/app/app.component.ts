import { Component } from '@angular/core';
import { SmartModel } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-model.model';
import { SmartCssClass } from 'projects/ng-smart-datatable/src/lib/lib/helpers/smart-css-class.model';
import { ActionType } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-action-type.model';
import { SmartButtonType } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-button-type.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  data = [
    {
      name: 'Ahmet',
      surname: 'İCAT',
      email: 'ahmet@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT',
      email: 'ahmet@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT',
      email: 'ahmet@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT',
      email: 'ahmet@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT',
      email: 'ahmet@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT',
      email: 'ahmet@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ',
      email: 'mehmet@gmail.com'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN',
      email: 'bilal@gmail.com'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN',
      email: 'ismail@gmail.com'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ',
      email: 'ayse@gmail.com'
    }
  ];

  cssClass = SmartCssClass.Bootstrap4;

  colDef = (item, key) => {
    return `<div class="name-cell-column"><a href="${item[`${key}`]}">${item[`${key}`]}</a></div>`;
  }


  // tslint:disable-next-line: member-ordering
  model: SmartModel = {
    properties: [
      {
        title: 'Adı',
        key: 'name',
        inlineSearch: true,
        smartHtml: this.colDef,
        width: '40%'
      },
      {
        title: 'Soyadı',
        key: 'surname',
        width: '500px'
      }
    ],
    actions: [
      {
        type: ActionType.Add,
        content: '<input type="button" value="Add" class="add-item">',
        visible: true
      },
      {
        type: ActionType.Custom,
        content: 'First Custom Button',
        visible: true,
        click: this.btnCustomClick
      },
    ],
    buttons: [
      {
        content: 'Custom',
        type: SmartButtonType.Custom,
        visible: true,
        action: this.btnCustomButtonClick
      }
    ]
  };

  btnEditClick(item: any) {
    alert(`Edit Click : ${JSON.stringify(item)}`);
  }

  btnDeleteClick(item: any) {
    alert(`Delete Click : ${JSON.stringify(item)}`);
  }

  btnAddClick() {
    alert(`Add Click`);
  }

  btnCustomClick(item: any) {
    alert(`Custom Click : ${JSON.stringify(item)}`);
  }

  btnCustomButtonClick() {
    alert(`Custom Button Click`);
  }
}
