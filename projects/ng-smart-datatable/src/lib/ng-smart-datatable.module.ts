import { NgModule } from '@angular/core';
import { NgSmartDatatableComponent } from './ng-smart-datatable.component';
import { SmartTBodyModuleModule } from './components/tbody/smart-tbody-module.module';
import { SmartTHeadModuleModule } from './components/thead/smart-thead-module.module';
import { CommonModule } from '@angular/common';
import { SmartPagerModule } from './components/pager/smart-pager.module';
import { SafeHtmlPipe } from './lib/helpers/pipe.safehtml';

@NgModule({
  declarations: [NgSmartDatatableComponent, SafeHtmlPipe],
  imports: [
    CommonModule,
    SmartTBodyModuleModule,
    SmartTHeadModuleModule,
    SmartPagerModule
  ],
  exports: [NgSmartDatatableComponent]
})
export class NgSmartDatatableModule { }
