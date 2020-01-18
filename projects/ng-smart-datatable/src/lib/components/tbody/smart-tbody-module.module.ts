import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SmartBodyComponent } from './smart-body.component';
import { SmartActionModule } from './action/smart-action.module';

@NgModule({
  declarations: [SmartBodyComponent],
  imports: [
    CommonModule,
    SmartActionModule
  ],
  exports: [
    SmartBodyComponent,
    SmartActionModule
  ]
})
export class SmartTBodyModuleModule { }
