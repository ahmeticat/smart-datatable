import { ActionType } from './smart-action-type.model';

export class SmartAction {
    type: ActionType;
    content: string;
    visible: boolean;
    click?: (item) => void;
}
