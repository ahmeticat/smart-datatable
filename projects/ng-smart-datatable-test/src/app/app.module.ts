import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NgSmartDatatableModule } from 'projects/ng-smart-datatable/src/lib/ng-smart-datatable.module';



@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    NgSmartDatatableModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
