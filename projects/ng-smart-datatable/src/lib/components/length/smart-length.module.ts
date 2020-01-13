import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LengthComponent } from './length/length.component';

@NgModule({
  declarations: [LengthComponent],
  imports: [
    CommonModule
  ],
  exports: [LengthComponent]
})
export class SmartLengthModule { }
