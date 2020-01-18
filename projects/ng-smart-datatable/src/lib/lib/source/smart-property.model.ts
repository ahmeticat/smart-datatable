import { SmartDataTypes } from './smart-dataType.model';

export class SmartProperty {
    key: string;
    title: string;
    inlineSearch ? = false;
    searchable ? = true;
    visible ? = true;
    type?: SmartDataTypes = SmartDataTypes.Text;
}
