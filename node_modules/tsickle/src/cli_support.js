/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("tsickle/src/cli_support", ["require", "exports", "assert", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const assert = require("assert");
    const path = require("path");
    /**
     * asserts that the given fileName is an absolute path.
     *
     * The TypeScript API works in absolute paths, so we must be careful to resolve
     * paths before handing them over to TypeScript.
     */
    function assertAbsolute(fileName) {
        assert(path.isAbsolute(fileName), `expected ${JSON.stringify(fileName)} to be absolute`);
    }
    exports.assertAbsolute = assertAbsolute;
    /**
     * Takes a context (ts.SourceFile.fileName of the current file) and the import URL of an ES6
     * import and generates a googmodule module name for the imported module.
     */
    function pathToModuleName(rootModulePath, context, fileName) {
        fileName = fileName.replace(/(\.d)?\.[tj]s$/, '');
        if (fileName[0] === '.') {
            // './foo' or '../foo'.
            // Resolve the path against the dirname of the current module.
            fileName = path.join(path.dirname(context), fileName);
        }
        // TODO(evanm): various tests assume they can import relative paths like
        // 'foo/bar' and have them interpreted as root-relative; preserve that here.
        // Fix this by removing the next line.
        if (!path.isAbsolute(fileName))
            fileName = path.join(rootModulePath, fileName);
        // TODO(evanm): various tests assume they can pass in a 'fileName' like
        // 'goog:foo.bar' and have this function do something reasonable.
        // For correctness, the above must have produced an absolute path.
        // assertAbsolute(fileName);
        if (rootModulePath) {
            fileName = path.relative(rootModulePath, fileName);
        }
        // Replace characters not supported by goog.module.
        const moduleName = fileName.replace(/\/|\\/g, '.').replace(/^[^a-zA-Z_$]/, '_').replace(/[^a-zA-Z0-9._$]/g, '_');
        return moduleName;
    }
    exports.pathToModuleName = pathToModuleName;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpX3N1cHBvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY2xpX3N1cHBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCxpQ0FBaUM7SUFDakMsNkJBQTZCO0lBRTdCOzs7OztPQUtHO0lBQ0gsU0FBZ0IsY0FBYyxDQUFDLFFBQWdCO1FBQzdDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLFlBQVksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBRkQsd0NBRUM7SUFFRDs7O09BR0c7SUFDSCxTQUFnQixnQkFBZ0IsQ0FDNUIsY0FBc0IsRUFBRSxPQUFlLEVBQUUsUUFBZ0I7UUFDM0QsUUFBUSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFbEQsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQ3ZCLHVCQUF1QjtZQUN2Qiw4REFBOEQ7WUFDOUQsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztTQUN2RDtRQUVELHdFQUF3RTtRQUN4RSw0RUFBNEU7UUFDNUUsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztZQUFFLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUUvRSx1RUFBdUU7UUFDdkUsaUVBQWlFO1FBRWpFLGtFQUFrRTtRQUNsRSw0QkFBNEI7UUFFNUIsSUFBSSxjQUFjLEVBQUU7WUFDbEIsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ3BEO1FBRUQsbURBQW1EO1FBQ25ELE1BQU0sVUFBVSxHQUNaLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRWxHLE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7SUE5QkQsNENBOEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8qKlxuICogYXNzZXJ0cyB0aGF0IHRoZSBnaXZlbiBmaWxlTmFtZSBpcyBhbiBhYnNvbHV0ZSBwYXRoLlxuICpcbiAqIFRoZSBUeXBlU2NyaXB0IEFQSSB3b3JrcyBpbiBhYnNvbHV0ZSBwYXRocywgc28gd2UgbXVzdCBiZSBjYXJlZnVsIHRvIHJlc29sdmVcbiAqIHBhdGhzIGJlZm9yZSBoYW5kaW5nIHRoZW0gb3ZlciB0byBUeXBlU2NyaXB0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QWJzb2x1dGUoZmlsZU5hbWU6IHN0cmluZykge1xuICBhc3NlcnQocGF0aC5pc0Fic29sdXRlKGZpbGVOYW1lKSwgYGV4cGVjdGVkICR7SlNPTi5zdHJpbmdpZnkoZmlsZU5hbWUpfSB0byBiZSBhYnNvbHV0ZWApO1xufVxuXG4vKipcbiAqIFRha2VzIGEgY29udGV4dCAodHMuU291cmNlRmlsZS5maWxlTmFtZSBvZiB0aGUgY3VycmVudCBmaWxlKSBhbmQgdGhlIGltcG9ydCBVUkwgb2YgYW4gRVM2XG4gKiBpbXBvcnQgYW5kIGdlbmVyYXRlcyBhIGdvb2dtb2R1bGUgbW9kdWxlIG5hbWUgZm9yIHRoZSBpbXBvcnRlZCBtb2R1bGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRoVG9Nb2R1bGVOYW1lKFxuICAgIHJvb3RNb2R1bGVQYXRoOiBzdHJpbmcsIGNvbnRleHQ6IHN0cmluZywgZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGZpbGVOYW1lID0gZmlsZU5hbWUucmVwbGFjZSgvKFxcLmQpP1xcLlt0al1zJC8sICcnKTtcblxuICBpZiAoZmlsZU5hbWVbMF0gPT09ICcuJykge1xuICAgIC8vICcuL2Zvbycgb3IgJy4uL2ZvbycuXG4gICAgLy8gUmVzb2x2ZSB0aGUgcGF0aCBhZ2FpbnN0IHRoZSBkaXJuYW1lIG9mIHRoZSBjdXJyZW50IG1vZHVsZS5cbiAgICBmaWxlTmFtZSA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoY29udGV4dCksIGZpbGVOYW1lKTtcbiAgfVxuXG4gIC8vIFRPRE8oZXZhbm0pOiB2YXJpb3VzIHRlc3RzIGFzc3VtZSB0aGV5IGNhbiBpbXBvcnQgcmVsYXRpdmUgcGF0aHMgbGlrZVxuICAvLyAnZm9vL2JhcicgYW5kIGhhdmUgdGhlbSBpbnRlcnByZXRlZCBhcyByb290LXJlbGF0aXZlOyBwcmVzZXJ2ZSB0aGF0IGhlcmUuXG4gIC8vIEZpeCB0aGlzIGJ5IHJlbW92aW5nIHRoZSBuZXh0IGxpbmUuXG4gIGlmICghcGF0aC5pc0Fic29sdXRlKGZpbGVOYW1lKSkgZmlsZU5hbWUgPSBwYXRoLmpvaW4ocm9vdE1vZHVsZVBhdGgsIGZpbGVOYW1lKTtcblxuICAvLyBUT0RPKGV2YW5tKTogdmFyaW91cyB0ZXN0cyBhc3N1bWUgdGhleSBjYW4gcGFzcyBpbiBhICdmaWxlTmFtZScgbGlrZVxuICAvLyAnZ29vZzpmb28uYmFyJyBhbmQgaGF2ZSB0aGlzIGZ1bmN0aW9uIGRvIHNvbWV0aGluZyByZWFzb25hYmxlLlxuXG4gIC8vIEZvciBjb3JyZWN0bmVzcywgdGhlIGFib3ZlIG11c3QgaGF2ZSBwcm9kdWNlZCBhbiBhYnNvbHV0ZSBwYXRoLlxuICAvLyBhc3NlcnRBYnNvbHV0ZShmaWxlTmFtZSk7XG5cbiAgaWYgKHJvb3RNb2R1bGVQYXRoKSB7XG4gICAgZmlsZU5hbWUgPSBwYXRoLnJlbGF0aXZlKHJvb3RNb2R1bGVQYXRoLCBmaWxlTmFtZSk7XG4gIH1cblxuICAvLyBSZXBsYWNlIGNoYXJhY3RlcnMgbm90IHN1cHBvcnRlZCBieSBnb29nLm1vZHVsZS5cbiAgY29uc3QgbW9kdWxlTmFtZSA9XG4gICAgICBmaWxlTmFtZS5yZXBsYWNlKC9cXC98XFxcXC9nLCAnLicpLnJlcGxhY2UoL15bXmEtekEtWl8kXS8sICdfJykucmVwbGFjZSgvW15hLXpBLVowLTkuXyRdL2csICdfJyk7XG5cbiAgcmV0dXJuIG1vZHVsZU5hbWU7XG59XG4iXX0=