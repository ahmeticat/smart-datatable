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
        define("tsickle/src/tsickle", ["require", "exports", "typescript", "tsickle/src/cli_support", "tsickle/src/decorator_downlevel_transformer", "tsickle/src/enum_transformer", "tsickle/src/externs", "tsickle/src/fileoverview_comment_transformer", "tsickle/src/googmodule", "tsickle/src/jsdoc_transformer", "tsickle/src/modules_manifest", "tsickle/src/transformer_util", "tsickle/src/externs", "tsickle/src/modules_manifest"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ts = require("typescript");
    const cli_support_1 = require("tsickle/src/cli_support");
    const decorator_downlevel_transformer_1 = require("tsickle/src/decorator_downlevel_transformer");
    const enum_transformer_1 = require("tsickle/src/enum_transformer");
    const externs_1 = require("tsickle/src/externs");
    const fileoverview_comment_transformer_1 = require("tsickle/src/fileoverview_comment_transformer");
    const googmodule = require("tsickle/src/googmodule");
    const jsdoc_transformer_1 = require("tsickle/src/jsdoc_transformer");
    const modules_manifest_1 = require("tsickle/src/modules_manifest");
    const transformer_util_1 = require("tsickle/src/transformer_util");
    // Retained here for API compatibility.
    var externs_2 = require("tsickle/src/externs");
    exports.getGeneratedExterns = externs_2.getGeneratedExterns;
    var modules_manifest_2 = require("tsickle/src/modules_manifest");
    exports.ModulesManifest = modules_manifest_2.ModulesManifest;
    function mergeEmitResults(emitResults) {
        const diagnostics = [];
        let emitSkipped = true;
        const emittedFiles = [];
        const externs = {};
        const modulesManifest = new modules_manifest_1.ModulesManifest();
        for (const er of emitResults) {
            diagnostics.push(...er.diagnostics);
            emitSkipped = emitSkipped || er.emitSkipped;
            if (er.emittedFiles) {
                emittedFiles.push(...er.emittedFiles);
            }
            Object.assign(externs, er.externs);
            modulesManifest.addManifest(er.modulesManifest);
        }
        return { diagnostics, emitSkipped, emittedFiles, externs, modulesManifest };
    }
    exports.mergeEmitResults = mergeEmitResults;
    function emitWithTsickle(program, host, tsHost, tsOptions, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers = {}) {
        for (const sf of program.getSourceFiles()) {
            cli_support_1.assertAbsolute(sf.fileName);
        }
        let tsickleDiagnostics = [];
        const typeChecker = program.getTypeChecker();
        const tsickleSourceTransformers = [];
        if (host.transformTypesToClosure) {
            // Only add @suppress {checkTypes} comments when also adding type annotations.
            tsickleSourceTransformers.push(fileoverview_comment_transformer_1.transformFileoverviewCommentFactory(tsickleDiagnostics));
            tsickleSourceTransformers.push(jsdoc_transformer_1.jsdocTransformer(host, tsOptions, tsHost, typeChecker, tsickleDiagnostics));
            tsickleSourceTransformers.push(enum_transformer_1.enumTransformer(typeChecker, tsickleDiagnostics));
            tsickleSourceTransformers.push(decorator_downlevel_transformer_1.decoratorDownlevelTransformer(typeChecker, tsickleDiagnostics));
        }
        else if (host.transformDecorators) {
            tsickleSourceTransformers.push(decorator_downlevel_transformer_1.decoratorDownlevelTransformer(typeChecker, tsickleDiagnostics));
        }
        const modulesManifest = new modules_manifest_1.ModulesManifest();
        const tsickleTransformers = { before: tsickleSourceTransformers };
        const tsTransformers = {
            before: [
                ...(customTransformers.beforeTsickle || []),
                ...(tsickleTransformers.before || []).map(tf => skipTransformForSourceFileIfNeeded(host, tf)),
                ...(customTransformers.beforeTs || []),
            ],
            after: [
                ...(customTransformers.afterTs || []),
                ...(tsickleTransformers.after || []).map(tf => skipTransformForSourceFileIfNeeded(host, tf)),
            ],
            afterDeclarations: customTransformers.afterDeclarations,
        };
        if (host.transformTypesToClosure) {
            // See comment on remoteTypeAssertions.
            tsTransformers.before.push(jsdoc_transformer_1.removeTypeAssertions());
        }
        if (host.googmodule) {
            tsTransformers.after.push(googmodule.commonJsToGoogmoduleTransformer(host, modulesManifest, typeChecker, tsickleDiagnostics));
        }
        const writeFileDelegate = writeFile || tsHost.writeFile.bind(tsHost);
        const writeFileImpl = (fileName, content, writeByteOrderMark, onError, sourceFiles) => {
            cli_support_1.assertAbsolute(fileName);
            if (host.addDtsClutzAliases && transformer_util_1.isDtsFileName(fileName) && sourceFiles) {
                // Only bundle emits pass more than one source file for .d.ts writes. Bundle emits however
                // are not supported by tsickle, as we cannot annotate them for Closure in any meaningful
                // way anyway.
                if (!sourceFiles || sourceFiles.length > 1) {
                    throw new Error(`expected exactly one source file for .d.ts emit, got ${sourceFiles.map(sf => sf.fileName)}`);
                }
                const originalSource = sourceFiles[0];
                content = addClutzAliases(content, originalSource, typeChecker, host);
            }
            writeFileDelegate(fileName, content, writeByteOrderMark, onError, sourceFiles);
        };
        const { diagnostics: tsDiagnostics, emitSkipped, emittedFiles } = program.emit(targetSourceFile, writeFileImpl, cancellationToken, emitOnlyDtsFiles, tsTransformers);
        const externs = {};
        if (host.transformTypesToClosure) {
            const sourceFiles = targetSourceFile ? [targetSourceFile] : program.getSourceFiles();
            for (const sourceFile of sourceFiles) {
                const isDts = transformer_util_1.isDtsFileName(sourceFile.fileName);
                if (isDts && host.shouldSkipTsickleProcessing(sourceFile.fileName)) {
                    continue;
                }
                const { output, diagnostics } = externs_1.generateExterns(typeChecker, sourceFile, host, host.moduleResolutionHost, tsOptions);
                if (output) {
                    externs[sourceFile.fileName] = output;
                }
                if (diagnostics) {
                    tsickleDiagnostics.push(...diagnostics);
                }
            }
        }
        // All diagnostics (including warnings) are treated as errors.
        // If the host decides to ignore warnings, just discard them.
        // Warnings include stuff like "don't use @type in your jsdoc"; tsickle
        // warns and then fixes up the code to be Closure-compatible anyway.
        tsickleDiagnostics = tsickleDiagnostics.filter(d => d.category === ts.DiagnosticCategory.Error ||
            !host.shouldIgnoreWarningsForPath(d.file.fileName));
        return {
            modulesManifest,
            emitSkipped,
            emittedFiles: emittedFiles || [],
            diagnostics: [...tsDiagnostics, ...tsickleDiagnostics],
            externs
        };
    }
    exports.emitWithTsickle = emitWithTsickle;
    /** Compares two strings and returns a number suitable for use in sort(). */
    function stringCompare(a, b) {
        if (a < b)
            return -1;
        if (a > b)
            return 1;
        return 0;
    }
    /**
     * A tsickle produced declaration file might be consumed be referenced by Clutz
     * produced .d.ts files, which use symbol names based on Closure's internal
     * naming conventions, so we need to provide aliases for all the exported symbols
     * in the Clutz naming convention.
     */
    function addClutzAliases(dtsFileContent, sourceFile, typeChecker, host) {
        const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
        const moduleExports = moduleSymbol && typeChecker.getExportsOfModule(moduleSymbol);
        if (!moduleExports)
            return dtsFileContent;
        // .d.ts files can be transformed, too, so we need to compare the original node below.
        const origSourceFile = ts.getOriginalNode(sourceFile);
        // In order to write aliases, the exported symbols need to be available in the
        // the module scope. That is not always the case:
        //
        // export
        // 1) export const X;           // works
        //
        // reexport
        // 2) export {X} from './foo';  // doesn't
        //
        // imported reexport
        // 3) import {X} from './foo';  // works
        //    export {X} from './foo';
        //
        // getExportsOfModule returns all three types, but we need to separate 2).
        // For now we 'fix' 2) by simply not emitting a clutz alias, since clutz
        // interop is used in minority of scenarios.
        //
        // TODO(radokirov): attempt to add appropriate imports for 2) so that
        // currently finding out local appears even harder than fixing exports.
        const localExports = moduleExports.filter(e => {
            // If there are no declarations, be conservative and don't emit the aliases.
            // I don't know how can this happen, we have no tests that excercise it.
            if (!e.declarations)
                return false;
            // Skip default exports, they are not currently supported.
            // default is a keyword in typescript, so the name of the export being
            // default means that it's a default export.
            if (e.name === 'default')
                return false;
            // Use the declaration location to determine separate cases above.
            for (const d of e.declarations) {
                // This is a special case for export *. Technically, it is outside the
                // three cases outlined, but at this point we have rewritten it to a
                // reexport or an imported reexport. However, it appears that the
                // rewriting also has made it behave different from explicit named export
                // in the sense that the declaration appears to point at the original
                // location not the reexport location.  Since we can't figure out whether
                // there is a local import here, we err on the side of less emit.
                if (d.getSourceFile() !== origSourceFile) {
                    return false;
                }
                if (!ts.isExportSpecifier(d)) {
                    // we have a pure export (case 1) thus safe to emit clutz alias.
                    return true;
                }
                // The declaration d is useless to separate reexport and import-reexport
                // because they both point to the reexporting file and not to the original
                // one.  However, there is another ts API that can do a deeper resolution.
                const localSymbol = typeChecker.getExportSpecifierLocalTargetSymbol(d);
                // I don't know how can this happen, but err on the side of less emit.
                if (!localSymbol)
                    return false;
                // `declarations` is undefined for builtin symbols, such as `unknown`.
                if (!localSymbol.declarations)
                    return false;
                // In case of no import we ended up in a declaration in foo.ts, while in
                // case of having an import localD is still in the reexporing file.
                for (const localD of localSymbol.declarations) {
                    if (localD.getSourceFile() !== origSourceFile) {
                        return false;
                    }
                }
            }
            return true;
        });
        if (!localExports.length)
            return dtsFileContent;
        // TypeScript 2.8 and TypeScript 2.9 differ on the order in which the
        // module symbols come out, so sort here to make the tests stable.
        localExports.sort((a, b) => stringCompare(a.name, b.name));
        const moduleName = host.pathToModuleName('', sourceFile.fileName);
        const clutzModuleName = moduleName.replace(/\./g, '$');
        // Clutz might refer to the name in two different forms (stemming from goog.provide and
        // goog.module respectively).
        // 1) global in clutz:   ಠ_ಠ.clutz.module$contents$path$to$module_Symbol...
        // 2) local in a module: ಠ_ಠ.clutz.module$exports$path$to$module.Symbol ..
        // See examples at:
        // https://github.com/angular/clutz/tree/master/src/test/java/com/google/javascript/clutz
        // Case (1) from above.
        let globalSymbols = '';
        // Case (2) from above.
        let nestedSymbols = '';
        for (const symbol of localExports) {
            let localName = symbol.name;
            const declaration = symbol.declarations.find(d => d.getSourceFile() === origSourceFile);
            if (declaration && ts.isExportSpecifier(declaration) && declaration.propertyName) {
                // If declared in an "export {X as Y};" export specifier, then X (stored in propertyName) is
                // the local name that resolves within the module, whereas Y is only available on the exports,
                // i.e. the name used to address the symbol from outside the module.
                // Use the localName for the export then, but publish under the external name.
                localName = declaration.propertyName.text;
            }
            globalSymbols +=
                `\t\texport {${localName} as module$contents$${clutzModuleName}_${symbol.name}}\n`;
            nestedSymbols +=
                `\t\texport {module$contents$${clutzModuleName}_${symbol.name} as ${symbol.name}}\n`;
        }
        dtsFileContent += 'declare global {\n';
        dtsFileContent += `\tnamespace ಠ_ಠ.clutz {\n`;
        dtsFileContent += globalSymbols;
        dtsFileContent += `\t}\n`;
        dtsFileContent += `\tnamespace ಠ_ಠ.clutz.module$exports$${clutzModuleName} {\n`;
        dtsFileContent += nestedSymbols;
        dtsFileContent += `\t}\n`;
        dtsFileContent += '}\n';
        return dtsFileContent;
    }
    function skipTransformForSourceFileIfNeeded(host, delegateFactory) {
        return (context) => {
            const delegate = delegateFactory(context);
            return (sourceFile) => {
                if (host.shouldSkipTsickleProcessing(sourceFile.fileName)) {
                    return sourceFile;
                }
                return delegate(sourceFile);
            };
        };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHNpY2tsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy90c2lja2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBRUgsaUNBQWlDO0lBR2pDLHlEQUE2QztJQUM3QyxpR0FBZ0Y7SUFDaEYsbUVBQW1EO0lBQ25ELGlEQUEwQztJQUMxQyxtR0FBdUY7SUFDdkYscURBQTJDO0lBQzNDLHFFQUEyRTtJQUMzRSxtRUFBbUQ7SUFDbkQsbUVBQWlEO0lBRWpELHVDQUF1QztJQUN2QywrQ0FBOEM7SUFBdEMsd0NBQUEsbUJBQW1CLENBQUE7SUFDM0IsaUVBQTREO0lBQTNDLDZDQUFBLGVBQWUsQ0FBQTtJQThCaEMsU0FBZ0IsZ0JBQWdCLENBQUMsV0FBeUI7UUFDeEQsTUFBTSxXQUFXLEdBQW9CLEVBQUUsQ0FBQztRQUN4QyxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDdkIsTUFBTSxZQUFZLEdBQWEsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sT0FBTyxHQUFpQyxFQUFFLENBQUM7UUFDakQsTUFBTSxlQUFlLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7UUFDOUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxXQUFXLEVBQUU7WUFDNUIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNwQyxXQUFXLEdBQUcsV0FBVyxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUM7WUFDNUMsSUFBSSxFQUFFLENBQUMsWUFBWSxFQUFFO2dCQUNuQixZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQ3ZDO1lBQ0QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ25DLGVBQWUsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ2pE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QUksT0FBTyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUM7U0FDMUY7UUFFRCxjQUFjLElBQUksb0JBQW9CLENBQUM7UUFDdkMsY0FBYyxJQUFJLDJCQUEyQixDQUFDO1FBQzlDLGNBQWMsSUFBSSxhQUFhLENBQUM7UUFDaEMsY0FBYyxJQUFJLE9BQU8sQ0FBQztRQUMxQixjQUFjLElBQUksd0NBQXdDLGVBQWUsTUFBTSxDQUFDO1FBQ2hGLGNBQWMsSUFBSSxhQUFhLENBQUM7UUFDaEMsY0FBYyxJQUFJLE9BQU8sQ0FBQztRQUMxQixjQUFjLElBQUksS0FBSyxDQUFDO1FBRXhCLE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxTQUFTLGtDQUFrQyxDQUN2QyxJQUFpQixFQUNqQixlQUFxRDtRQUN2RCxPQUFPLENBQUMsT0FBaUMsRUFBRSxFQUFFO1lBQzNDLE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMxQyxPQUFPLENBQUMsVUFBeUIsRUFBRSxFQUFFO2dCQUNuQyxJQUFJLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7b0JBQ3pELE9BQU8sVUFBVSxDQUFDO2lCQUNuQjtnQkFDRCxPQUFPLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5QixDQUFDLENBQUM7UUFDSixDQUFDLENBQUM7SUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtBbm5vdGF0b3JIb3N0fSBmcm9tICcuL2Fubm90YXRvcl9ob3N0JztcbmltcG9ydCB7YXNzZXJ0QWJzb2x1dGV9IGZyb20gJy4vY2xpX3N1cHBvcnQnO1xuaW1wb3J0IHtkZWNvcmF0b3JEb3dubGV2ZWxUcmFuc2Zvcm1lcn0gZnJvbSAnLi9kZWNvcmF0b3JfZG93bmxldmVsX3RyYW5zZm9ybWVyJztcbmltcG9ydCB7ZW51bVRyYW5zZm9ybWVyfSBmcm9tICcuL2VudW1fdHJhbnNmb3JtZXInO1xuaW1wb3J0IHtnZW5lcmF0ZUV4dGVybnN9IGZyb20gJy4vZXh0ZXJucyc7XG5pbXBvcnQge3RyYW5zZm9ybUZpbGVvdmVydmlld0NvbW1lbnRGYWN0b3J5fSBmcm9tICcuL2ZpbGVvdmVydmlld19jb21tZW50X3RyYW5zZm9ybWVyJztcbmltcG9ydCAqIGFzIGdvb2dtb2R1bGUgZnJvbSAnLi9nb29nbW9kdWxlJztcbmltcG9ydCB7anNkb2NUcmFuc2Zvcm1lciwgcmVtb3ZlVHlwZUFzc2VydGlvbnN9IGZyb20gJy4vanNkb2NfdHJhbnNmb3JtZXInO1xuaW1wb3J0IHtNb2R1bGVzTWFuaWZlc3R9IGZyb20gJy4vbW9kdWxlc19tYW5pZmVzdCc7XG5pbXBvcnQge2lzRHRzRmlsZU5hbWV9IGZyb20gJy4vdHJhbnNmb3JtZXJfdXRpbCc7XG5cbi8vIFJldGFpbmVkIGhlcmUgZm9yIEFQSSBjb21wYXRpYmlsaXR5LlxuZXhwb3J0IHtnZXRHZW5lcmF0ZWRFeHRlcm5zfSBmcm9tICcuL2V4dGVybnMnO1xuZXhwb3J0IHtGaWxlTWFwLCBNb2R1bGVzTWFuaWZlc3R9IGZyb20gJy4vbW9kdWxlc19tYW5pZmVzdCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHNpY2tsZUhvc3QgZXh0ZW5kcyBnb29nbW9kdWxlLkdvb2dNb2R1bGVQcm9jZXNzb3JIb3N0LCBBbm5vdGF0b3JIb3N0IHtcbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZG93bmxldmVsIGRlY29yYXRvcnNcbiAgICovXG4gIHRyYW5zZm9ybURlY29yYXRvcnM/OiBib29sZWFuO1xuICAvKipcbiAgICogV2hldGhlciB0byBjb252ZXJzIHR5cGVzIHRvIGNsb3N1cmVcbiAgICovXG4gIHRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gYWRkIGFsaWFzZXMgdG8gdGhlIC5kLnRzIGZpbGVzIHRvIGFkZCB0aGUgZXhwb3J0cyB0byB0aGVcbiAgICog4LKgX+CyoC5jbHV0eiBuYW1lc3BhY2UuXG4gICAqL1xuICBhZGREdHNDbHV0ekFsaWFzZXM/OiBib29sZWFuO1xuICAvKipcbiAgICogSWYgdHJ1ZSwgdHNpY2tsZSBhbmQgZGVjb3JhdG9yIGRvd25sZXZlbCBwcm9jZXNzaW5nIHdpbGwgYmUgc2tpcHBlZCBmb3JcbiAgICogdGhhdCBmaWxlLlxuICAgKi9cbiAgc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nKGZpbGVOYW1lOiBzdHJpbmcpOiBib29sZWFuO1xuICAvKipcbiAgICogVHNpY2tsZSB0cmVhdHMgd2FybmluZ3MgYXMgZXJyb3JzLCBpZiB0cnVlLCBpZ25vcmUgd2FybmluZ3MuICBUaGlzIG1pZ2h0IGJlXG4gICAqIHVzZWZ1bCBmb3IgZS5nLiB0aGlyZCBwYXJ0eSBjb2RlLlxuICAgKi9cbiAgc2hvdWxkSWdub3JlV2FybmluZ3NGb3JQYXRoKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuO1xuICAvKiogV2hldGhlciB0byBjb252ZXJ0IENvbW1vbkpTIHJlcXVpcmUoKSBpbXBvcnRzIHRvIGdvb2cubW9kdWxlKCkgYW5kIGdvb2cucmVxdWlyZSgpIGNhbGxzLiAqL1xuICBnb29nbW9kdWxlOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VFbWl0UmVzdWx0cyhlbWl0UmVzdWx0czogRW1pdFJlc3VsdFtdKTogRW1pdFJlc3VsdCB7XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgbGV0IGVtaXRTa2lwcGVkID0gdHJ1ZTtcbiAgY29uc3QgZW1pdHRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBleHRlcm5zOiB7W2ZpbGVOYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IG1vZHVsZXNNYW5pZmVzdCA9IG5ldyBNb2R1bGVzTWFuaWZlc3QoKTtcbiAgZm9yIChjb25zdCBlciBvZiBlbWl0UmVzdWx0cykge1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4uZXIuZGlhZ25vc3RpY3MpO1xuICAgIGVtaXRTa2lwcGVkID0gZW1pdFNraXBwZWQgfHwgZXIuZW1pdFNraXBwZWQ7XG4gICAgaWYgKGVyLmVtaXR0ZWRGaWxlcykge1xuICAgICAgZW1pdHRlZEZpbGVzLnB1c2goLi4uZXIuZW1pdHRlZEZpbGVzKTtcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihleHRlcm5zLCBlci5leHRlcm5zKTtcbiAgICBtb2R1bGVzTWFuaWZlc3QuYWRkTWFuaWZlc3QoZXIubW9kdWxlc01hbmlmZXN0KTtcbiAgfVxuICByZXR1cm4ge2RpYWdub3N0aWNzLCBlbWl0U2tpcHBlZCwgZW1pdHRlZEZpbGVzLCBleHRlcm5zLCBtb2R1bGVzTWFuaWZlc3R9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXRSZXN1bHQgZXh0ZW5kcyB0cy5FbWl0UmVzdWx0IHtcbiAgLy8gVGhlIG1hbmlmZXN0IG9mIEpTIG1vZHVsZXMgb3V0cHV0IGJ5IHRoZSBjb21waWxlci5cbiAgbW9kdWxlc01hbmlmZXN0OiBNb2R1bGVzTWFuaWZlc3Q7XG4gIC8qKlxuICAgKiBleHRlcm5zLmpzIGZpbGVzIHByb2R1Y2VkIGJ5IHRzaWNrbGUsIGlmIGFueS4gbW9kdWxlIElEcyBhcmUgcmVsYXRpdmUgcGF0aHMgZnJvbVxuICAgKiBmaWxlTmFtZVRvTW9kdWxlSWQuXG4gICAqL1xuICBleHRlcm5zOiB7W21vZHVsZUlkOiBzdHJpbmddOiBzdHJpbmd9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXRUcmFuc2Zvcm1lcnMge1xuICAvKiogQ3VzdG9tIHRyYW5zZm9ybWVycyB0byBldmFsdWF0ZSBiZWZvcmUgVHNpY2tsZSAuanMgdHJhbnNmb3JtYXRpb25zLiAqL1xuICBiZWZvcmVUc2lja2xlPzogQXJyYXk8dHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+PjtcbiAgLyoqIEN1c3RvbSB0cmFuc2Zvcm1lcnMgdG8gZXZhbHVhdGUgYmVmb3JlIGJ1aWx0LWluIC5qcyB0cmFuc2Zvcm1hdGlvbnMuICovXG4gIGJlZm9yZVRzPzogQXJyYXk8dHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+PjtcbiAgLyoqIEN1c3RvbSB0cmFuc2Zvcm1lcnMgdG8gZXZhbHVhdGUgYWZ0ZXIgYnVpbHQtaW4gLmpzIHRyYW5zZm9ybWF0aW9ucy4gKi9cbiAgYWZ0ZXJUcz86IEFycmF5PHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPj47XG4gIC8qKiBDdXN0b20gdHJhbnNmb3JtZXJzIHRvIGV2YWx1YXRlIGFmdGVyIGJ1aWx0LWluIC5kLnRzIHRyYW5zZm9ybWF0aW9ucy4gKi9cbiAgYWZ0ZXJEZWNsYXJhdGlvbnM/OiBBcnJheTx0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuQnVuZGxlfHRzLlNvdXJjZUZpbGU+Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVtaXRXaXRoVHNpY2tsZShcbiAgICBwcm9ncmFtOiB0cy5Qcm9ncmFtLCBob3N0OiBUc2lja2xlSG9zdCwgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsIHRzT3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zLFxuICAgIHRhcmdldFNvdXJjZUZpbGU/OiB0cy5Tb3VyY2VGaWxlLCB3cml0ZUZpbGU/OiB0cy5Xcml0ZUZpbGVDYWxsYmFjayxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbj86IHRzLkNhbmNlbGxhdGlvblRva2VuLCBlbWl0T25seUR0c0ZpbGVzPzogYm9vbGVhbixcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnM6IEVtaXRUcmFuc2Zvcm1lcnMgPSB7fSk6IEVtaXRSZXN1bHQge1xuICBmb3IgKGNvbnN0IHNmIG9mIHByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgIGFzc2VydEFic29sdXRlKHNmLmZpbGVOYW1lKTtcbiAgfVxuXG4gIGxldCB0c2lja2xlRGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuICBjb25zdCB0eXBlQ2hlY2tlciA9IHByb2dyYW0uZ2V0VHlwZUNoZWNrZXIoKTtcbiAgY29uc3QgdHNpY2tsZVNvdXJjZVRyYW5zZm9ybWVyczogQXJyYXk8dHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+PiA9IFtdO1xuICBpZiAoaG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSkge1xuICAgIC8vIE9ubHkgYWRkIEBzdXBwcmVzcyB7Y2hlY2tUeXBlc30gY29tbWVudHMgd2hlbiBhbHNvIGFkZGluZyB0eXBlIGFubm90YXRpb25zLlxuICAgIHRzaWNrbGVTb3VyY2VUcmFuc2Zvcm1lcnMucHVzaCh0cmFuc2Zvcm1GaWxlb3ZlcnZpZXdDb21tZW50RmFjdG9yeSh0c2lja2xlRGlhZ25vc3RpY3MpKTtcbiAgICB0c2lja2xlU291cmNlVHJhbnNmb3JtZXJzLnB1c2goXG4gICAgICAgIGpzZG9jVHJhbnNmb3JtZXIoaG9zdCwgdHNPcHRpb25zLCB0c0hvc3QsIHR5cGVDaGVja2VyLCB0c2lja2xlRGlhZ25vc3RpY3MpKTtcbiAgICB0c2lja2xlU291cmNlVHJhbnNmb3JtZXJzLnB1c2goZW51bVRyYW5zZm9ybWVyKHR5cGVDaGVja2VyLCB0c2lja2xlRGlhZ25vc3RpY3MpKTtcbiAgICB0c2lja2xlU291cmNlVHJhbnNmb3JtZXJzLnB1c2goZGVjb3JhdG9yRG93bmxldmVsVHJhbnNmb3JtZXIodHlwZUNoZWNrZXIsIHRzaWNrbGVEaWFnbm9zdGljcykpO1xuICB9IGVsc2UgaWYgKGhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycykge1xuICAgIHRzaWNrbGVTb3VyY2VUcmFuc2Zvcm1lcnMucHVzaChkZWNvcmF0b3JEb3dubGV2ZWxUcmFuc2Zvcm1lcih0eXBlQ2hlY2tlciwgdHNpY2tsZURpYWdub3N0aWNzKSk7XG4gIH1cbiAgY29uc3QgbW9kdWxlc01hbmlmZXN0ID0gbmV3IE1vZHVsZXNNYW5pZmVzdCgpO1xuICBjb25zdCB0c2lja2xlVHJhbnNmb3JtZXJzOiB0cy5DdXN0b21UcmFuc2Zvcm1lcnMgPSB7YmVmb3JlOiB0c2lja2xlU291cmNlVHJhbnNmb3JtZXJzfTtcbiAgY29uc3QgdHNUcmFuc2Zvcm1lcnM6IHRzLkN1c3RvbVRyYW5zZm9ybWVycyA9IHtcbiAgICBiZWZvcmU6IFtcbiAgICAgIC4uLihjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlVHNpY2tsZSB8fCBbXSksXG4gICAgICAuLi4odHNpY2tsZVRyYW5zZm9ybWVycy5iZWZvcmUgfHwgW10pLm1hcCh0ZiA9PiBza2lwVHJhbnNmb3JtRm9yU291cmNlRmlsZUlmTmVlZGVkKGhvc3QsIHRmKSksXG4gICAgICAuLi4oY3VzdG9tVHJhbnNmb3JtZXJzLmJlZm9yZVRzIHx8IFtdKSxcbiAgICBdLFxuICAgIGFmdGVyOiBbXG4gICAgICAuLi4oY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyVHMgfHwgW10pLFxuICAgICAgLi4uKHRzaWNrbGVUcmFuc2Zvcm1lcnMuYWZ0ZXIgfHwgW10pLm1hcCh0ZiA9PiBza2lwVHJhbnNmb3JtRm9yU291cmNlRmlsZUlmTmVlZGVkKGhvc3QsIHRmKSksXG4gICAgXSxcbiAgICBhZnRlckRlY2xhcmF0aW9uczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyRGVjbGFyYXRpb25zLFxuICB9O1xuICBpZiAoaG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSkge1xuICAgIC8vIFNlZSBjb21tZW50IG9uIHJlbW90ZVR5cGVBc3NlcnRpb25zLlxuICAgIHRzVHJhbnNmb3JtZXJzLmJlZm9yZSEucHVzaChyZW1vdmVUeXBlQXNzZXJ0aW9ucygpKTtcbiAgfVxuICBpZiAoaG9zdC5nb29nbW9kdWxlKSB7XG4gICAgdHNUcmFuc2Zvcm1lcnMuYWZ0ZXIhLnB1c2goZ29vZ21vZHVsZS5jb21tb25Kc1RvR29vZ21vZHVsZVRyYW5zZm9ybWVyKFxuICAgICAgICBob3N0LCBtb2R1bGVzTWFuaWZlc3QsIHR5cGVDaGVja2VyLCB0c2lja2xlRGlhZ25vc3RpY3MpKTtcbiAgfVxuXG4gIGNvbnN0IHdyaXRlRmlsZURlbGVnYXRlOiB0cy5Xcml0ZUZpbGVDYWxsYmFjayA9IHdyaXRlRmlsZSB8fCB0c0hvc3Qud3JpdGVGaWxlLmJpbmQodHNIb3N0KTtcbiAgY29uc3Qgd3JpdGVGaWxlSW1wbDogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPVxuICAgICAgKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICAgIGFzc2VydEFic29sdXRlKGZpbGVOYW1lKTtcbiAgICAgICAgaWYgKGhvc3QuYWRkRHRzQ2x1dHpBbGlhc2VzICYmIGlzRHRzRmlsZU5hbWUoZmlsZU5hbWUpICYmIHNvdXJjZUZpbGVzKSB7XG4gICAgICAgICAgLy8gT25seSBidW5kbGUgZW1pdHMgcGFzcyBtb3JlIHRoYW4gb25lIHNvdXJjZSBmaWxlIGZvciAuZC50cyB3cml0ZXMuIEJ1bmRsZSBlbWl0cyBob3dldmVyXG4gICAgICAgICAgLy8gYXJlIG5vdCBzdXBwb3J0ZWQgYnkgdHNpY2tsZSwgYXMgd2UgY2Fubm90IGFubm90YXRlIHRoZW0gZm9yIENsb3N1cmUgaW4gYW55IG1lYW5pbmdmdWxcbiAgICAgICAgICAvLyB3YXkgYW55d2F5LlxuICAgICAgICAgIGlmICghc291cmNlRmlsZXMgfHwgc291cmNlRmlsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBleHBlY3RlZCBleGFjdGx5IG9uZSBzb3VyY2UgZmlsZSBmb3IgLmQudHMgZW1pdCwgZ290ICR7XG4gICAgICAgICAgICAgICAgc291cmNlRmlsZXMubWFwKHNmID0+IHNmLmZpbGVOYW1lKX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2UgPSBzb3VyY2VGaWxlc1swXTtcbiAgICAgICAgICBjb250ZW50ID0gYWRkQ2x1dHpBbGlhc2VzKGNvbnRlbnQsIG9yaWdpbmFsU291cmNlLCB0eXBlQ2hlY2tlciwgaG9zdCk7XG4gICAgICAgIH1cbiAgICAgICAgd3JpdGVGaWxlRGVsZWdhdGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgfTtcblxuICBjb25zdCB7ZGlhZ25vc3RpY3M6IHRzRGlhZ25vc3RpY3MsIGVtaXRTa2lwcGVkLCBlbWl0dGVkRmlsZXN9ID0gcHJvZ3JhbS5lbWl0KFxuICAgICAgdGFyZ2V0U291cmNlRmlsZSwgd3JpdGVGaWxlSW1wbCwgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHRzVHJhbnNmb3JtZXJzKTtcblxuICBjb25zdCBleHRlcm5zOiB7W2ZpbGVOYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGlmIChob3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlKSB7XG4gICAgY29uc3Qgc291cmNlRmlsZXMgPSB0YXJnZXRTb3VyY2VGaWxlID8gW3RhcmdldFNvdXJjZUZpbGVdIDogcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpO1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBzb3VyY2VGaWxlcykge1xuICAgICAgY29uc3QgaXNEdHMgPSBpc0R0c0ZpbGVOYW1lKHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICAgICAgaWYgKGlzRHRzICYmIGhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nKHNvdXJjZUZpbGUuZmlsZU5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3Qge291dHB1dCwgZGlhZ25vc3RpY3N9ID1cbiAgICAgICAgICBnZW5lcmF0ZUV4dGVybnModHlwZUNoZWNrZXIsIHNvdXJjZUZpbGUsIGhvc3QsIGhvc3QubW9kdWxlUmVzb2x1dGlvbkhvc3QsIHRzT3B0aW9ucyk7XG4gICAgICBpZiAob3V0cHV0KSB7XG4gICAgICAgIGV4dGVybnNbc291cmNlRmlsZS5maWxlTmFtZV0gPSBvdXRwdXQ7XG4gICAgICB9XG4gICAgICBpZiAoZGlhZ25vc3RpY3MpIHtcbiAgICAgICAgdHNpY2tsZURpYWdub3N0aWNzLnB1c2goLi4uZGlhZ25vc3RpY3MpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBBbGwgZGlhZ25vc3RpY3MgKGluY2x1ZGluZyB3YXJuaW5ncykgYXJlIHRyZWF0ZWQgYXMgZXJyb3JzLlxuICAvLyBJZiB0aGUgaG9zdCBkZWNpZGVzIHRvIGlnbm9yZSB3YXJuaW5ncywganVzdCBkaXNjYXJkIHRoZW0uXG4gIC8vIFdhcm5pbmdzIGluY2x1ZGUgc3R1ZmYgbGlrZSBcImRvbid0IHVzZSBAdHlwZSBpbiB5b3VyIGpzZG9jXCI7IHRzaWNrbGVcbiAgLy8gd2FybnMgYW5kIHRoZW4gZml4ZXMgdXAgdGhlIGNvZGUgdG8gYmUgQ2xvc3VyZS1jb21wYXRpYmxlIGFueXdheS5cbiAgdHNpY2tsZURpYWdub3N0aWNzID0gdHNpY2tsZURpYWdub3N0aWNzLmZpbHRlcihcbiAgICAgIGQgPT4gZC5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yIHx8XG4gICAgICAgICAgIWhvc3Quc2hvdWxkSWdub3JlV2FybmluZ3NGb3JQYXRoKGQuZmlsZSEuZmlsZU5hbWUpKTtcblxuICByZXR1cm4ge1xuICAgIG1vZHVsZXNNYW5pZmVzdCxcbiAgICBlbWl0U2tpcHBlZCxcbiAgICBlbWl0dGVkRmlsZXM6IGVtaXR0ZWRGaWxlcyB8fCBbXSxcbiAgICBkaWFnbm9zdGljczogWy4uLnRzRGlhZ25vc3RpY3MsIC4uLnRzaWNrbGVEaWFnbm9zdGljc10sXG4gICAgZXh0ZXJuc1xuICB9O1xufVxuXG4vKiogQ29tcGFyZXMgdHdvIHN0cmluZ3MgYW5kIHJldHVybnMgYSBudW1iZXIgc3VpdGFibGUgZm9yIHVzZSBpbiBzb3J0KCkuICovXG5mdW5jdGlvbiBzdHJpbmdDb21wYXJlKGE6IHN0cmluZywgYjogc3RyaW5nKTogbnVtYmVyIHtcbiAgaWYgKGEgPCBiKSByZXR1cm4gLTE7XG4gIGlmIChhID4gYikgcmV0dXJuIDE7XG4gIHJldHVybiAwO1xufVxuXG4vKipcbiAqIEEgdHNpY2tsZSBwcm9kdWNlZCBkZWNsYXJhdGlvbiBmaWxlIG1pZ2h0IGJlIGNvbnN1bWVkIGJlIHJlZmVyZW5jZWQgYnkgQ2x1dHpcbiAqIHByb2R1Y2VkIC5kLnRzIGZpbGVzLCB3aGljaCB1c2Ugc3ltYm9sIG5hbWVzIGJhc2VkIG9uIENsb3N1cmUncyBpbnRlcm5hbFxuICogbmFtaW5nIGNvbnZlbnRpb25zLCBzbyB3ZSBuZWVkIHRvIHByb3ZpZGUgYWxpYXNlcyBmb3IgYWxsIHRoZSBleHBvcnRlZCBzeW1ib2xzXG4gKiBpbiB0aGUgQ2x1dHogbmFtaW5nIGNvbnZlbnRpb24uXG4gKi9cbmZ1bmN0aW9uIGFkZENsdXR6QWxpYXNlcyhcbiAgICBkdHNGaWxlQ29udGVudDogc3RyaW5nLCBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlLCB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsXG4gICAgaG9zdDogVHNpY2tsZUhvc3QpOiBzdHJpbmcge1xuICBjb25zdCBtb2R1bGVTeW1ib2wgPSB0eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHNvdXJjZUZpbGUpO1xuICBjb25zdCBtb2R1bGVFeHBvcnRzID0gbW9kdWxlU3ltYm9sICYmIHR5cGVDaGVja2VyLmdldEV4cG9ydHNPZk1vZHVsZShtb2R1bGVTeW1ib2wpO1xuICBpZiAoIW1vZHVsZUV4cG9ydHMpIHJldHVybiBkdHNGaWxlQ29udGVudDtcblxuICAvLyAuZC50cyBmaWxlcyBjYW4gYmUgdHJhbnNmb3JtZWQsIHRvbywgc28gd2UgbmVlZCB0byBjb21wYXJlIHRoZSBvcmlnaW5hbCBub2RlIGJlbG93LlxuICBjb25zdCBvcmlnU291cmNlRmlsZSA9IHRzLmdldE9yaWdpbmFsTm9kZShzb3VyY2VGaWxlKTtcbiAgLy8gSW4gb3JkZXIgdG8gd3JpdGUgYWxpYXNlcywgdGhlIGV4cG9ydGVkIHN5bWJvbHMgbmVlZCB0byBiZSBhdmFpbGFibGUgaW4gdGhlXG4gIC8vIHRoZSBtb2R1bGUgc2NvcGUuIFRoYXQgaXMgbm90IGFsd2F5cyB0aGUgY2FzZTpcbiAgLy9cbiAgLy8gZXhwb3J0XG4gIC8vIDEpIGV4cG9ydCBjb25zdCBYOyAgICAgICAgICAgLy8gd29ya3NcbiAgLy9cbiAgLy8gcmVleHBvcnRcbiAgLy8gMikgZXhwb3J0IHtYfSBmcm9tICcuL2Zvbyc7ICAvLyBkb2Vzbid0XG4gIC8vXG4gIC8vIGltcG9ydGVkIHJlZXhwb3J0XG4gIC8vIDMpIGltcG9ydCB7WH0gZnJvbSAnLi9mb28nOyAgLy8gd29ya3NcbiAgLy8gICAgZXhwb3J0IHtYfSBmcm9tICcuL2Zvbyc7XG4gIC8vXG4gIC8vIGdldEV4cG9ydHNPZk1vZHVsZSByZXR1cm5zIGFsbCB0aHJlZSB0eXBlcywgYnV0IHdlIG5lZWQgdG8gc2VwYXJhdGUgMikuXG4gIC8vIEZvciBub3cgd2UgJ2ZpeCcgMikgYnkgc2ltcGx5IG5vdCBlbWl0dGluZyBhIGNsdXR6IGFsaWFzLCBzaW5jZSBjbHV0elxuICAvLyBpbnRlcm9wIGlzIHVzZWQgaW4gbWlub3JpdHkgb2Ygc2NlbmFyaW9zLlxuICAvL1xuICAvLyBUT0RPKHJhZG9raXJvdik6IGF0dGVtcHQgdG8gYWRkIGFwcHJvcHJpYXRlIGltcG9ydHMgZm9yIDIpIHNvIHRoYXRcbiAgLy8gY3VycmVudGx5IGZpbmRpbmcgb3V0IGxvY2FsIGFwcGVhcnMgZXZlbiBoYXJkZXIgdGhhbiBmaXhpbmcgZXhwb3J0cy5cbiAgY29uc3QgbG9jYWxFeHBvcnRzID0gbW9kdWxlRXhwb3J0cy5maWx0ZXIoZSA9PiB7XG4gICAgLy8gSWYgdGhlcmUgYXJlIG5vIGRlY2xhcmF0aW9ucywgYmUgY29uc2VydmF0aXZlIGFuZCBkb24ndCBlbWl0IHRoZSBhbGlhc2VzLlxuICAgIC8vIEkgZG9uJ3Qga25vdyBob3cgY2FuIHRoaXMgaGFwcGVuLCB3ZSBoYXZlIG5vIHRlc3RzIHRoYXQgZXhjZXJjaXNlIGl0LlxuICAgIGlmICghZS5kZWNsYXJhdGlvbnMpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFNraXAgZGVmYXVsdCBleHBvcnRzLCB0aGV5IGFyZSBub3QgY3VycmVudGx5IHN1cHBvcnRlZC5cbiAgICAvLyBkZWZhdWx0IGlzIGEga2V5d29yZCBpbiB0eXBlc2NyaXB0LCBzbyB0aGUgbmFtZSBvZiB0aGUgZXhwb3J0IGJlaW5nXG4gICAgLy8gZGVmYXVsdCBtZWFucyB0aGF0IGl0J3MgYSBkZWZhdWx0IGV4cG9ydC5cbiAgICBpZiAoZS5uYW1lID09PSAnZGVmYXVsdCcpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFVzZSB0aGUgZGVjbGFyYXRpb24gbG9jYXRpb24gdG8gZGV0ZXJtaW5lIHNlcGFyYXRlIGNhc2VzIGFib3ZlLlxuICAgIGZvciAoY29uc3QgZCBvZiBlLmRlY2xhcmF0aW9ucykge1xuICAgICAgLy8gVGhpcyBpcyBhIHNwZWNpYWwgY2FzZSBmb3IgZXhwb3J0ICouIFRlY2huaWNhbGx5LCBpdCBpcyBvdXRzaWRlIHRoZVxuICAgICAgLy8gdGhyZWUgY2FzZXMgb3V0bGluZWQsIGJ1dCBhdCB0aGlzIHBvaW50IHdlIGhhdmUgcmV3cml0dGVuIGl0IHRvIGFcbiAgICAgIC8vIHJlZXhwb3J0IG9yIGFuIGltcG9ydGVkIHJlZXhwb3J0LiBIb3dldmVyLCBpdCBhcHBlYXJzIHRoYXQgdGhlXG4gICAgICAvLyByZXdyaXRpbmcgYWxzbyBoYXMgbWFkZSBpdCBiZWhhdmUgZGlmZmVyZW50IGZyb20gZXhwbGljaXQgbmFtZWQgZXhwb3J0XG4gICAgICAvLyBpbiB0aGUgc2Vuc2UgdGhhdCB0aGUgZGVjbGFyYXRpb24gYXBwZWFycyB0byBwb2ludCBhdCB0aGUgb3JpZ2luYWxcbiAgICAgIC8vIGxvY2F0aW9uIG5vdCB0aGUgcmVleHBvcnQgbG9jYXRpb24uICBTaW5jZSB3ZSBjYW4ndCBmaWd1cmUgb3V0IHdoZXRoZXJcbiAgICAgIC8vIHRoZXJlIGlzIGEgbG9jYWwgaW1wb3J0IGhlcmUsIHdlIGVyciBvbiB0aGUgc2lkZSBvZiBsZXNzIGVtaXQuXG4gICAgICBpZiAoZC5nZXRTb3VyY2VGaWxlKCkgIT09IG9yaWdTb3VyY2VGaWxlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0cy5pc0V4cG9ydFNwZWNpZmllcihkKSkge1xuICAgICAgICAvLyB3ZSBoYXZlIGEgcHVyZSBleHBvcnQgKGNhc2UgMSkgdGh1cyBzYWZlIHRvIGVtaXQgY2x1dHogYWxpYXMuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZGVjbGFyYXRpb24gZCBpcyB1c2VsZXNzIHRvIHNlcGFyYXRlIHJlZXhwb3J0IGFuZCBpbXBvcnQtcmVleHBvcnRcbiAgICAgIC8vIGJlY2F1c2UgdGhleSBib3RoIHBvaW50IHRvIHRoZSByZWV4cG9ydGluZyBmaWxlIGFuZCBub3QgdG8gdGhlIG9yaWdpbmFsXG4gICAgICAvLyBvbmUuICBIb3dldmVyLCB0aGVyZSBpcyBhbm90aGVyIHRzIEFQSSB0aGF0IGNhbiBkbyBhIGRlZXBlciByZXNvbHV0aW9uLlxuICAgICAgY29uc3QgbG9jYWxTeW1ib2wgPSB0eXBlQ2hlY2tlci5nZXRFeHBvcnRTcGVjaWZpZXJMb2NhbFRhcmdldFN5bWJvbChkKTtcbiAgICAgIC8vIEkgZG9uJ3Qga25vdyBob3cgY2FuIHRoaXMgaGFwcGVuLCBidXQgZXJyIG9uIHRoZSBzaWRlIG9mIGxlc3MgZW1pdC5cbiAgICAgIGlmICghbG9jYWxTeW1ib2wpIHJldHVybiBmYWxzZTtcbiAgICAgIC8vIGBkZWNsYXJhdGlvbnNgIGlzIHVuZGVmaW5lZCBmb3IgYnVpbHRpbiBzeW1ib2xzLCBzdWNoIGFzIGB1bmtub3duYC5cbiAgICAgIGlmICghbG9jYWxTeW1ib2wuZGVjbGFyYXRpb25zKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgIC8vIEluIGNhc2Ugb2Ygbm8gaW1wb3J0IHdlIGVuZGVkIHVwIGluIGEgZGVjbGFyYXRpb24gaW4gZm9vLnRzLCB3aGlsZSBpblxuICAgICAgLy8gY2FzZSBvZiBoYXZpbmcgYW4gaW1wb3J0IGxvY2FsRCBpcyBzdGlsbCBpbiB0aGUgcmVleHBvcmluZyBmaWxlLlxuICAgICAgZm9yIChjb25zdCBsb2NhbEQgb2YgbG9jYWxTeW1ib2wuZGVjbGFyYXRpb25zKSB7XG4gICAgICAgIGlmIChsb2NhbEQuZ2V0U291cmNlRmlsZSgpICE9PSBvcmlnU291cmNlRmlsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG4gIGlmICghbG9jYWxFeHBvcnRzLmxlbmd0aCkgcmV0dXJuIGR0c0ZpbGVDb250ZW50O1xuXG4gIC8vIFR5cGVTY3JpcHQgMi44IGFuZCBUeXBlU2NyaXB0IDIuOSBkaWZmZXIgb24gdGhlIG9yZGVyIGluIHdoaWNoIHRoZVxuICAvLyBtb2R1bGUgc3ltYm9scyBjb21lIG91dCwgc28gc29ydCBoZXJlIHRvIG1ha2UgdGhlIHRlc3RzIHN0YWJsZS5cbiAgbG9jYWxFeHBvcnRzLnNvcnQoKGEsIGIpID0+IHN0cmluZ0NvbXBhcmUoYS5uYW1lLCBiLm5hbWUpKTtcblxuICBjb25zdCBtb2R1bGVOYW1lID0gaG9zdC5wYXRoVG9Nb2R1bGVOYW1lKCcnLCBzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgY29uc3QgY2x1dHpNb2R1bGVOYW1lID0gbW9kdWxlTmFtZS5yZXBsYWNlKC9cXC4vZywgJyQnKTtcblxuICAvLyBDbHV0eiBtaWdodCByZWZlciB0byB0aGUgbmFtZSBpbiB0d28gZGlmZmVyZW50IGZvcm1zIChzdGVtbWluZyBmcm9tIGdvb2cucHJvdmlkZSBhbmRcbiAgLy8gZ29vZy5tb2R1bGUgcmVzcGVjdGl2ZWx5KS5cbiAgLy8gMSkgZ2xvYmFsIGluIGNsdXR6OiAgIOCyoF/gsqAuY2x1dHoubW9kdWxlJGNvbnRlbnRzJHBhdGgkdG8kbW9kdWxlX1N5bWJvbC4uLlxuICAvLyAyKSBsb2NhbCBpbiBhIG1vZHVsZTog4LKgX+CyoC5jbHV0ei5tb2R1bGUkZXhwb3J0cyRwYXRoJHRvJG1vZHVsZS5TeW1ib2wgLi5cbiAgLy8gU2VlIGV4YW1wbGVzIGF0OlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9jbHV0ei90cmVlL21hc3Rlci9zcmMvdGVzdC9qYXZhL2NvbS9nb29nbGUvamF2YXNjcmlwdC9jbHV0elxuXG4gIC8vIENhc2UgKDEpIGZyb20gYWJvdmUuXG4gIGxldCBnbG9iYWxTeW1ib2xzID0gJyc7XG4gIC8vIENhc2UgKDIpIGZyb20gYWJvdmUuXG4gIGxldCBuZXN0ZWRTeW1ib2xzID0gJyc7XG4gIGZvciAoY29uc3Qgc3ltYm9sIG9mIGxvY2FsRXhwb3J0cykge1xuICAgIGxldCBsb2NhbE5hbWUgPSBzeW1ib2wubmFtZTtcbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHN5bWJvbC5kZWNsYXJhdGlvbnMuZmluZChkID0+IGQuZ2V0U291cmNlRmlsZSgpID09PSBvcmlnU291cmNlRmlsZSk7XG4gICAgaWYgKGRlY2xhcmF0aW9uICYmIHRzLmlzRXhwb3J0U3BlY2lmaWVyKGRlY2xhcmF0aW9uKSAmJiBkZWNsYXJhdGlvbi5wcm9wZXJ0eU5hbWUpIHtcbiAgICAgIC8vIElmIGRlY2xhcmVkIGluIGFuIFwiZXhwb3J0IHtYIGFzIFl9O1wiIGV4cG9ydCBzcGVjaWZpZXIsIHRoZW4gWCAoc3RvcmVkIGluIHByb3BlcnR5TmFtZSkgaXNcbiAgICAgIC8vIHRoZSBsb2NhbCBuYW1lIHRoYXQgcmVzb2x2ZXMgd2l0aGluIHRoZSBtb2R1bGUsIHdoZXJlYXMgWSBpcyBvbmx5IGF2YWlsYWJsZSBvbiB0aGUgZXhwb3J0cyxcbiAgICAgIC8vIGkuZS4gdGhlIG5hbWUgdXNlZCB0byBhZGRyZXNzIHRoZSBzeW1ib2wgZnJvbSBvdXRzaWRlIHRoZSBtb2R1bGUuXG4gICAgICAvLyBVc2UgdGhlIGxvY2FsTmFtZSBmb3IgdGhlIGV4cG9ydCB0aGVuLCBidXQgcHVibGlzaCB1bmRlciB0aGUgZXh0ZXJuYWwgbmFtZS5cbiAgICAgIGxvY2FsTmFtZSA9IGRlY2xhcmF0aW9uLnByb3BlcnR5TmFtZS50ZXh0O1xuICAgIH1cbiAgICBnbG9iYWxTeW1ib2xzICs9XG4gICAgICAgIGBcXHRcXHRleHBvcnQgeyR7bG9jYWxOYW1lfSBhcyBtb2R1bGUkY29udGVudHMkJHtjbHV0ek1vZHVsZU5hbWV9XyR7c3ltYm9sLm5hbWV9fVxcbmA7XG4gICAgbmVzdGVkU3ltYm9scyArPVxuICAgICAgICBgXFx0XFx0ZXhwb3J0IHttb2R1bGUkY29udGVudHMkJHtjbHV0ek1vZHVsZU5hbWV9XyR7c3ltYm9sLm5hbWV9IGFzICR7c3ltYm9sLm5hbWV9fVxcbmA7XG4gIH1cblxuICBkdHNGaWxlQ29udGVudCArPSAnZGVjbGFyZSBnbG9iYWwge1xcbic7XG4gIGR0c0ZpbGVDb250ZW50ICs9IGBcXHRuYW1lc3BhY2Ug4LKgX+CyoC5jbHV0eiB7XFxuYDtcbiAgZHRzRmlsZUNvbnRlbnQgKz0gZ2xvYmFsU3ltYm9scztcbiAgZHRzRmlsZUNvbnRlbnQgKz0gYFxcdH1cXG5gO1xuICBkdHNGaWxlQ29udGVudCArPSBgXFx0bmFtZXNwYWNlIOCyoF/gsqAuY2x1dHoubW9kdWxlJGV4cG9ydHMkJHtjbHV0ek1vZHVsZU5hbWV9IHtcXG5gO1xuICBkdHNGaWxlQ29udGVudCArPSBuZXN0ZWRTeW1ib2xzO1xuICBkdHNGaWxlQ29udGVudCArPSBgXFx0fVxcbmA7XG4gIGR0c0ZpbGVDb250ZW50ICs9ICd9XFxuJztcblxuICByZXR1cm4gZHRzRmlsZUNvbnRlbnQ7XG59XG5cbmZ1bmN0aW9uIHNraXBUcmFuc2Zvcm1Gb3JTb3VyY2VGaWxlSWZOZWVkZWQoXG4gICAgaG9zdDogVHNpY2tsZUhvc3QsXG4gICAgZGVsZWdhdGVGYWN0b3J5OiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuU291cmNlRmlsZT4pOiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuU291cmNlRmlsZT4ge1xuICByZXR1cm4gKGNvbnRleHQ6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IGRlbGVnYXRlID0gZGVsZWdhdGVGYWN0b3J5KGNvbnRleHQpO1xuICAgIHJldHVybiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkgPT4ge1xuICAgICAgaWYgKGhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nKHNvdXJjZUZpbGUuZmlsZU5hbWUpKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlbGVnYXRlKHNvdXJjZUZpbGUpO1xuICAgIH07XG4gIH07XG59XG4iXX0=