import { NgModule } from '@angular/core';
import { NgSmartDatatableComponent } from './ng-smart-datatable.component';
import { SmartTBodyModuleModule } from './components/tbody/smart-tbody-module.module';
import { SmartTHeadModuleModule } from './components/thead/smart-thead-module.module';

@NgModule({
  declarations: [NgSmartDatatableComponent],
  imports: [
    SmartTBodyModuleModule,
    SmartTHeadModuleModule
  ],
  exports: [NgSmartDatatableComponent]
})
export class NgSmartDatatableModule { }
