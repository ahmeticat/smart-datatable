import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ColumnComponent } from './column/column.component';
import { SmartHeadComponent } from './smart-head/smart-head.component';

@NgModule({
  declarations: [ColumnComponent, SmartHeadComponent],
  imports: [
    CommonModule
  ],
  exports: [
    ColumnComponent,
    SmartHeadComponent
  ]
})
export class SmartTHeadModuleModule { }
