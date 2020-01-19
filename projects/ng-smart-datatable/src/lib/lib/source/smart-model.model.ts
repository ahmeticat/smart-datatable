import { SmartProperty } from './smart-property.model';
import { SmartAction } from './smart-action-property.model';

export class SmartModel {
    properties: SmartProperty[];
    actions?: SmartAction[];
    buttons?: any;

    static initializeDefaultActions() {
        return [
            {
                key: 'SmartAdd',
                content: 'Add',
                visible: true
            },
            {
                key: 'SmartEdit',
                content: 'Edit',
                visible: true
            },
            {
                key: 'SmartDelete',
                content: 'Delete',
                visible: true
            }
        ] as SmartAction[];
    }
}
