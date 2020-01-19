import { SmartDataTypes } from './smart-dataType.model';

export class SmartProperty {
    key: string;
    title: string;
    smartHtml?: (item, key) => string;
    inlineSearch?= false;
    searchable?= true;
    visible?= true;
    width?: string;
    type?: SmartDataTypes = SmartDataTypes.Text;
}
