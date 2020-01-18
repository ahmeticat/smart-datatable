import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AddComponent } from './add/add.component';
import { EditComponent } from './edit/edit.component';
import { DeleteComponent } from './delete/delete.component';

@NgModule({
  declarations: [AddComponent, EditComponent, DeleteComponent],
  imports: [
    CommonModule
  ],
  exports: [AddComponent, EditComponent, DeleteComponent]
})
export class SmartActionModule { }
