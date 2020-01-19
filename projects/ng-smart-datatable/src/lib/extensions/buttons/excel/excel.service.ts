import { Injectable } from '@angular/core';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
const EXCEL_EXTENSION = '.xlsx';
const CSV_EXTENSION = '.csv';

@Injectable()
export class ExcelService {

    constructor() { }

    public exportAsExcelFile(json: any[], excelFileName: string): void {

        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(json);
        const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
        const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        this.saveAsExcelFile(excelBuffer, excelFileName);
    }


    public exportAsCsvFile(json: any[], csvFileName: string): void {

        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(json);
        const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
        const excelBuffer: any = XLSX.write(workbook, { bookType: 'csv', type: 'array' });
        this.saveAsCsvFile(excelBuffer, csvFileName);
    }
    public exportAsExcelFileMultipleSheet(jsonFirst: any[], jsonSecond: any[], excelFileName: string): void {

        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(jsonFirst);
        const worksheet2: XLSX.WorkSheet = XLSX.utils.json_to_sheet(jsonSecond);
        worksheet2['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, /* A1:B1 */
            { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } } /* C1:D1 */
        ];
        const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
        workbook.SheetNames.push('Sheet1');
        workbook.Sheets.Sheet1 = worksheet2;
        const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        this.saveAsExcelFile(excelBuffer, excelFileName);
    }

    private saveAsExcelFile(buffer: any, fileName: string): void {
        const data: Blob = new Blob([buffer], {
            type: EXCEL_TYPE
        });
        FileSaver.saveAs(data, fileName + EXCEL_EXTENSION);
    }

    private saveAsCsvFile(buffer: any, fileName: string): void {
        const data: Blob = new Blob([buffer], {type: 'text/csv' });
        FileSaver.saveAs(data, fileName + CSV_EXTENSION);
    }

}
