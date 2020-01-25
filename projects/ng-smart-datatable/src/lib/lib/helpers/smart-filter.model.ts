export class SmartFilter {
    static filter(data: any[], property: string, key: string): any[] {
        const result = data.filter(a =>
            this.turkishToLower((a[`${property}`] as any).toString())
                .includes(this.turkishToLower(key.toLocaleLowerCase())));
        return result;
    }

    static filterAllProperty(data: any[], key: string): any[] {
        const result = data.filter(o => Object.keys(o).some(k =>
            this.turkishToLower(o[k].toLowerCase()).includes(this.turkishToLower(key.toLowerCase()))));
        return result;
    }

    static turkishToLower(word: string) {
        // tslint:disable-next-line: object-literal-key-quotes
        const letters = { 'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç' };
        word = word.replace(/(([İIŞĞÜÇÖ]))/g, (letter) => letters[letter]);
        return word.toLowerCase();
    }
}
