---
layout: default
title: Home
nav_order: 1
description: "Simple table extension with sorting, filtering, exporting ... for Angular apps."
permalink: /
---

# ngx-table
{: .fs-9 }

Simple table extension with sorting, filtering, exporting ... for Angular apps.
{: .fs-6 .fw-300 }

[Get started now](#getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 } 

---

## Getting started

### Dependencies

Smart datatable is an library for [Angular](https://angular.io). View the [quick start guide](https://github.com/ahmeticat/smart-datatable-page) for more information. Smart datatable requires no special plugins and can run on [Angular](https://angular.io). 

### Quick start

1. A recommended way to install **ng-smart-datatable** is through npm package manager using the following command:
```bash
 npm i ng-smart-datatable --save
```

### Usage

1. Import NgSmartDatatableModule in your module
```javascript
import { Ng2TableModule } from 'ng2-table/ng2-table';
```
```javascript
@NgModule({
  declarations: [
    ...
  ],
  imports: [
    ...
    NgSmartDatatableModule
  ],
})
export class YourModule { }
```
2. Use **ng-smart-datatable** in your component
```html
<ng-smart-datatable [data]="data" [model]="model">
</ng-smart-datatable>
```
3. _Example:_ Initialize data
```bash
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
    }
];
```
and model
```javascript
model: SmartModel = {
    properties: [
      {
        title: 'NAME',
        key: 'Name',
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
    ]
};
```

### Configure Just the Docs

- [See configuration options]({{ site.baseurl }}{% link docs/configuration.md %})

---

## About the project

Smart Datatable is &copy; 2020 by [Ahmet ICAT](http://github.com/ahmeticat).

### License

Smart Datatable is distributed by an [MIT license](https://github.com/ahmeticat/smart-datatable/blob/master/LICENSE.txt).

### Contributing

When contributing to this repository, please first discuss the change you wish to make via issue,
email, or any other method with the owners of this repository before making a change. Read more about becoming a contributor in [our GitHub repo](https://github.com/pmarsceill/just-the-docs#contributing).

#### Thank you to the contributors of Just the Docs!

<ul class="list-style-none">
{% for contributor in site.github.contributors %}
  <li class="d-inline-block mr-1">
     <a href="{{ contributor.html_url }}"><img src="{{ contributor.avatar_url }}" width="32" height="32" alt="{{ contributor.login }}"/></a>
  </li>
{% endfor %}
</ul>

### Code of Conduct

Just the Docs is committed to fostering a welcoming community.

[View our Code of Conduct](https://github.com/pmarsceill/just-the-docs/tree/master/CODE_OF_CONDUCT.md) on our GitHub repository.
