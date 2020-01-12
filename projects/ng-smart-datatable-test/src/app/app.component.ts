import { Component } from '@angular/core';
import { SmartModel } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-model.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
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
      name: 'Ayşe',
      surname: 'YILMAZ'
    }
  ];

  model = {
    properties: [
      {
        title: 'Adı',
        key: 'name'
      },
      {
        title: 'Soyadı',
        key: 'surname'
      }
    ]
  };
}
