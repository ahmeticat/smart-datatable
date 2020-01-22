import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CopyComponent } from './copy/copy.component';
import { ExcelComponent } from './excel/excel.component';
import { PdfComponent } from './pdf/pdf.component';
import { CsvComponent } from './csv/csv.component';
import { ButtonsComponent } from './buttons.component';
import { ExcelService } from './excel/excel.service';
import { CopyMessageComponent } from './copy-message/copy-message.component';
import { ColvisComponent } from './colvis/colvis.component';


@NgModule({
  declarations: [
    CopyComponent,
    ExcelComponent,
    PdfComponent,
    CsvComponent,
    ButtonsComponent,
    CopyMessageComponent,
    ColvisComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    CopyComponent,
    ExcelComponent,
    PdfComponent,
    CsvComponent,
    ButtonsComponent,
    CopyMessageComponent,
    ColvisComponent
  ]
})
export class SmartExtensionButtonsModule { }
