import { NgModule } from '@angular/core';
import { NgSmartDatatableComponent } from './ng-smart-datatable.component';
import { SmartTBodyModuleModule } from './components/tbody/smart-tbody-module.module';
import { SmartTHeadModuleModule } from './components/thead/smart-thead-module.module';
import { CommonModule } from '@angular/common';
import { SmartPagerModule } from './components/pager/smart-pager.module';
import { SmartLengthModule } from './components/length/smart-length.module';
import { SmartFilterModule } from './components/filter/smart-filter.module';
import { SmartInfoModule } from './components/info/smart-info.module';

@NgModule({
  declarations: [NgSmartDatatableComponent],
  imports: [
    CommonModule,
    SmartTBodyModuleModule,
    SmartTHeadModuleModule,
    SmartPagerModule,
    SmartLengthModule,
    SmartFilterModule,
    SmartInfoModule
  ],
  exports: [NgSmartDatatableComponent]
})
export class NgSmartDatatableModule { }
