import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SmartHeadComponent } from './smart-head/smart-head.component';

@NgModule({
  declarations: [SmartHeadComponent],
  imports: [
    CommonModule
  ],
  exports: [
    SmartHeadComponent
  ]
})
export class SmartTHeadModuleModule { }
