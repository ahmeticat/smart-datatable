import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SmartBodyComponent } from './smart-body.component';

@NgModule({
  declarations: [SmartBodyComponent],
  imports: [
    CommonModule
  ],
  exports: [
    SmartBodyComponent
  ]
})
export class SmartTBodyModuleModule { }
