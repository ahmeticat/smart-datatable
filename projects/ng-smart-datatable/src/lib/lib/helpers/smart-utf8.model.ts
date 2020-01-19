export class UTF8 {
    static parseUTF(word: string): string {
        const letters = { 'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç' };
        word = word.replace(/(([İIŞĞÜÇÖ]))/g, (letter) => letters[letter]);
        return word;
    }
}
