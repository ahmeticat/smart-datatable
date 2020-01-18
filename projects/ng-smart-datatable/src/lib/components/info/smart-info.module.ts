import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfoComponent } from './info/info.component';

@NgModule({
  declarations: [InfoComponent],
  imports: [
    CommonModule
  ],
  exports: [InfoComponent]
})
export class SmartInfoModule { }
