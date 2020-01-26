import { Component } from '@angular/core';
import { ActionType } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-action-type.model';
import { SmartButtonType } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-button-type.model';
import { SmartModel } from 'projects/ng-smart-datatable/src/lib/lib/source/smart-model.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  data = [
    {
      Name: 'Airi',
      Surname: 'Satou',
      Position: 'Accountant',
      Office: 'Tokyo',
      Age: '33'
    },
    {
      Name: 'Angelica',
      Surname: 'Ramos',
      Position: 'Chief Executive Officer (CEO)',
      Office: 'London',
      Age: '47'
    },
    {
      Name: 'Ashton',
      Surname: 'Cox',
      Position: 'Junior Technical Author',
      Office: 'San Francisco',
      Age: '66'
    },
    {
      Name: 'Bradley',
      Surname: 'Greer',
      Position: 'Software Engineer',
      Office: 'London',
      Age: '41'
    },
    {
      Name: 'Brenden',
      Surname: 'Wagner',
      Position: 'Software Engineer',
      Office: 'San Francisco',
      Age: '28'
    },
    {
      Name: 'Brielle',
      Surname: 'Williamson',
      Position: 'Integration Specialist',
      Office: 'New York',
      Age: '61'
    },
    {
      Name: 'Bruno',
      Surname: 'Nash',
      Position: 'Software Engineer',
      Office: 'London',
      Age: '38'
    },
    {
      Name: 'Caesar',
      Surname: 'Vance',
      Position: 'Pre-Sales Support',
      Office: 'New York',
      Age: '21'
    },
    {
      Name: 'Cara',
      Surname: 'Stevens',
      Position: 'Sales Assistant',
      Office: 'New York',
      Age: '46'
    },
    {
      Name: 'Cedric',
      Surname: 'Kelly',
      Position: 'Senior Javascript Developer',
      Office: 'Edinburgh',
      Age: '22'
    },
    {
      Name: 'Charde',
      Surname: 'Marshall',
      Position: 'Regional Director',
      Office: 'San Francisco',
      Age: '36'
    },
    {
      Name: 'Colleen',
      Surname: 'Hurst',
      Position: 'Javascript Developer',
      Office: 'San Francisco',
      Age: '39'
    },
    {
      Name: 'Dai',
      Surname: 'Rios',
      Position: 'Personnel Lead',
      Office: 'Edinburgh',
      Age: '35'
    },
    {
      Name: 'Donna',
      Surname: 'Snider',
      Position: 'Customer Support',
      Office: 'New York',
      Age: '27'
    },
    {
      Name: 'Doris',
      Surname: 'Wilder',
      Position: 'Sales Assistant',
      Office: 'Sydney',
      Age: '23'
    },
    {
      Name: 'Finn',
      Surname: 'Camacho',
      Position: 'Support Engineer',
      Office: 'San Francisco',
      Age: '47'
    },
    {
      Name: 'Fiona',
      Surname: 'Green',
      Position: 'Chief Operating Officer (COO)',
      Office: 'San Francisco',
      Age: '48'
    },
    {
      Name: 'Garrett',
      Surname: 'Winters',
      Position: 'Accountant',
      Office: 'Tokyo',
      Age: '63'
    },
    {
      Name: 'Gavin',
      Surname: 'Cortez',
      Position: 'Team Leader',
      Office: 'San Francisco',
      Age: '22'
    },
    {
      Name: 'Gavin',
      Surname: 'Joyce',
      Position: 'Developer',
      Office: 'Edinburgh',
      Age: '42'
    },
    {
      Name: 'Gloria',
      Surname: 'Little',
      Position: 'Systems Administrator',
      Office: 'New York',
      Age: '59'
    },
    {
      Name: 'Haley',
      Surname: 'Kennedy',
      Position: 'Senior Marketing Designer',
      Office: 'London',
      Age: '43'
    },
    {
      Name: 'Hermione',
      Surname: 'Butler',
      Position: 'Regional Director',
      Office: 'London',
      Age: '47'
    },
    {
      Name: 'Herrod',
      Surname: 'Chandler',
      Position: 'Sales Assistant',
      Office: 'San Francisco',
      Age: '59'
    },
    {
      Name: 'Hope',
      Surname: 'Fuentes',
      Position: 'Secretary',
      Office: 'San Francisco',
      Age: '41'
    },
    {
      Name: 'Howard',
      Surname: 'Hatfield',
      Position: 'Office Manager',
      Office: 'San Francisco',
      Age: '51'
    },
    {
      Name: 'Jackson',
      Surname: 'Bradshaw',
      Position: 'Director',
      Office: 'New York',
      Age: '65'
    },
    {
      Name: 'Jena',
      Surname: 'Gaines',
      Position: 'Office Manager',
      Office: 'London',
      Age: '30'
    },
    {
      Name: 'Jenette',
      Surname: 'Caldwell',
      Position: 'Development Lead',
      Office: 'New York',
      Age: '30'
    },
    {
      Name: 'Jennifer',
      Surname: 'Acosta',
      Position: 'Junior Javascript Developer',
      Office: 'Edinburgh',
      Age: '43'
    },
    {
      Name: 'Jennifer',
      Surname: 'Chang',
      Position: 'Regional Director',
      Office: 'Singapore',
      Age: '28'
    },
    {
      Name: 'Jonas',
      Surname: 'Alexander',
      Position: 'Developer',
      Office: 'San Francisco',
      Age: '30'
    },
    {
      Name: 'Lael',
      Surname: 'Greer',
      Position: 'Systems Administrator',
      Office: 'London',
      Age: '21'
    },
    {
      Name: 'Martena',
      Surname: 'Mccray',
      Position: 'Post-Sales support',
      Office: 'Edinburgh',
      Age: '46'
    },
    {
      Name: 'Michael',
      Surname: 'Bruce',
      Position: 'Javascript Developer',
      Office: 'Singapore',
      Age: '29'
    },
    {
      Name: 'Michael',
      Surname: 'Silva',
      Position: 'Marketing Designer',
      Office: 'London',
      Age: '66'
    },
    {
      Name: 'Michelle',
      Surname: 'House',
      Position: 'Integration Specialist',
      Office: 'Sydney',
      Age: '37'
    },
    {
      Name: 'Olivia',
      Surname: 'Liang',
      Position: 'Support Engineer',
      Office: 'Singapore',
      Age: '64'
    },
    {
      Name: 'Paul',
      Surname: 'Byrd',
      Position: 'Chief Financial Officer (CFO)',
      Office: 'New York',
      Age: '64'
    },
    {
      Name: 'Prescott',
      Surname: 'Bartlett',
      Position: 'Technical Author',
      Office: 'London',
      Age: '27'
    },
    {
      Name: 'Quinn',
      Surname: 'Flynn',
      Position: 'Support Lead',
      Office: 'Edinburgh',
      Age: '22'
    },
    {
      Name: 'Rhona',
      Surname: 'Davidson',
      Position: 'Integration Specialist',
      Office: 'Tokyo',
      Age: '55'
    },
    {
      Name: 'Sakura',
      Surname: 'Yamamoto',
      Position: 'Support Engineer',
      Office: 'Tokyo',
      Age: '37'
    },
    {
      Name: 'Serge',
      Surname: 'Baldwin',
      Position: 'Data Coordinator',
      Office: 'Singapore',
      Age: '64'
    },
    {
      Name: 'Shad',
      Surname: 'Decker',
      Position: 'Regional Director',
      Office: 'Edinburgh',
      Age: '51'
    },
    {
      Name: 'Shou',
      Surname: 'Itou',
      Position: 'Regional Marketing',
      Office: 'Tokyo',
      Age: '20'
    },
    {
      Name: 'Sonya',
      Surname: 'Frost',
      Position: 'Software Engineer',
      Office: 'Edinburgh',
      Age: '23'
    },
    {
      Name: 'Suki',
      Surname: 'Burks',
      Position: 'Developer',
      Office: 'London',
      Age: '53'
    },
    {
      Name: 'Tatyana',
      Surname: 'Fitzpatrick',
      Position: 'Regional Director',
      Office: 'London',
      Age: '19'
    },
    {
      Name: 'Thor',
      Surname: 'Walton',
      Position: 'Developer',
      Office: 'New York',
      Age: '61'
    },
    {
      Name: 'Tiger',
      Surname: 'Nixon',
      Position: 'System Architect',
      Office: 'Edinburgh',
      Age: '61'
    },
    {
      Name: 'Timothy',
      Surname: 'Mooney',
      Position: 'Office Manager',
      Office: 'London',
      Age: '37'
    },
    {
      Name: 'Unity',
      Surname: 'Butler',
      Position: 'Marketing Designer',
      Office: 'San Francisco',
      Age: '47'
    },
    {
      Name: 'Vivian',
      Surname: 'Harrell',
      Position: 'Financial Controller',
      Office: 'San Francisco',
      Age: '62'
    },
    {
      Name: 'Yuri',
      Surname: 'Berry',
      Position: 'Chief Marketing Officer (CMO)',
      Office: 'New York',
      Age: '40'
    },
    {
      Name: 'Zenaida',
      Surname: 'Frank',
      Position: 'Software Engineer',
      Office: 'New York',
      Age: '63'
    },
    {
      Name: 'Zorita',
      Surname: 'Serrano',
      Position: 'Software Engineer',
      Office: 'San Francisco',
      Age: '56'
    }
  ];

  colDef = (item, key) => {
    return `<div class="name-cell-column"><a href="${item[`${key}`]}">${item[`${key}`]}</a></div>`;
  }


  // tslint:disable-next-line: member-ordering
  model: SmartModel = {
    properties: [
      {
        title: 'NAME',
        key: 'Name',
        inlineSearch: true,
        smartHtml: this.colDef,
        width: '300px'
      },
      {
        title: 'SURNAME',
        key: 'Surname',
        width: '30%'
      },
      {
        title: 'POSITION',
        key: 'Position',
        width: '30%'
      }
    ],
    actions: [
      {
        type: ActionType.Add,
        content: '<input type="button" value="Add" class="add-item">',
        visible: true
      },
      {
        type: ActionType.Delete,
        content: '<span style="color:red">Delete</span>',
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
      },
      {
        content: 'Excel Test',
        type: SmartButtonType.Excel,
        visible: true,
        action: this.btnCustomExcelButtonClick
      }
    ],
    language: {
      actionsColumnHeader: 'İşlemler'
    }
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

  btnCustomExcelButtonClick() {
    alert(`Custom Excel Button Click`);
  }
}
