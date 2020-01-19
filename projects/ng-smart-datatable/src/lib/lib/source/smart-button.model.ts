import { SmartButtonType } from './smart-button-type.model';

export class SmartButton {
    type: SmartButtonType;
    content: string;
    htmlClass: string;
    visible: boolean;
    title?: string;
    action: () => void;
    buttons?: SmartButton;
}
