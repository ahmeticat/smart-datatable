import { SmartProperty } from './smart-property.model';
import { SmartAction } from './smart-action-property.model';
import { ActionType } from './smart-action-type.model';

export class SmartModel {
    properties: SmartProperty[];
    actions?: SmartAction[];
    buttons?: any;

    static initializeDefaultActions() {
        return [
            {
                type: ActionType.Add,
                content: 'Add',
                visible: true
            },
            {
                type: ActionType.Edit,
                content: 'Edit',
                visible: true
            },
            {
                type: ActionType.Delete,
                content: 'Delete',
                visible: true
            }
        ] as SmartAction[];
    }
}
