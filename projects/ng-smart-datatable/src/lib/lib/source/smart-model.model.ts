import { SmartProperty } from './smart-property.model';
import { SmartAction } from './smart-action-property.model';
import { ActionType } from './smart-action-type.model';
import { SmartButton } from './smart-button.model';
import { SmartButtonType } from './smart-button-type.model';
import { SmartLanguage } from './smart-language.model';

export class SmartModel {
    properties: SmartProperty[];
    actions?: SmartAction[];
    buttons?: SmartButton[];
    language?: SmartLanguage;

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

    static initializeDefaultButtons() {
        return [
            {
                type: SmartButtonType.Excel,
                content: 'Excel',
                visible: true,
                title: 'Smart Excel'
            },
            {
                type: SmartButtonType.Pdf,
                content: 'Pdf',
                visible: true,
                title: 'Smart Pdf'
            },
            {
                type: SmartButtonType.Csv,
                content: 'Csv',
                visible: true,
                title: 'Smart Csv'
            },
            {
                type: SmartButtonType.Copy,
                content: 'Copy',
                visible: true,
                title: 'Smart Copy'
            },
            {
                type: SmartButtonType.Colvis,
                content: 'Columns',
                visible: true,
                title: ''
            }
        ] as SmartButton[];
    }

    static initializeDefaultLanguage() {
        return {
            actionsColumnHeader: 'Actions',
            filteredInfo: '(Filtered from **TOTAL** entries)',
            info: 'Showing **START** to **END** of **TOTAL** entries',
            lengthMenu: 'Show **LENGTH** entries',
            paginationNext: 'Next',
            paginationPrevious: 'Previous',
            search: 'Search : **SEARCH**',
            searchPlaceholder: 'Search',
            noResultsFound: 'No Results Found'
        } as SmartLanguage;
    }
}
