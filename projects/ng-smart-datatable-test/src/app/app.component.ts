import { Component } from '@angular/core';
import { SmartModel } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-model.model';
import { SmartCssClass } from 'projects/ng-smart-datatable/src/lib/lib/helpers/smart-css-class.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  data = [
    {
      name: 'Ahmet',
      surname: 'İCAT'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    },
    {
      name: 'Ahmet',
      surname: 'İCAT'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    },
    {
      name: 'Mehmet',
      surname: 'DENİZ'
    },
    {
      name: 'Bilal',
      surname: 'TOSUN'
    }, {
      name: 'İsmail',
      surname: 'KAŞAN'
    },
    {
      name: 'Ayşe',
      surname: 'YILMAZ'
    }
  ];

  cssClass = SmartCssClass.Bootstrap4;

  colDef = (item, key) => {
    return `<b>${item[`${key}`]}</b>`;
  }


  // tslint:disable-next-line: member-ordering
  model: SmartModel = {
    properties: [
      {
        title: 'Adı',
        key: 'name',
        inlineSearch: true,
        smartHtml: this.colDef
      },
      {
        title: 'Soyadı',
        key: 'surname',
      }
    ],
    actions: [
      {
        key: 'SmartAdd',
        content: '<input type="button" value="Add" class="add-item">',
        visible: true
      },
      {
        key: 'Custom',
        content: 'First Custom Button',
        visible: true
      },
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
}
