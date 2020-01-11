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
        define("tsickle/src/module_type_translator", ["require", "exports", "typescript", "tsickle/src/googmodule", "tsickle/src/jsdoc", "tsickle/src/transformer_util", "tsickle/src/type_translator"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * @fileoverview module_type_translator builds on top of type_translator, adding functionality to
     * translate types within the scope of a single module. The main entry point is
     * ModuleTypeTranslator.
     */
    const ts = require("typescript");
    const googmodule = require("tsickle/src/googmodule");
    const jsdoc = require("tsickle/src/jsdoc");
    const transformer_util_1 = require("tsickle/src/transformer_util");
    const typeTranslator = require("tsickle/src/type_translator");
    /**
     * MutableJSDoc encapsulates a (potential) JSDoc comment on a specific node, and allows code to
     * modify (including delete) it.
     */
    class MutableJSDoc {
        constructor(node, sourceComment, tags) {
            this.node = node;
            this.sourceComment = sourceComment;
            this.tags = tags;
        }
        updateComment(escapeExtraTags) {
            const text = jsdoc.toStringWithoutStartEnd(this.tags, escapeExtraTags);
            if (this.sourceComment) {
                if (!text) {
                    // Delete the (now empty) comment.
                    const comments = ts.getSyntheticLeadingComments(this.node);
                    const idx = comments.indexOf(this.sourceComment);
                    comments.splice(idx, 1);
                    this.sourceComment = null;
                    return;
                }
                this.sourceComment.text = text;
                return;
            }
            // Don't add an empty comment.
            if (!text)
                return;
            const comment = {
                kind: ts.SyntaxKind.MultiLineCommentTrivia,
                text,
                hasTrailingNewLine: true,
                pos: -1,
                end: -1,
            };
            const comments = ts.getSyntheticLeadingComments(this.node) || [];
            comments.push(comment);
            ts.setSyntheticLeadingComments(this.node, comments);
        }
    }
    exports.MutableJSDoc = MutableJSDoc;
    /** Returns the Closure name of a function parameter, special-casing destructuring. */
    function getParameterName(param, index) {
        switch (param.name.kind) {
            case ts.SyntaxKind.Identifier:
                let name = transformer_util_1.getIdentifierText(param.name);
                // TypeScript allows parameters named "arguments", but Closure
                // disallows this, even in externs.
                if (name === 'arguments')
                    name = 'tsickle_arguments';
                return name;
            case ts.SyntaxKind.ArrayBindingPattern:
            case ts.SyntaxKind.ObjectBindingPattern:
                // Closure crashes if you put a binding pattern in the externs.
                // Avoid this by just generating an unused name; the name is
                // ignored anyway.
                return `__${index}`;
            default:
                // The above list of kinds is exhaustive.  param.name is 'never' at this point.
                const paramName = param.name;
                throw new Error(`unhandled function parameter kind: ${ts.SyntaxKind[paramName.kind]}`);
        }
    }
    /**
     * ModuleTypeTranslator encapsulates knowledge and helper functions to translate types in the scope
     * of a specific module. This includes managing Closure requireType statements and any symbol
     * aliases in scope for a whole file.
     */
    class ModuleTypeTranslator {
        constructor(sourceFile, typeChecker, host, diagnostics, isForExterns) {
            this.sourceFile = sourceFile;
            this.typeChecker = typeChecker;
            this.host = host;
            this.diagnostics = diagnostics;
            this.isForExterns = isForExterns;
            /**
             * A mapping of aliases for symbols in the current file, used when emitting types. TypeScript
             * emits imported symbols with unpredictable prefixes. To generate correct type annotations,
             * tsickle creates its own aliases for types, and registers them in this map (see
             * `emitImportDeclaration` and `requireType()` below). The aliases are then used when emitting
             * types.
             */
            this.symbolsToAliasedNames = new Map();
            /**
             * The set of module symbols requireTyped in the local namespace.  This tracks which imported
             * modules we've already added to additionalImports below.
             */
            this.requireTypeModules = new Set();
            /**
             * The list of generated goog.requireType statements for this module. These are inserted into
             * the module's body statements after translation.
             */
            this.additionalImports = [];
        }
        debugWarn(context, messageText) {
            transformer_util_1.reportDebugWarning(this.host, context, messageText);
        }
        error(node, messageText) {
            transformer_util_1.reportDiagnostic(this.diagnostics, node, messageText);
        }
        /**
         * Convert a TypeScript ts.Type into the equivalent Closure type.
         *
         * @param context The ts.Node containing the type reference; used for resolving symbols
         *     in context.
         * @param type The type to translate; if not provided, the Node's type will be used.
         * @param resolveAlias If true, do not emit aliases as their symbol, but rather as the resolved
         *     type underlying the alias. This should be true only when emitting the typedef itself.
         */
        typeToClosure(context, type) {
            if (this.host.untyped) {
                return '?';
            }
            const typeChecker = this.typeChecker;
            if (!type) {
                type = typeChecker.getTypeAtLocation(context);
            }
            return this.newTypeTranslator(context).translate(type);
        }
        newTypeTranslator(context) {
            // In externs, there is no local scope, so all types must be relative to the file level scope.
            const translationContext = this.isForExterns ? this.sourceFile : context;
            const translator = new typeTranslator.TypeTranslator(this.host, this.typeChecker, translationContext, this.host.typeBlackListPaths, this.symbolsToAliasedNames, (sym) => this.ensureSymbolDeclared(sym));
            translator.isForExterns = this.isForExterns;
            translator.warn = msg => this.debugWarn(context, msg);
            return translator;
        }
        isBlackListed(context) {
            const type = this.typeChecker.getTypeAtLocation(context);
            let sym = type.symbol;
            if (!sym)
                return false;
            if (sym.flags & ts.SymbolFlags.Alias) {
                sym = this.typeChecker.getAliasedSymbol(sym);
            }
            return this.newTypeTranslator(context).isBlackListed(sym);
        }
        /**
         * Get the ts.Symbol at a location or throw.
         * The TypeScript API can return undefined when fetching a symbol, but in many contexts we know it
         * won't (e.g. our input is already type-checked).
         */
        mustGetSymbolAtLocation(node) {
            const sym = this.typeChecker.getSymbolAtLocation(node);
            if (!sym)
                throw new Error('no symbol');
            return sym;
        }
        /** Finds an exported (i.e. not global) declaration for the given symbol. */
        findExportedDeclaration(sym) {
            // TODO(martinprobst): it's unclear when a symbol wouldn't have a declaration, maybe just for
            // some builtins (e.g. Symbol)?
            if (!sym.declarations || sym.declarations.length === 0)
                return undefined;
            // A symbol declared in this file does not need to be imported.
            if (sym.declarations.some(d => d.getSourceFile() === this.sourceFile))
                return undefined;
            // Find an exported declaration.
            // Because tsickle runs with the --declaration flag, all types referenced from exported types
            // must be exported, too, so there must either be some declaration that is exported, or the
            // symbol is actually a global declaration (declared in a script file, not a module).
            const decl = sym.declarations.find(d => {
                // Check for Export | Default (default being a default export).
                if (!transformer_util_1.hasModifierFlag(d, ts.ModifierFlags.ExportDefault))
                    return false;
                // Exclude symbols declared in `declare global {...}` blocks, they are global and don't need
                // imports.
                let current = d;
                while (current) {
                    if (current.flags & ts.NodeFlags.GlobalAugmentation)
                        return false;
                    current = current.parent;
                }
                return true;
            });
            return decl;
        }
        /**
         * Generates a somewhat human-readable module prefix for the given import context, to make
         * debugging the emitted Closure types a bit easier.
         */
        generateModulePrefix(importPath) {
            const modulePrefix = importPath.replace(/(\/index)?(\.d)?\.[tj]sx?$/, '')
                .replace(/^.*[/.](.+?)/, '$1')
                .replace(/\W/g, '_');
            return `tsickle_${modulePrefix || 'reqType'}_`;
        }
        /**
         * Records that we we want a `const x = goog.requireType...` import of the given `importPath`,
         * which will be inserted when we emit.
         * This also registers aliases for symbols from the module that map to this requireType.
         *
         * @param isDefaultImport True if the import statement is a default import, e.g.
         *     `import Foo from ...;`, which matters for adjusting whether we emit a `.default`.
         */
        requireType(importPath, moduleSymbol, isDefaultImport = false) {
            if (this.host.untyped)
                return;
            // Already imported? Do not emit a duplicate requireType.
            if (this.requireTypeModules.has(moduleSymbol))
                return;
            if (typeTranslator.isBlacklisted(this.host.typeBlackListPaths, moduleSymbol)) {
                return; // Do not emit goog.requireType for blacklisted paths.
            }
            const nsImport = googmodule.extractGoogNamespaceImport(importPath);
            const requireTypePrefix = this.generateModulePrefix(importPath) + String(this.requireTypeModules.size + 1);
            const moduleNamespace = nsImport !== null ?
                nsImport :
                this.host.pathToModuleName(this.sourceFile.fileName, importPath);
            // In TypeScript, importing a module for use in a type annotation does not cause a runtime load.
            // In Closure Compiler, goog.require'ing a module causes a runtime load, so emitting requires
            // here would cause a change in load order, which is observable (and can lead to errors).
            // Instead, goog.requireType types, which allows using them in type annotations without
            // causing a load.
            //   const requireTypePrefix = goog.requireType(moduleNamespace)
            this.additionalImports.push(ts.createVariableStatement(undefined, ts.createVariableDeclarationList([ts.createVariableDeclaration(requireTypePrefix, undefined, ts.createCall(ts.createPropertyAccess(ts.createIdentifier('goog'), 'requireType'), undefined, [ts.createLiteral(moduleNamespace)]))], ts.NodeFlags.Const)));
            this.requireTypeModules.add(moduleSymbol);
            for (let sym of this.typeChecker.getExportsOfModule(moduleSymbol)) {
                if (sym.flags & ts.SymbolFlags.Alias) {
                    sym = this.typeChecker.getAliasedSymbol(sym);
                }
                // goog: imports don't actually use the .default property that TS thinks they have.
                const qualifiedName = nsImport && isDefaultImport ? requireTypePrefix : requireTypePrefix + '.' + sym.name;
                this.symbolsToAliasedNames.set(sym, qualifiedName);
            }
        }
        ensureSymbolDeclared(sym) {
            const decl = this.findExportedDeclaration(sym);
            if (!decl)
                return;
            if (this.isForExterns) {
                this.error(decl, `declaration from module used in ambient type: ${sym.name}`);
                return;
            }
            // Actually import the symbol.
            const sourceFile = decl.getSourceFile();
            if (sourceFile === ts.getOriginalNode(this.sourceFile))
                return;
            const moduleSymbol = this.typeChecker.getSymbolAtLocation(sourceFile);
            // A source file might not have a symbol if it's not a module (no ES6 im/exports).
            if (!moduleSymbol)
                return;
            // TODO(martinprobst): this should possibly use fileNameToModuleId.
            this.requireType(sourceFile.fileName, moduleSymbol);
        }
        insertAdditionalImports(sourceFile) {
            let insertion = 0;
            // Skip over a leading file comment holder.
            if (sourceFile.statements.length &&
                sourceFile.statements[0].kind === ts.SyntaxKind.NotEmittedStatement) {
                insertion++;
            }
            return ts.updateSourceFileNode(sourceFile, [
                ...sourceFile.statements.slice(0, insertion),
                ...this.additionalImports,
                ...sourceFile.statements.slice(insertion),
            ]);
        }
        /**
         * Parses and synthesizes comments on node, and returns the JSDoc from it, if any.
         * @param reportWarnings if true, will report warnings from parsing the JSDoc. Set to false if
         *     this is not the "main" location dealing with a node to avoid duplicated warnings.
         */
        getJSDoc(node, reportWarnings) {
            const [tags,] = this.parseJSDoc(node, reportWarnings);
            return tags;
        }
        getMutableJSDoc(node) {
            const [tags, comment] = this.parseJSDoc(node, /* reportWarnings */ true);
            return new MutableJSDoc(node, comment, tags);
        }
        parseJSDoc(node, reportWarnings) {
            // synthesizeLeadingComments below changes text locations for node, so extract the location here
            // in case it is needed later to report diagnostics.
            const start = node.getFullStart();
            const length = node.getLeadingTriviaWidth(this.sourceFile);
            const comments = jsdoc.synthesizeLeadingComments(node);
            if (!comments || comments.length === 0)
                return [[], null];
            for (let i = comments.length - 1; i >= 0; i--) {
                const comment = comments[i];
                const parsed = jsdoc.parse(comment);
                if (parsed) {
                    if (reportWarnings && parsed.warnings) {
                        const range = comment.originalRange || { pos: start, end: start + length };
                        transformer_util_1.reportDiagnostic(this.diagnostics, node, parsed.warnings.join('\n'), range, ts.DiagnosticCategory.Warning);
                    }
                    return [parsed.tags, comment];
                }
            }
            return [[], null];
        }
        /**
         * Creates the jsdoc for methods, including overloads.
         * If overloaded, merges the signatures in the list of SignatureDeclarations into a single jsdoc.
         * - Total number of parameters will be the maximum count found across all variants.
         * - Different names at the same parameter index will be joined with "_or_"
         * - Variable args (...type[] in TypeScript) will be output as "...type",
         *    except if found at the same index as another argument.
         * @param fnDecls Pass > 1 declaration for overloads of same name
         * @return The list of parameter names that should be used to emit the actual
         *    function statement; for overloads, name will have been merged.
         */
        getFunctionTypeJSDoc(fnDecls, extraTags = []) {
            const typeChecker = this.typeChecker;
            // De-duplicate tags and docs found for the fnDecls.
            const tagsByName = new Map();
            function addTag(tag) {
                const existing = tagsByName.get(tag.tagName);
                tagsByName.set(tag.tagName, existing ? jsdoc.merge([existing, tag]) : tag);
            }
            for (const extraTag of extraTags)
                addTag(extraTag);
            const isConstructor = fnDecls.find(d => d.kind === ts.SyntaxKind.Constructor) !== undefined;
            // For each parameter index i, paramTags[i] is an array of parameters
            // that can be found at index i.  E.g.
            //    function foo(x: string)
            //    function foo(y: number, z: string)
            // then paramTags[0] = [info about x, info about y].
            const paramTags = [];
            const returnTags = [];
            const thisTags = [];
            const typeParameterNames = new Set();
            const argCounts = [];
            let thisReturnType = null;
            for (const fnDecl of fnDecls) {
                // Construct the JSDoc comment by reading the existing JSDoc, if
                // any, and merging it with the known types of the function
                // parameters and return type.
                const tags = this.getJSDoc(fnDecl, /* reportWarnings */ false);
                // Copy all the tags other than @param/@return into the new
                // JSDoc without any change; @param/@return are handled specially.
                // TODO: there may be problems if an annotation doesn't apply to all overloads;
                // is it worth checking for this and erroring?
                for (const tag of tags) {
                    if (tag.tagName === 'param' || tag.tagName === 'return')
                        continue;
                    addTag(tag);
                }
                const flags = ts.getCombinedModifierFlags(fnDecl);
                // Add @abstract on "abstract" declarations.
                if (flags & ts.ModifierFlags.Abstract) {
                    addTag({ tagName: 'abstract' });
                }
                // Add @protected/@private if present.
                if (flags & ts.ModifierFlags.Protected) {
                    addTag({ tagName: 'protected' });
                }
                else if (flags & ts.ModifierFlags.Private) {
                    addTag({ tagName: 'private' });
                }
                // Add any @template tags.
                // Multiple declarations with the same template variable names should work:
                // the declarations get turned into union types, and Closure Compiler will need
                // to find a union where all type arguments are satisfied.
                if (fnDecl.typeParameters) {
                    for (const tp of fnDecl.typeParameters) {
                        typeParameterNames.add(transformer_util_1.getIdentifierText(tp.name));
                    }
                }
                // Merge the parameters into a single list of merged names and list of types
                const sig = typeChecker.getSignatureFromDeclaration(fnDecl);
                if (!sig || !sig.declaration)
                    throw new Error(`invalid signature ${fnDecl.name}`);
                if (sig.declaration.kind === ts.SyntaxKind.JSDocSignature) {
                    throw new Error(`JSDoc signature ${fnDecl.name}`);
                }
                let hasThisParam = false;
                for (let i = 0; i < sig.declaration.parameters.length; i++) {
                    const paramNode = sig.declaration.parameters[i];
                    const name = getParameterName(paramNode, i);
                    const isThisParam = name === 'this';
                    if (isThisParam)
                        hasThisParam = true;
                    const newTag = {
                        tagName: isThisParam ? 'this' : 'param',
                        optional: paramNode.initializer !== undefined || paramNode.questionToken !== undefined,
                        parameterName: isThisParam ? undefined : name,
                    };
                    let type = typeChecker.getTypeAtLocation(paramNode);
                    if (paramNode.dotDotDotToken !== undefined) {
                        newTag.restParam = true;
                        // In TypeScript you write "...x: number[]", but in Closure
                        // you don't write the array: "@param {...number} x".  Unwrap
                        // the Array<> wrapper.
                        if ((type.flags & ts.TypeFlags.Object) === 0 && type.flags & ts.TypeFlags.TypeParameter) {
                            // function f<T extends string[]>(...ts: T) has the Array type on the type parameter
                            // constraint, not on the parameter itself. Resolve it.
                            const baseConstraint = typeChecker.getBaseConstraintOfType(type);
                            if (baseConstraint)
                                type = baseConstraint;
                        }
                        if (type.flags & ts.TypeFlags.Object &&
                            type.objectFlags & ts.ObjectFlags.Reference) {
                            const typeRef = type;
                            if (!typeRef.typeArguments) {
                                throw new Error('rest parameter does not resolve to a reference type');
                            }
                            type = typeRef.typeArguments[0];
                        }
                    }
                    newTag.type = this.typeToClosure(fnDecl, type);
                    for (const { tagName, parameterName, text } of tags) {
                        if (tagName === 'param' && parameterName === newTag.parameterName) {
                            newTag.text = text;
                            break;
                        }
                    }
                    if (!isThisParam) {
                        const paramIdx = hasThisParam ? i - 1 : i;
                        if (!paramTags[paramIdx])
                            paramTags.push([]);
                        paramTags[paramIdx].push(newTag);
                    }
                    else {
                        thisTags.push(newTag);
                    }
                }
                argCounts.push(hasThisParam ? sig.declaration.parameters.length - 1 : sig.declaration.parameters.length);
                // Return type.
                if (!isConstructor) {
                    const returnTag = {
                        tagName: 'return',
                    };
                    const retType = typeChecker.getReturnTypeOfSignature(sig);
                    // Generate a templated `@this` tag for TypeScript `foo(): this` return type specification.
                    // Make sure not to do that if the function already has used `@this` due to a this
                    // parameter. It's not clear how to resolve the two conflicting this types best, the current
                    // solution prefers the explicitly given `this` parameter.
                    // tslint:disable-next-line:no-any accessing TS internal field.
                    if (retType.isThisType && !hasThisParam) {
                        // foo(): this
                        thisReturnType = retType;
                        addTag({ tagName: 'template', text: 'THIS' });
                        addTag({ tagName: 'this', type: 'THIS' });
                        returnTag.type = 'THIS';
                    }
                    else {
                        returnTag.type = this.typeToClosure(fnDecl, retType);
                        for (const { tagName, text } of tags) {
                            if (tagName === 'return') {
                                returnTag.text = text;
                                break;
                            }
                        }
                    }
                    returnTags.push(returnTag);
                }
            }
            if (typeParameterNames.size > 0) {
                addTag({ tagName: 'template', text: Array.from(typeParameterNames.values()).join(', ') });
            }
            const newDoc = Array.from(tagsByName.values());
            if (thisTags.length > 0) {
                newDoc.push(jsdoc.merge(thisTags));
            }
            const minArgsCount = Math.min(...argCounts);
            const maxArgsCount = Math.max(...argCounts);
            // Merge the JSDoc tags for each overloaded parameter.
            // Ensure each parameter has a unique name; the merging process can otherwise
            // accidentally generate the same parameter name twice.
            const paramNames = new Set();
            let foundOptional = false;
            for (let i = 0; i < maxArgsCount; i++) {
                const paramTag = jsdoc.merge(paramTags[i]);
                if (paramNames.has(paramTag.parameterName)) {
                    paramTag.parameterName += i.toString();
                }
                paramNames.add(paramTag.parameterName);
                // If the tag is optional, mark parameters following optional as optional,
                // even if they are not, since Closure restricts this, see
                // https://github.com/google/closure-compiler/issues/2314
                if (!paramTag.restParam && (paramTag.optional || foundOptional || i >= minArgsCount)) {
                    foundOptional = true;
                    paramTag.optional = true;
                }
                newDoc.push(paramTag);
                if (paramTag.restParam) {
                    // Cannot have any parameters after a rest param.
                    // Just dump the remaining parameters.
                    break;
                }
            }
            // Merge the JSDoc tags for each overloaded return.
            if (!isConstructor) {
                newDoc.push(jsdoc.merge(returnTags));
            }
            return {
                tags: newDoc,
                parameterNames: newDoc.filter(t => t.tagName === 'param').map(t => t.parameterName),
                thisReturnType,
            };
        }
    }
    exports.ModuleTypeTranslator = ModuleTypeTranslator;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlX3R5cGVfdHJhbnNsYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9tb2R1bGVfdHlwZV90cmFuc2xhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBRUg7Ozs7T0FJRztJQUVILGlDQUFpQztJQUdqQyxxREFBMkM7SUFDM0MsMkNBQWlDO0lBQ2pDLG1FQUE0RztJQUM1Ryw4REFBb0Q7SUFFcEQ7OztPQUdHO0lBQ0gsTUFBYSxZQUFZO1FBQ3ZCLFlBQ1ksSUFBYSxFQUFVLGFBQXlDLEVBQ2pFLElBQWlCO1lBRGhCLFNBQUksR0FBSixJQUFJLENBQVM7WUFBVSxrQkFBYSxHQUFiLGFBQWEsQ0FBNEI7WUFDakUsU0FBSSxHQUFKLElBQUksQ0FBYTtRQUFHLENBQUM7UUFFaEMsYUFBYSxDQUFDLGVBQTZCO1lBQ3pDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDdEIsSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDVCxrQ0FBa0M7b0JBQ2xDLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUM7b0JBQzVELE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUNqRCxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDeEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7b0JBQzFCLE9BQU87aUJBQ1I7Z0JBQ0QsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO2dCQUMvQixPQUFPO2FBQ1I7WUFFRCw4QkFBOEI7WUFDOUIsSUFB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YzthQUNmLENBQUM7UUFDSixDQUFDO0tBQ0Y7SUEvY0Qsb0RBK2NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgbW9kdWxlX3R5cGVfdHJhbnNsYXRvciBidWlsZHMgb24gdG9wIG9mIHR5cGVfdHJhbnNsYXRvciwgYWRkaW5nIGZ1bmN0aW9uYWxpdHkgdG9cbiAqIHRyYW5zbGF0ZSB0eXBlcyB3aXRoaW4gdGhlIHNjb3BlIG9mIGEgc2luZ2xlIG1vZHVsZS4gVGhlIG1haW4gZW50cnkgcG9pbnQgaXNcbiAqIE1vZHVsZVR5cGVUcmFuc2xhdG9yLlxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0Fubm90YXRvckhvc3R9IGZyb20gJy4vYW5ub3RhdG9yX2hvc3QnO1xuaW1wb3J0ICogYXMgZ29vZ21vZHVsZSBmcm9tICcuL2dvb2dtb2R1bGUnO1xuaW1wb3J0ICogYXMganNkb2MgZnJvbSAnLi9qc2RvYyc7XG5pbXBvcnQge2dldElkZW50aWZpZXJUZXh0LCBoYXNNb2RpZmllckZsYWcsIHJlcG9ydERlYnVnV2FybmluZywgcmVwb3J0RGlhZ25vc3RpY30gZnJvbSAnLi90cmFuc2Zvcm1lcl91dGlsJztcbmltcG9ydCAqIGFzIHR5cGVUcmFuc2xhdG9yIGZyb20gJy4vdHlwZV90cmFuc2xhdG9yJztcblxuLyoqXG4gKiBNdXRhYmxlSlNEb2MgZW5jYXBzdWxhdGVzIGEgKHBvdGVudGlhbCkgSlNEb2MgY29tbWVudCBvbiBhIHNwZWNpZmljIG5vZGUsIGFuZCBhbGxvd3MgY29kZSB0b1xuICogbW9kaWZ5IChpbmNsdWRpbmcgZGVsZXRlKSBpdC5cbiAqL1xuZXhwb3J0IGNsYXNzIE11dGFibGVKU0RvYyB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBub2RlOiB0cy5Ob2RlLCBwcml2YXRlIHNvdXJjZUNvbW1lbnQ6IHRzLlN5bnRoZXNpemVkQ29tbWVudHxudWxsLFxuICAgICAgcHVibGljIHRhZ3M6IGpzZG9jLlRhZ1tdKSB7fVxuXG4gIHVwZGF0ZUNvbW1lbnQoZXNjYXBlRXh0cmFUYWdzPzogU2V0PHN0cmluZz4pIHtcbiAgICBjb25zdCB0ZXh0ID0ganNkb2MudG9TdHJpbmdXaXRob3V0U3RhcnRFbmQodGhpcy50YWdzLCBlc2NhcGVFeHRyYVRhZ3MpO1xuICAgIGlmICh0aGlzLnNvdXJjZUNvbW1lbnQpIHtcbiAgICAgIGlmICghdGV4dCkge1xuICAgICAgICAvLyBEZWxldGUgdGhlIChub3cgZW1wdHkpIGNvbW1lbnQuXG4gICAgICAgIGNvbnN0IGNvbW1lbnRzID0gdHMuZ2V0U3ludGhldGljTGVhZGluZ0NvbW1lbnRzKHRoaXMubm9kZSkhO1xuICAgICAgICBjb25zdCBpZHggPSBjb21tZW50cy5pbmRleE9mKHRoaXMuc291cmNlQ29tbWVudCk7XG4gICAgICAgIGNvbW1lbnRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB0aGlzLnNvdXJjZUNvbW1lbnQgPSBudWxsO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUNvbW1lbnQudGV4dCA9IHRleHQ7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgYWRkIGFuIGVtcHR5IGNvbW1lbnQuXG4gICAgaWYgKCF0ZXh0KSByZXR1cm47XG5cbiAgICBjb25zdCBjb21tZW50OiB0cy5TeW50aGVzaXplZENvbW1lbnQgPSB7XG4gICAgICBraW5kOiB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsXG4gICAgICB0ZXh0LFxuICAgICAgaGFzVHJhaWxpbmdOZXdMaW5lOiB0cnVlLFxuICAgICAgcG9zOiAtMSxcbiAgICAgIGVuZDogLTEsXG4gICAgfTtcbiAgICBjb25zdCBjb21tZW50cyA9IHRzLmdldFN5bnRoZXRpY0xlYWRpbmdDb21tZW50cyh0aGlzLm5vZGUpIHx8IFtdO1xuICAgIGNvbW1lbnRzLnB1c2goY29tbWVudCk7XG4gICAgdHMuc2V0U3ludGhldGljTGVhZGluZ0NvbW1lbnRzKHRoaXMubm9kZSwgY29tbWVudHMpO1xuICB9XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBDbG9zdXJlIG5hbWUgb2YgYSBmdW5jdGlvbiBwYXJhbWV0ZXIsIHNwZWNpYWwtY2FzaW5nIGRlc3RydWN0dXJpbmcuICovXG5mdW5jdGlvbiBnZXRQYXJhbWV0ZXJOYW1lKHBhcmFtOiB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbiwgaW5kZXg6IG51bWJlcik6IHN0cmluZyB7XG4gIHN3aXRjaCAocGFyYW0ubmFtZS5raW5kKSB7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXI6XG4gICAgICBsZXQgbmFtZSA9IGdldElkZW50aWZpZXJUZXh0KHBhcmFtLm5hbWUgYXMgdHMuSWRlbnRpZmllcik7XG4gICAgICAvLyBUeXBlU2NyaXB0IGFsbG93cyBwYXJhbWV0ZXJzIG5hbWVkIFwiYXJndW1lbnRzXCIsIGJ1dCBDbG9zdXJlXG4gICAgICAvLyBkaXNhbGxvd3MgdGhpcywgZXZlbiBpbiBleHRlcm5zLlxuICAgICAgaWYgKG5hbWUgPT09ICdhcmd1bWVudHMnKSBuYW1lID0gJ3RzaWNrbGVfYXJndW1lbnRzJztcbiAgICAgIHJldHVybiBuYW1lO1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5BcnJheUJpbmRpbmdQYXR0ZXJuOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5PYmplY3RCaW5kaW5nUGF0dGVybjpcbiAgICAgIC8vIENsb3N1cmUgY3Jhc2hlcyBpZiB5b3UgcHV0IGEgYmluZGluZyBwYXR0ZXJuIGluIHRoZSBleHRlcm5zLlxuICAgICAgLy8gQXZvaWQgdGhpcyBieSBqdXN0IGdlbmVyYXRpbmcgYW4gdW51c2VkIG5hbWU7IHRoZSBuYW1lIGlzXG4gICAgICAvLyBpZ25vcmVkIGFueXdheS5cbiAgICAgIHJldHVybiBgX18ke2luZGV4fWA7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIFRoZSBhYm92ZSBsaXN0IG9mIGtpbmRzIGlzIGV4aGF1c3RpdmUuICBwYXJhbS5uYW1lIGlzICduZXZlcicgYXQgdGhpcyBwb2ludC5cbiAgICAgIGNvbnN0IHBhcmFtTmFtZSA9IHBhcmFtLm5hbWUgYXMgdHMuTm9kZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgdW5oYW5kbGVkIGZ1bmN0aW9uIHBhcmFtZXRlciBraW5kOiAke3RzLlN5bnRheEtpbmRbcGFyYW1OYW1lLmtpbmRdfWApO1xuICB9XG59XG5cbi8qKlxuICogTW9kdWxlVHlwZVRyYW5zbGF0b3IgZW5jYXBzdWxhdGVzIGtub3dsZWRnZSBhbmQgaGVscGVyIGZ1bmN0aW9ucyB0byB0cmFuc2xhdGUgdHlwZXMgaW4gdGhlIHNjb3BlXG4gKiBvZiBhIHNwZWNpZmljIG1vZHVsZS4gVGhpcyBpbmNsdWRlcyBtYW5hZ2luZyBDbG9zdXJlIHJlcXVpcmVUeXBlIHN0YXRlbWVudHMgYW5kIGFueSBzeW1ib2xcbiAqIGFsaWFzZXMgaW4gc2NvcGUgZm9yIGEgd2hvbGUgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vZHVsZVR5cGVUcmFuc2xhdG9yIHtcbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBhbGlhc2VzIGZvciBzeW1ib2xzIGluIHRoZSBjdXJyZW50IGZpbGUsIHVzZWQgd2hlbiBlbWl0dGluZyB0eXBlcy4gVHlwZVNjcmlwdFxuICAgKiBlbWl0cyBpbXBvcnRlZCBzeW1ib2xzIHdpdGggdW5wcmVkaWN0YWJsZSBwcmVmaXhlcy4gVG8gZ2VuZXJhdGUgY29ycmVjdCB0eXBlIGFubm90YXRpb25zLFxuICAgKiB0c2lja2xlIGNyZWF0ZXMgaXRzIG93biBhbGlhc2VzIGZvciB0eXBlcywgYW5kIHJlZ2lzdGVycyB0aGVtIGluIHRoaXMgbWFwIChzZWVcbiAgICogYGVtaXRJbXBvcnREZWNsYXJhdGlvbmAgYW5kIGByZXF1aXJlVHlwZSgpYCBiZWxvdykuIFRoZSBhbGlhc2VzIGFyZSB0aGVuIHVzZWQgd2hlbiBlbWl0dGluZ1xuICAgKiB0eXBlcy5cbiAgICovXG4gIHN5bWJvbHNUb0FsaWFzZWROYW1lcyA9IG5ldyBNYXA8dHMuU3ltYm9sLCBzdHJpbmc+KCk7XG5cbiAgLyoqXG4gICAqIFRoZSBzZXQgb2YgbW9kdWxlIHN5bWJvbHMgcmVxdWlyZVR5cGVkIGluIHRoZSBsb2NhbCBuYW1lc3BhY2UuICBUaGlzIHRyYWNrcyB3aGljaCBpbXBvcnRlZFxuICAgKiBtb2R1bGVzIHdlJ3ZlIGFscmVhZHkgYWRkZWQgdG8gYWRkaXRpb25hbEltcG9ydHMgYmVsb3cuXG4gICAqL1xuICBwcml2YXRlIHJlcXVpcmVUeXBlTW9kdWxlcyA9IG5ldyBTZXQ8dHMuU3ltYm9sPigpO1xuXG4gIC8qKlxuICAgKiBUaGUgbGlzdCBvZiBnZW5lcmF0ZWQgZ29vZy5yZXF1aXJlVHlwZSBzdGF0ZW1lbnRzIGZvciB0aGlzIG1vZHVsZS4gVGhlc2UgYXJlIGluc2VydGVkIGludG9cbiAgICogdGhlIG1vZHVsZSdzIGJvZHkgc3RhdGVtZW50cyBhZnRlciB0cmFuc2xhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgYWRkaXRpb25hbEltcG9ydHM6IHRzLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSxcbiAgICAgIHB1YmxpYyB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsXG4gICAgICBwcml2YXRlIGhvc3Q6IEFubm90YXRvckhvc3QsXG4gICAgICBwcml2YXRlIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10sXG4gICAgICBwcml2YXRlIGlzRm9yRXh0ZXJuczogYm9vbGVhbixcbiAgKSB7fVxuXG4gIGRlYnVnV2Fybihjb250ZXh0OiB0cy5Ob2RlLCBtZXNzYWdlVGV4dDogc3RyaW5nKSB7XG4gICAgcmVwb3J0RGVidWdXYXJuaW5nKHRoaXMuaG9zdCwgY29udGV4dCwgbWVzc2FnZVRleHQpO1xuICB9XG5cbiAgZXJyb3Iobm9kZTogdHMuTm9kZSwgbWVzc2FnZVRleHQ6IHN0cmluZykge1xuICAgIHJlcG9ydERpYWdub3N0aWModGhpcy5kaWFnbm9zdGljcywgbm9kZSwgbWVzc2FnZVRleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYSBUeXBlU2NyaXB0IHRzLlR5cGUgaW50byB0aGUgZXF1aXZhbGVudCBDbG9zdXJlIHR5cGUuXG4gICAqXG4gICAqIEBwYXJhbSBjb250ZXh0IFRoZSB0cy5Ob2RlIGNvbnRhaW5pbmcgdGhlIHR5cGUgcmVmZXJlbmNlOyB1c2VkIGZvciByZXNvbHZpbmcgc3ltYm9sc1xuICAgKiAgICAgaW4gY29udGV4dC5cbiAgICogQHBhcmFtIHR5cGUgVGhlIHR5cGUgdG8gdHJhbnNsYXRlOyBpZiBub3QgcHJvdmlkZWQsIHRoZSBOb2RlJ3MgdHlwZSB3aWxsIGJlIHVzZWQuXG4gICAqIEBwYXJhbSByZXNvbHZlQWxpYXMgSWYgdHJ1ZSwgZG8gbm90IGVtaXQgYWxpYXNlcyBhcyB0aGVpciBzeW1ib2wsIGJ1dCByYXRoZXIgYXMgdGhlIHJlc29sdmVkXG4gICAqICAgICB0eXBlIHVuZGVybHlpbmcgdGhlIGFsaWFzLiBUaGlzIHNob3VsZCBiZSB0cnVlIG9ubHkgd2hlbiBlbWl0dGluZyB0aGUgdHlwZWRlZiBpdHNlbGYuXG4gICAqL1xuICB0eXBlVG9DbG9zdXJlKGNvbnRleHQ6IHRzLk5vZGUsIHR5cGU/OiB0cy5UeXBlKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5ob3N0LnVudHlwZWQpIHtcbiAgICAgIHJldHVybiAnPyc7XG4gICAgfVxuXG4gICAgY29uc3QgdHlwZUNoZWNrZXIgPSB0aGlzLnR5cGVDaGVja2VyO1xuICAgIGlmICghdHlwZSkge1xuICAgICAgdHlwZSA9IHR5cGVDaGVja2VyLmdldFR5cGVBdExvY2F0aW9uKGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5uZXdUeXBlVHJhbnNsYXRvcihjb250ZXh0KS50cmFuc2xhdGUodHlwZSk7XG4gIH1cblxuICBuZXdUeXBlVHJhbnNsYXRvcihjb250ZXh0OiB0cy5Ob2RlKSB7XG4gICAgLy8gSW4gZXh0ZXJucywgdGhlcmUgaXMgbm8gbG9jYWwgc2NvcGUsIHNvIGFsbCB0eXBlcyBtdXN0IGJlIHJlbGF0aXZlIHRvIHRoZSBmaWxlIGxldmVsIHNjb3BlLlxuICAgIGNvbnN0IHRyYW5zbGF0aW9uQ29udGV4dCA9IHRoaXMuaXNGb3JFeHRlcm5zID8gdGhpcy5zb3VyY2VGaWxlIDogY29udGV4dDtcblxuICAgIGNvbnN0IHRyYW5zbGF0b3IgPSBuZXcgdHlwZVRyYW5zbGF0b3IuVHlwZVRyYW5zbGF0b3IoXG4gICAgICAgIHRoaXMuaG9zdCwgdGhpcy50eXBlQ2hlY2tlciwgdHJhbnNsYXRpb25Db250ZXh0LCB0aGlzLmhvc3QudHlwZUJsYWNrTGlzdFBhdGhzLFxuICAgICAgICB0aGlzLnN5bWJvbHNUb0FsaWFzZWROYW1lcywgKHN5bTogdHMuU3ltYm9sKSA9PiB0aGlzLmVuc3VyZVN5bWJvbERlY2xhcmVkKHN5bSkpO1xuICAgIHRyYW5zbGF0b3IuaXNGb3JFeHRlcm5zID0gdGhpcy5pc0ZvckV4dGVybnM7XG4gICAgdHJhbnNsYXRvci53YXJuID0gbXNnID0+IHRoaXMuZGVidWdXYXJuKGNvbnRleHQsIG1zZyk7XG4gICAgcmV0dXJuIHRyYW5zbGF0b3I7XG4gIH1cblxuICBpc0JsYWNrTGlzdGVkKGNvbnRleHQ6IHRzLk5vZGUpIHtcbiAgICBjb25zdCB0eXBlID0gdGhpcy50eXBlQ2hlY2tlci5nZXRUeXBlQXRMb2NhdGlvbihjb250ZXh0KTtcbiAgICBsZXQgc3ltID0gdHlwZS5zeW1ib2w7XG4gICAgaWYgKCFzeW0pIHJldHVybiBmYWxzZTtcbiAgICBpZiAoc3ltLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICAgIHN5bSA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0QWxpYXNlZFN5bWJvbChzeW0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5uZXdUeXBlVHJhbnNsYXRvcihjb250ZXh0KS5pc0JsYWNrTGlzdGVkKHN5bSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSB0cy5TeW1ib2wgYXQgYSBsb2NhdGlvbiBvciB0aHJvdy5cbiAgICogVGhlIFR5cGVTY3JpcHQgQVBJIGNhbiByZXR1cm4gdW5kZWZpbmVkIHdoZW4gZmV0Y2hpbmcgYSBzeW1ib2wsIGJ1dCBpbiBtYW55IGNvbnRleHRzIHdlIGtub3cgaXRcbiAgICogd29uJ3QgKGUuZy4gb3VyIGlucHV0IGlzIGFscmVhZHkgdHlwZS1jaGVja2VkKS5cbiAgICovXG4gIG11c3RHZXRTeW1ib2xBdExvY2F0aW9uKG5vZGU6IHRzLk5vZGUpOiB0cy5TeW1ib2wge1xuICAgIGNvbnN0IHN5bSA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihub2RlKTtcbiAgICBpZiAoIXN5bSkgdGhyb3cgbmV3IEVycm9yKCdubyBzeW1ib2wnKTtcbiAgICByZXR1cm4gc3ltO1xuICB9XG5cbiAgLyoqIEZpbmRzIGFuIGV4cG9ydGVkIChpLmUuIG5vdCBnbG9iYWwpIGRlY2xhcmF0aW9uIGZvciB0aGUgZ2l2ZW4gc3ltYm9sLiAqL1xuICBwcm90ZWN0ZWQgZmluZEV4cG9ydGVkRGVjbGFyYXRpb24oc3ltOiB0cy5TeW1ib2wpOiB0cy5EZWNsYXJhdGlvbnx1bmRlZmluZWQge1xuICAgIC8vIFRPRE8obWFydGlucHJvYnN0KTogaXQncyB1bmNsZWFyIHdoZW4gYSBzeW1ib2wgd291bGRuJ3QgaGF2ZSBhIGRlY2xhcmF0aW9uLCBtYXliZSBqdXN0IGZvclxuICAgIC8vIHNvbWUgYnVpbHRpbnMgKGUuZy4gU3ltYm9sKT9cbiAgICBpZiAoIXN5bS5kZWNsYXJhdGlvbnMgfHwgc3ltLmRlY2xhcmF0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiB1bmRlZmluZWQ7XG4gICAgLy8gQSBzeW1ib2wgZGVjbGFyZWQgaW4gdGhpcyBmaWxlIGRvZXMgbm90IG5lZWQgdG8gYmUgaW1wb3J0ZWQuXG4gICAgaWYgKHN5bS5kZWNsYXJhdGlvbnMuc29tZShkID0+IGQuZ2V0U291cmNlRmlsZSgpID09PSB0aGlzLnNvdXJjZUZpbGUpKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgLy8gRmluZCBhbiBleHBvcnRlZCBkZWNsYXJhdGlvbi5cbiAgICAvLyBCZWNhdXNlIHRzaWNrbGUgcnVucyB3aXRoIHRoZSAtLWRlY2xhcmF0aW9uIGZsYWcsIGFsbCB0eXBlcyByZWZlcmVuY2VkIGZyb20gZXhwb3J0ZWQgdHlwZXNcbiAgICAvLyBtdXN0IGJlIGV4cG9ydGVkLCB0b28sIHNvIHRoZXJlIG11c3QgZWl0aGVyIGJlIHNvbWUgZGVjbGFyYXRpb24gdGhhdCBpcyBleHBvcnRlZCwgb3IgdGhlXG4gICAgLy8gc3ltYm9sIGlzIGFjdHVhbGx5IGEgZ2xvYmFsIGRlY2xhcmF0aW9uIChkZWNsYXJlZCBpbiBhIHNjcmlwdCBmaWxlLCBub3QgYSBtb2R1bGUpLlxuICAgIGNvbnN0IGRlY2wgPSBzeW0uZGVjbGFyYXRpb25zLmZpbmQoZCA9PiB7XG4gICAgICAvLyBDaGVjayBmb3IgRXhwb3J0IHwgRGVmYXVsdCAoZGVmYXVsdCBiZWluZyBhIGRlZmF1bHQgZXhwb3J0KS5cbiAgICAgIGlmICghaGFzTW9kaWZpZXJGbGFnKGQsIHRzLk1vZGlmaWVyRmxhZ3MuRXhwb3J0RGVmYXVsdCkpIHJldHVybiBmYWxzZTtcbiAgICAgIC8vIEV4Y2x1ZGUgc3ltYm9scyBkZWNsYXJlZCBpbiBgZGVjbGFyZSBnbG9iYWwgey4uLn1gIGJsb2NrcywgdGhleSBhcmUgZ2xvYmFsIGFuZCBkb24ndCBuZWVkXG4gICAgICAvLyBpbXBvcnRzLlxuICAgICAgbGV0IGN1cnJlbnQ6IHRzLk5vZGV8dW5kZWZpbmVkID0gZDtcbiAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgIGlmIChjdXJyZW50LmZsYWdzICYgdHMuTm9kZUZsYWdzLkdsb2JhbEF1Z21lbnRhdGlvbikgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVjbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSBzb21ld2hhdCBodW1hbi1yZWFkYWJsZSBtb2R1bGUgcHJlZml4IGZvciB0aGUgZ2l2ZW4gaW1wb3J0IGNvbnRleHQsIHRvIG1ha2VcbiAgICogZGVidWdnaW5nIHRoZSBlbWl0dGVkIENsb3N1cmUgdHlwZXMgYSBiaXQgZWFzaWVyLlxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZU1vZHVsZVByZWZpeChpbXBvcnRQYXRoOiBzdHJpbmcpIHtcbiAgICBjb25zdCBtb2R1bGVQcmVmaXggPSBpbXBvcnRQYXRoLnJlcGxhY2UoLyhcXC9pbmRleCk/KFxcLmQpP1xcLlt0al1zeD8kLywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9eLipbLy5dKC4rPykvLCAnJDEnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxXL2csICdfJyk7XG4gICAgcmV0dXJuIGB0c2lja2xlXyR7bW9kdWxlUHJlZml4IHx8ICdyZXFUeXBlJ31fYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmRzIHRoYXQgd2Ugd2Ugd2FudCBhIGBjb25zdCB4ID0gZ29vZy5yZXF1aXJlVHlwZS4uLmAgaW1wb3J0IG9mIHRoZSBnaXZlbiBgaW1wb3J0UGF0aGAsXG4gICAqIHdoaWNoIHdpbGwgYmUgaW5zZXJ0ZWQgd2hlbiB3ZSBlbWl0LlxuICAgKiBUaGlzIGFsc28gcmVnaXN0ZXJzIGFsaWFzZXMgZm9yIHN5bWJvbHMgZnJvbSB0aGUgbW9kdWxlIHRoYXQgbWFwIHRvIHRoaXMgcmVxdWlyZVR5cGUuXG4gICAqXG4gICAqIEBwYXJhbSBpc0RlZmF1bHRJbXBvcnQgVHJ1ZSBpZiB0aGUgaW1wb3J0IHN0YXRlbWVudCBpcyBhIGRlZmF1bHQgaW1wb3J0LCBlLmcuXG4gICAqICAgICBgaW1wb3J0IEZvbyBmcm9tIC4uLjtgLCB3aGljaCBtYXR0ZXJzIGZvciBhZGp1c3Rpbmcgd2hldGhlciB3ZSBlbWl0IGEgYC5kZWZhdWx0YC5cbiAgICovXG4gIHJlcXVpcmVUeXBlKGltcG9ydFBhdGg6IHN0cmluZywgbW9kdWxlU3ltYm9sOiB0cy5TeW1ib2wsIGlzRGVmYXVsdEltcG9ydCA9IGZhbHNlKSB7XG4gICAgaWYgKHRoaXMuaG9zdC51bnR5cGVkKSByZXR1cm47XG4gICAgLy8gQWxyZWFkeSBpbXBvcnRlZD8gRG8gbm90IGVtaXQgYSBkdXBsaWNhdGUgcmVxdWlyZVR5cGUuXG4gICAgaWYgKHRoaXMucmVxdWlyZVR5cGVNb2R1bGVzLmhhcyhtb2R1bGVTeW1ib2wpKSByZXR1cm47XG4gICAgaWYgKHR5cGVUcmFuc2xhdG9yLmlzQmxhY2tsaXN0ZWQodGhpcy5ob3N0LnR5cGVCbGFja0xpc3RQYXRocywgbW9kdWxlU3ltYm9sKSkge1xuICAgICAgcmV0dXJuOyAgLy8gRG8gbm90IGVtaXQgZ29vZy5yZXF1aXJlVHlwZSBmb3IgYmxhY2tsaXN0ZWQgcGF0aHMuXG4gICAgfVxuICAgIGNvbnN0IG5zSW1wb3J0ID0gZ29vZ21vZHVsZS5leHRyYWN0R29vZ05hbWVzcGFjZUltcG9ydChpbXBvcnRQYXRoKTtcbiAgICBjb25zdCByZXF1aXJlVHlwZVByZWZpeCA9XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVNb2R1bGVQcmVmaXgoaW1wb3J0UGF0aCkgKyBTdHJpbmcodGhpcy5yZXF1aXJlVHlwZU1vZHVsZXMuc2l6ZSArIDEpO1xuICAgIGNvbnN0IG1vZHVsZU5hbWVzcGFjZSA9IG5zSW1wb3J0ICE9PSBudWxsID9cbiAgICAgICAgbnNJbXBvcnQgOlxuICAgICAgICB0aGlzLmhvc3QucGF0aFRvTW9kdWxlTmFtZSh0aGlzLnNvdXJjZUZpbGUuZmlsZU5hbWUsIGltcG9ydFBhdGgpO1xuXG4gICAgLy8gSW4gVHlwZVNjcmlwdCwgaW1wb3J0aW5nIGEgbW9kdWxlIGZvciB1c2UgaW4gYSB0eXBlIGFubm90YXRpb24gZG9lcyBub3QgY2F1c2UgYSBydW50aW1lIGxvYWQuXG4gICAgLy8gSW4gQ2xvc3VyZSBDb21waWxlciwgZ29vZy5yZXF1aXJlJ2luZyBhIG1vZHVsZSBjYXVzZXMgYSBydW50aW1lIGxvYWQsIHNvIGVtaXR0aW5nIHJlcXVpcmVzXG4gICAgLy8gaGVyZSB3b3VsZCBjYXVzZSBhIGNoYW5nZSBpbiBsb2FkIG9yZGVyLCB3aGljaCBpcyBvYnNlcnZhYmxlIChhbmQgY2FuIGxlYWQgdG8gZXJyb3JzKS5cbiAgICAvLyBJbnN0ZWFkLCBnb29nLnJlcXVpcmVUeXBlIHR5cGVzLCB3aGljaCBhbGxvd3MgdXNpbmcgdGhlbSBpbiB0eXBlIGFubm90YXRpb25zIHdpdGhvdXRcbiAgICAvLyBjYXVzaW5nIGEgbG9hZC5cbiAgICAvLyAgIGNvbnN0IHJlcXVpcmVUeXBlUHJlZml4ID0gZ29vZy5yZXF1aXJlVHlwZShtb2R1bGVOYW1lc3BhY2UpXG4gICAgdGhpcy5hZGRpdGlvbmFsSW1wb3J0cy5wdXNoKHRzLmNyZWF0ZVZhcmlhYmxlU3RhdGVtZW50KFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHRzLmNyZWF0ZVZhcmlhYmxlRGVjbGFyYXRpb25MaXN0KFxuICAgICAgICAgICAgW3RzLmNyZWF0ZVZhcmlhYmxlRGVjbGFyYXRpb24oXG4gICAgICAgICAgICAgICAgcmVxdWlyZVR5cGVQcmVmaXgsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB0cy5jcmVhdGVDYWxsKFxuICAgICAgICAgICAgICAgICAgICB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0cy5jcmVhdGVJZGVudGlmaWVyKCdnb29nJyksICdyZXF1aXJlVHlwZScpLCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIFt0cy5jcmVhdGVMaXRlcmFsKG1vZHVsZU5hbWVzcGFjZSldKSldLFxuICAgICAgICAgICAgdHMuTm9kZUZsYWdzLkNvbnN0KSkpO1xuICAgIHRoaXMucmVxdWlyZVR5cGVNb2R1bGVzLmFkZChtb2R1bGVTeW1ib2wpO1xuICAgIGZvciAobGV0IHN5bSBvZiB0aGlzLnR5cGVDaGVja2VyLmdldEV4cG9ydHNPZk1vZHVsZShtb2R1bGVTeW1ib2wpKSB7XG4gICAgICBpZiAoc3ltLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICAgICAgc3ltID0gdGhpcy50eXBlQ2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHN5bSk7XG4gICAgICB9XG4gICAgICAvLyBnb29nOiBpbXBvcnRzIGRvbid0IGFjdHVhbGx5IHVzZSB0aGUgLmRlZmF1bHQgcHJvcGVydHkgdGhhdCBUUyB0aGlua3MgdGhleSBoYXZlLlxuICAgICAgY29uc3QgcXVhbGlmaWVkTmFtZSA9XG4gICAgICAgICAgbnNJbXBvcnQgJiYgaXNEZWZhdWx0SW1wb3J0ID8gcmVxdWlyZVR5cGVQcmVmaXggOiByZXF1aXJlVHlwZVByZWZpeCArICcuJyArIHN5bS5uYW1lO1xuICAgICAgdGhpcy5zeW1ib2xzVG9BbGlhc2VkTmFtZXMuc2V0KHN5bSwgcXVhbGlmaWVkTmFtZSk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGVuc3VyZVN5bWJvbERlY2xhcmVkKHN5bTogdHMuU3ltYm9sKSB7XG4gICAgY29uc3QgZGVjbCA9IHRoaXMuZmluZEV4cG9ydGVkRGVjbGFyYXRpb24oc3ltKTtcbiAgICBpZiAoIWRlY2wpIHJldHVybjtcbiAgICBpZiAodGhpcy5pc0ZvckV4dGVybnMpIHtcbiAgICAgIHRoaXMuZXJyb3IoZGVjbCwgYGRlY2xhcmF0aW9uIGZyb20gbW9kdWxlIHVzZWQgaW4gYW1iaWVudCB0eXBlOiAke3N5bS5uYW1lfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBBY3R1YWxseSBpbXBvcnQgdGhlIHN5bWJvbC5cbiAgICBjb25zdCBzb3VyY2VGaWxlID0gZGVjbC5nZXRTb3VyY2VGaWxlKCk7XG4gICAgaWYgKHNvdXJjZUZpbGUgPT09IHRzLmdldE9yaWdpbmFsTm9kZSh0aGlzLnNvdXJjZUZpbGUpKSByZXR1cm47XG4gICAgY29uc3QgbW9kdWxlU3ltYm9sID0gdGhpcy50eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHNvdXJjZUZpbGUpO1xuICAgIC8vIEEgc291cmNlIGZpbGUgbWlnaHQgbm90IGhhdmUgYSBzeW1ib2wgaWYgaXQncyBub3QgYSBtb2R1bGUgKG5vIEVTNiBpbS9leHBvcnRzKS5cbiAgICBpZiAoIW1vZHVsZVN5bWJvbCkgcmV0dXJuO1xuICAgIC8vIFRPRE8obWFydGlucHJvYnN0KTogdGhpcyBzaG91bGQgcG9zc2libHkgdXNlIGZpbGVOYW1lVG9Nb2R1bGVJZC5cbiAgICB0aGlzLnJlcXVpcmVUeXBlKHNvdXJjZUZpbGUuZmlsZU5hbWUsIG1vZHVsZVN5bWJvbCk7XG4gIH1cblxuICBpbnNlcnRBZGRpdGlvbmFsSW1wb3J0cyhzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSB7XG4gICAgbGV0IGluc2VydGlvbiA9IDA7XG4gICAgLy8gU2tpcCBvdmVyIGEgbGVhZGluZyBmaWxlIGNvbW1lbnQgaG9sZGVyLlxuICAgIGlmIChzb3VyY2VGaWxlLnN0YXRlbWVudHMubGVuZ3RoICYmXG4gICAgICAgIHNvdXJjZUZpbGUuc3RhdGVtZW50c1swXS5raW5kID09PSB0cy5TeW50YXhLaW5kLk5vdEVtaXR0ZWRTdGF0ZW1lbnQpIHtcbiAgICAgIGluc2VydGlvbisrO1xuICAgIH1cbiAgICByZXR1cm4gdHMudXBkYXRlU291cmNlRmlsZU5vZGUoc291cmNlRmlsZSwgW1xuICAgICAgLi4uc291cmNlRmlsZS5zdGF0ZW1lbnRzLnNsaWNlKDAsIGluc2VydGlvbiksXG4gICAgICAuLi50aGlzLmFkZGl0aW9uYWxJbXBvcnRzLFxuICAgICAgLi4uc291cmNlRmlsZS5zdGF0ZW1lbnRzLnNsaWNlKGluc2VydGlvbiksXG4gICAgXSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBzeW50aGVzaXplcyBjb21tZW50cyBvbiBub2RlLCBhbmQgcmV0dXJucyB0aGUgSlNEb2MgZnJvbSBpdCwgaWYgYW55LlxuICAgKiBAcGFyYW0gcmVwb3J0V2FybmluZ3MgaWYgdHJ1ZSwgd2lsbCByZXBvcnQgd2FybmluZ3MgZnJvbSBwYXJzaW5nIHRoZSBKU0RvYy4gU2V0IHRvIGZhbHNlIGlmXG4gICAqICAgICB0aGlzIGlzIG5vdCB0aGUgXCJtYWluXCIgbG9jYXRpb24gZGVhbGluZyB3aXRoIGEgbm9kZSB0byBhdm9pZCBkdXBsaWNhdGVkIHdhcm5pbmdzLlxuICAgKi9cbiAgZ2V0SlNEb2Mobm9kZTogdHMuTm9kZSwgcmVwb3J0V2FybmluZ3M6IGJvb2xlYW4pOiBqc2RvYy5UYWdbXSB7XG4gICAgY29uc3QgW3RhZ3MsIF0gPSB0aGlzLnBhcnNlSlNEb2Mobm9kZSwgcmVwb3J0V2FybmluZ3MpO1xuICAgIHJldHVybiB0YWdzO1xuICB9XG5cbiAgZ2V0TXV0YWJsZUpTRG9jKG5vZGU6IHRzLk5vZGUpOiBNdXRhYmxlSlNEb2Mge1xuICAgIGNvbnN0IFt0YWdzLCBjb21tZW50XSA9IHRoaXMucGFyc2VKU0RvYyhub2RlLCAvKiByZXBvcnRXYXJuaW5ncyAqLyB0cnVlKTtcbiAgICByZXR1cm4gbmV3IE11dGFibGVKU0RvYyhub2RlLCBjb21tZW50LCB0YWdzKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VKU0RvYyhub2RlOiB0cy5Ob2RlLCByZXBvcnRXYXJuaW5nczogYm9vbGVhbik6XG4gICAgICBbanNkb2MuVGFnW10sIHRzLlN5bnRoZXNpemVkQ29tbWVudHxudWxsXSB7XG4gICAgLy8gc3ludGhlc2l6ZUxlYWRpbmdDb21tZW50cyBiZWxvdyBjaGFuZ2VzIHRleHQgbG9jYXRpb25zIGZvciBub2RlLCBzbyBleHRyYWN0IHRoZSBsb2NhdGlvbiBoZXJlXG4gICAgLy8gaW4gY2FzZSBpdCBpcyBuZWVkZWQgbGF0ZXIgdG8gcmVwb3J0IGRpYWdub3N0aWNzLlxuICAgIGNvbnN0IHN0YXJ0ID0gbm9kZS5nZXRGdWxsU3RhcnQoKTtcbiAgICBjb25zdCBsZW5ndGggPSBub2RlLmdldExlYWRpbmdUcml2aWFXaWR0aCh0aGlzLnNvdXJjZUZpbGUpO1xuXG4gICAgY29uc3QgY29tbWVudHMgPSBqc2RvYy5zeW50aGVzaXplTGVhZGluZ0NvbW1lbnRzKG5vZGUpO1xuICAgIGlmICghY29tbWVudHMgfHwgY29tbWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gW1tdLCBudWxsXTtcblxuICAgIGZvciAobGV0IGkgPSBjb21tZW50cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgY29tbWVudCA9IGNvbW1lbnRzW2ldO1xuICAgICAgY29uc3QgcGFyc2VkID0ganNkb2MucGFyc2UoY29tbWVudCk7XG4gICAgICBpZiAocGFyc2VkKSB7XG4gICAgICAgIGlmIChyZXBvcnRXYXJuaW5ncyAmJiBwYXJzZWQud2FybmluZ3MpIHtcbiAgICAgICAgICBjb25zdCByYW5nZSA9IGNvbW1lbnQub3JpZ2luYWxSYW5nZSB8fCB7cG9zOiBzdGFydCwgZW5kOiBzdGFydCArIGxlbmd0aH07XG4gICAgICAgICAgcmVwb3J0RGlhZ25vc3RpYyhcbiAgICAgICAgICAgICAgdGhpcy5kaWFnbm9zdGljcywgbm9kZSwgcGFyc2VkLndhcm5pbmdzLmpvaW4oJ1xcbicpLCByYW5nZSxcbiAgICAgICAgICAgICAgdHMuRGlhZ25vc3RpY0NhdGVnb3J5Lldhcm5pbmcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbcGFyc2VkLnRhZ3MsIGNvbW1lbnRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gW1tdLCBudWxsXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIHRoZSBqc2RvYyBmb3IgbWV0aG9kcywgaW5jbHVkaW5nIG92ZXJsb2Fkcy5cbiAgICogSWYgb3ZlcmxvYWRlZCwgbWVyZ2VzIHRoZSBzaWduYXR1cmVzIGluIHRoZSBsaXN0IG9mIFNpZ25hdHVyZURlY2xhcmF0aW9ucyBpbnRvIGEgc2luZ2xlIGpzZG9jLlxuICAgKiAtIFRvdGFsIG51bWJlciBvZiBwYXJhbWV0ZXJzIHdpbGwgYmUgdGhlIG1heGltdW0gY291bnQgZm91bmQgYWNyb3NzIGFsbCB2YXJpYW50cy5cbiAgICogLSBEaWZmZXJlbnQgbmFtZXMgYXQgdGhlIHNhbWUgcGFyYW1ldGVyIGluZGV4IHdpbGwgYmUgam9pbmVkIHdpdGggXCJfb3JfXCJcbiAgICogLSBWYXJpYWJsZSBhcmdzICguLi50eXBlW10gaW4gVHlwZVNjcmlwdCkgd2lsbCBiZSBvdXRwdXQgYXMgXCIuLi50eXBlXCIsXG4gICAqICAgIGV4Y2VwdCBpZiBmb3VuZCBhdCB0aGUgc2FtZSBpbmRleCBhcyBhbm90aGVyIGFyZ3VtZW50LlxuICAgKiBAcGFyYW0gZm5EZWNscyBQYXNzID4gMSBkZWNsYXJhdGlvbiBmb3Igb3ZlcmxvYWRzIG9mIHNhbWUgbmFtZVxuICAgKiBAcmV0dXJuIFRoZSBsaXN0IG9mIHBhcmFtZXRlciBuYW1lcyB0aGF0IHNob3VsZCBiZSB1c2VkIHRvIGVtaXQgdGhlIGFjdHVhbFxuICAgKiAgICBmdW5jdGlvbiBzdGF0ZW1lbnQ7IGZvciBvdmVybG9hZHMsIG5hbWUgd2lsbCBoYXZlIGJlZW4gbWVyZ2VkLlxuICAgKi9cbiAgZ2V0RnVuY3Rpb25UeXBlSlNEb2MoZm5EZWNsczogdHMuU2lnbmF0dXJlRGVjbGFyYXRpb25bXSwgZXh0cmFUYWdzOiBqc2RvYy5UYWdbXSA9IFtdKTpcbiAgICAgIHt0YWdzOiBqc2RvYy5UYWdbXSwgcGFyYW1ldGVyTmFtZXM6IHN0cmluZ1tdLCB0aGlzUmV0dXJuVHlwZTogdHMuVHlwZXxudWxsfSB7XG4gICAgY29uc3QgdHlwZUNoZWNrZXIgPSB0aGlzLnR5cGVDaGVja2VyO1xuXG4gICAgLy8gRGUtZHVwbGljYXRlIHRhZ3MgYW5kIGRvY3MgZm91bmQgZm9yIHRoZSBmbkRlY2xzLlxuICAgIGNvbnN0IHRhZ3NCeU5hbWUgPSBuZXcgTWFwPHN0cmluZywganNkb2MuVGFnPigpO1xuICAgIGZ1bmN0aW9uIGFkZFRhZyh0YWc6IGpzZG9jLlRhZykge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0YWdzQnlOYW1lLmdldCh0YWcudGFnTmFtZSk7XG4gICAgICB0YWdzQnlOYW1lLnNldCh0YWcudGFnTmFtZSwgZXhpc3RpbmcgPyBqc2RvYy5tZXJnZShbZXhpc3RpbmcsIHRhZ10pIDogdGFnKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBleHRyYVRhZyBvZiBleHRyYVRhZ3MpIGFkZFRhZyhleHRyYVRhZyk7XG5cbiAgICBjb25zdCBpc0NvbnN0cnVjdG9yID0gZm5EZWNscy5maW5kKGQgPT4gZC5raW5kID09PSB0cy5TeW50YXhLaW5kLkNvbnN0cnVjdG9yKSAhPT0gdW5kZWZpbmVkO1xuICAgIC8vIEZvciBlYWNoIHBhcmFtZXRlciBpbmRleCBpLCBwYXJhbVRhZ3NbaV0gaXMgYW4gYXJyYXkgb2YgcGFyYW1ldGVyc1xuICAgIC8vIHRoYXQgY2FuIGJlIGZvdW5kIGF0IGluZGV4IGkuICBFLmcuXG4gICAgLy8gICAgZnVuY3Rpb24gZm9vKHg6IHN0cmluZylcbiAgICAvLyAgICBmdW5jdGlvbiBmb28oeTogbnVtYmVyLCB6OiBzdHJpbmcpXG4gICAgLy8gdGhlbiBwYXJhbVRhZ3NbMF0gPSBbaW5mbyBhYm91dCB4LCBpbmZvIGFib3V0IHldLlxuICAgIGNvbnN0IHBhcmFtVGFnczoganNkb2MuVGFnW11bXSA9IFtdO1xuICAgIGNvbnN0IHJldHVyblRhZ3M6IGpzZG9jLlRhZ1tdID0gW107XG4gICAgY29uc3QgdGhpc1RhZ3M6IGpzZG9jLlRhZ1tdID0gW107XG4gICAgY29uc3QgdHlwZVBhcmFtZXRlck5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBjb25zdCBhcmdDb3VudHMgPSBbXTtcbiAgICBsZXQgdGhpc1JldHVyblR5cGU6IHRzLlR5cGV8bnVsbCA9IG51bGw7XG4gICAgZm9yIChjb25zdCBmbkRlY2wgb2YgZm5EZWNscykge1xuICAgICAgLy8gQ29uc3RydWN0IHRoZSBKU0RvYyBjb21tZW50IGJ5IHJlYWRpbmcgdGhlIGV4aXN0aW5nIEpTRG9jLCBpZlxuICAgICAgLy8gYW55LCBhbmQgbWVyZ2luZyBpdCB3aXRoIHRoZSBrbm93biB0eXBlcyBvZiB0aGUgZnVuY3Rpb25cbiAgICAgIC8vIHBhcmFtZXRlcnMgYW5kIHJldHVybiB0eXBlLlxuICAgICAgY29uc3QgdGFncyA9IHRoaXMuZ2V0SlNEb2MoZm5EZWNsLCAvKiByZXBvcnRXYXJuaW5ncyAqLyBmYWxzZSk7XG5cbiAgICAgIC8vIENvcHkgYWxsIHRoZSB0YWdzIG90aGVyIHRoYW4gQHBhcmFtL0ByZXR1cm4gaW50byB0aGUgbmV3XG4gICAgICAvLyBKU0RvYyB3aXRob3V0IGFueSBjaGFuZ2U7IEBwYXJhbS9AcmV0dXJuIGFyZSBoYW5kbGVkIHNwZWNpYWxseS5cbiAgICAgIC8vIFRPRE86IHRoZXJlIG1heSBiZSBwcm9ibGVtcyBpZiBhbiBhbm5vdGF0aW9uIGRvZXNuJ3QgYXBwbHkgdG8gYWxsIG92ZXJsb2FkcztcbiAgICAgIC8vIGlzIGl0IHdvcnRoIGNoZWNraW5nIGZvciB0aGlzIGFuZCBlcnJvcmluZz9cbiAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICAgICAgaWYgKHRhZy50YWdOYW1lID09PSAncGFyYW0nIHx8IHRhZy50YWdOYW1lID09PSAncmV0dXJuJykgY29udGludWU7XG4gICAgICAgIGFkZFRhZyh0YWcpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmbGFncyA9IHRzLmdldENvbWJpbmVkTW9kaWZpZXJGbGFncyhmbkRlY2wpO1xuICAgICAgLy8gQWRkIEBhYnN0cmFjdCBvbiBcImFic3RyYWN0XCIgZGVjbGFyYXRpb25zLlxuICAgICAgaWYgKGZsYWdzICYgdHMuTW9kaWZpZXJGbGFncy5BYnN0cmFjdCkge1xuICAgICAgICBhZGRUYWcoe3RhZ05hbWU6ICdhYnN0cmFjdCd9KTtcbiAgICAgIH1cbiAgICAgIC8vIEFkZCBAcHJvdGVjdGVkL0Bwcml2YXRlIGlmIHByZXNlbnQuXG4gICAgICBpZiAoZmxhZ3MgJiB0cy5Nb2RpZmllckZsYWdzLlByb3RlY3RlZCkge1xuICAgICAgICBhZGRUYWcoe3RhZ05hbWU6ICdwcm90ZWN0ZWQnfSk7XG4gICAgICB9IGVsc2UgaWYgKGZsYWdzICYgdHMuTW9kaWZpZXJGbGFncy5Qcml2YXRlKSB7XG4gICAgICAgIGFkZFRhZyh7dGFnTmFtZTogJ3ByaXZhdGUnfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBhbnkgQHRlbXBsYXRlIHRhZ3MuXG4gICAgICAvLyBNdWx0aXBsZSBkZWNsYXJhdGlvbnMgd2l0aCB0aGUgc2FtZSB0ZW1wbGF0ZSB2YXJpYWJsZSBuYW1lcyBzaG91bGQgd29yazpcbiAgICAgIC8vIHRoZSBkZWNsYXJhdGlvbnMgZ2V0IHR1cm5lZCBpbnRvIHVuaW9uIHR5cGVzLCBhbmQgQ2xvc3VyZSBDb21waWxlciB3aWxsIG5lZWRcbiAgICAgIC8vIHRvIGZpbmQgYSB1bmlvbiB3aGVyZSBhbGwgdHlwZSBhcmd1bWVudHMgYXJlIHNhdGlzZmllZC5cbiAgICAgIGlmIChmbkRlY2wudHlwZVBhcmFtZXRlcnMpIHtcbiAgICAgICAgZm9yIChjb25zdCB0cCBvZiBmbkRlY2wudHlwZVBhcmFtZXRlcnMpIHtcbiAgICAgICAgICB0eXBlUGFyYW1ldGVyTmFtZXMuYWRkKGdldElkZW50aWZpZXJUZXh0KHRwLm5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gTWVyZ2UgdGhlIHBhcmFtZXRlcnMgaW50byBhIHNpbmdsZSBsaXN0IG9mIG1lcmdlZCBuYW1lcyBhbmQgbGlzdCBvZiB0eXBlc1xuICAgICAgY29uc3Qgc2lnID0gdHlwZUNoZWNrZXIuZ2V0U2lnbmF0dXJlRnJvbURlY2xhcmF0aW9uKGZuRGVjbCk7XG4gICAgICBpZiAoIXNpZyB8fCAhc2lnLmRlY2xhcmF0aW9uKSB0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgc2lnbmF0dXJlICR7Zm5EZWNsLm5hbWV9YCk7XG4gICAgICBpZiAoc2lnLmRlY2xhcmF0aW9uLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuSlNEb2NTaWduYXR1cmUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBKU0RvYyBzaWduYXR1cmUgJHtmbkRlY2wubmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIGxldCBoYXNUaGlzUGFyYW0gPSBmYWxzZTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2lnLmRlY2xhcmF0aW9uLnBhcmFtZXRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgcGFyYW1Ob2RlID0gc2lnLmRlY2xhcmF0aW9uLnBhcmFtZXRlcnNbaV07XG5cbiAgICAgICAgY29uc3QgbmFtZSA9IGdldFBhcmFtZXRlck5hbWUocGFyYW1Ob2RlLCBpKTtcbiAgICAgICAgY29uc3QgaXNUaGlzUGFyYW0gPSBuYW1lID09PSAndGhpcyc7XG4gICAgICAgIGlmIChpc1RoaXNQYXJhbSkgaGFzVGhpc1BhcmFtID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBuZXdUYWc6IGpzZG9jLlRhZyA9IHtcbiAgICAgICAgICB0YWdOYW1lOiBpc1RoaXNQYXJhbSA/ICd0aGlzJyA6ICdwYXJhbScsXG4gICAgICAgICAgb3B0aW9uYWw6IHBhcmFtTm9kZS5pbml0aWFsaXplciAhPT0gdW5kZWZpbmVkIHx8IHBhcmFtTm9kZS5xdWVzdGlvblRva2VuICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgcGFyYW1ldGVyTmFtZTogaXNUaGlzUGFyYW0gPyB1bmRlZmluZWQgOiBuYW1lLFxuICAgICAgICB9O1xuXG4gICAgICAgIGxldCB0eXBlID0gdHlwZUNoZWNrZXIuZ2V0VHlwZUF0TG9jYXRpb24ocGFyYW1Ob2RlKTtcbiAgICAgICAgaWYgKHBhcmFtTm9kZS5kb3REb3REb3RUb2tlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbmV3VGFnLnJlc3RQYXJhbSA9IHRydWU7XG4gICAgICAgICAgLy8gSW4gVHlwZVNjcmlwdCB5b3Ugd3JpdGUgXCIuLi54OiBudW1iZXJbXVwiLCBidXQgaW4gQ2xvc3VyZVxuICAgICAgICAgIC8vIHlvdSBkb24ndCB3cml0ZSB0aGUgYXJyYXk6IFwiQHBhcmFtIHsuLi5udW1iZXJ9IHhcIi4gIFVud3JhcFxuICAgICAgICAgIC8vIHRoZSBBcnJheTw+IHdyYXBwZXIuXG4gICAgICAgICAgaWYgKCh0eXBlLmZsYWdzICYgdHMuVHlwZUZsYWdzLk9iamVjdCkgPT09IDAgJiYgdHlwZS5mbGFncyAmIHRzLlR5cGVGbGFncy5UeXBlUGFyYW1ldGVyKSB7XG4gICAgICAgICAgICAvLyBmdW5jdGlvbiBmPFQgZXh0ZW5kcyBzdHJpbmdbXT4oLi4udHM6IFQpIGhhcyB0aGUgQXJyYXkgdHlwZSBvbiB0aGUgdHlwZSBwYXJhbWV0ZXJcbiAgICAgICAgICAgIC8vIGNvbnN0cmFpbnQsIG5vdCBvbiB0aGUgcGFyYW1ldGVyIGl0c2VsZi4gUmVzb2x2ZSBpdC5cbiAgICAgICAgICAgIGNvbnN0IGJhc2VDb25zdHJhaW50ID0gdHlwZUNoZWNrZXIuZ2V0QmFzZUNvbnN0cmFpbnRPZlR5cGUodHlwZSk7XG4gICAgICAgICAgICBpZiAoYmFzZUNvbnN0cmFpbnQpIHR5cGUgPSBiYXNlQ29uc3RyYWludDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHR5cGUuZmxhZ3MgJiB0cy5UeXBlRmxhZ3MuT2JqZWN0ICYmXG4gICAgICAgICAgICAgICh0eXBlIGFzIHRzLk9iamVjdFR5cGUpLm9iamVjdEZsYWdzICYgdHMuT2JqZWN0RmxhZ3MuUmVmZXJlbmNlKSB7XG4gICAgICAgICAgICBjb25zdCB0eXBlUmVmID0gdHlwZSBhcyB0cy5UeXBlUmVmZXJlbmNlO1xuICAgICAgICAgICAgaWYgKCF0eXBlUmVmLnR5cGVBcmd1bWVudHMpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZXN0IHBhcmFtZXRlciBkb2VzIG5vdCByZXNvbHZlIHRvIGEgcmVmZXJlbmNlIHR5cGUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHR5cGUgPSB0eXBlUmVmLnR5cGVBcmd1bWVudHMhWzBdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBuZXdUYWcudHlwZSA9IHRoaXMudHlwZVRvQ2xvc3VyZShmbkRlY2wsIHR5cGUpO1xuXG4gICAgICAgIGZvciAoY29uc3Qge3RhZ05hbWUsIHBhcmFtZXRlck5hbWUsIHRleHR9IG9mIHRhZ3MpIHtcbiAgICAgICAgICBpZiAodGFnTmFtZSA9PT0gJ3BhcmFtJyAmJiBwYXJhbWV0ZXJOYW1lID09PSBuZXdUYWcucGFyYW1ldGVyTmFtZSkge1xuICAgICAgICAgICAgbmV3VGFnLnRleHQgPSB0ZXh0O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghaXNUaGlzUGFyYW0pIHtcbiAgICAgICAgICBjb25zdCBwYXJhbUlkeCA9IGhhc1RoaXNQYXJhbSA/IGkgLSAxIDogaTtcbiAgICAgICAgICBpZiAoIXBhcmFtVGFnc1twYXJhbUlkeF0pIHBhcmFtVGFncy5wdXNoKFtdKTtcbiAgICAgICAgICBwYXJhbVRhZ3NbcGFyYW1JZHhdLnB1c2gobmV3VGFnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzVGFncy5wdXNoKG5ld1RhZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGFyZ0NvdW50cy5wdXNoKFxuICAgICAgICAgIGhhc1RoaXNQYXJhbSA/IHNpZy5kZWNsYXJhdGlvbi5wYXJhbWV0ZXJzLmxlbmd0aCAtIDEgOiBzaWcuZGVjbGFyYXRpb24ucGFyYW1ldGVycy5sZW5ndGgpO1xuXG4gICAgICAvLyBSZXR1cm4gdHlwZS5cbiAgICAgIGlmICghaXNDb25zdHJ1Y3Rvcikge1xuICAgICAgICBjb25zdCByZXR1cm5UYWc6IGpzZG9jLlRhZyA9IHtcbiAgICAgICAgICB0YWdOYW1lOiAncmV0dXJuJyxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgcmV0VHlwZSA9IHR5cGVDaGVja2VyLmdldFJldHVyblR5cGVPZlNpZ25hdHVyZShzaWcpO1xuICAgICAgICAvLyBHZW5lcmF0ZSBhIHRlbXBsYXRlZCBgQHRoaXNgIHRhZyBmb3IgVHlwZVNjcmlwdCBgZm9vKCk6IHRoaXNgIHJldHVybiB0eXBlIHNwZWNpZmljYXRpb24uXG4gICAgICAgIC8vIE1ha2Ugc3VyZSBub3QgdG8gZG8gdGhhdCBpZiB0aGUgZnVuY3Rpb24gYWxyZWFkeSBoYXMgdXNlZCBgQHRoaXNgIGR1ZSB0byBhIHRoaXNcbiAgICAgICAgLy8gcGFyYW1ldGVyLiBJdCdzIG5vdCBjbGVhciBob3cgdG8gcmVzb2x2ZSB0aGUgdHdvIGNvbmZsaWN0aW5nIHRoaXMgdHlwZXMgYmVzdCwgdGhlIGN1cnJlbnRcbiAgICAgICAgLy8gc29sdXRpb24gcHJlZmVycyB0aGUgZXhwbGljaXRseSBnaXZlbiBgdGhpc2AgcGFyYW1ldGVyLlxuICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IGFjY2Vzc2luZyBUUyBpbnRlcm5hbCBmaWVsZC5cbiAgICAgICAgaWYgKChyZXRUeXBlIGFzIGFueSkuaXNUaGlzVHlwZSAmJiAhaGFzVGhpc1BhcmFtKSB7XG4gICAgICAgICAgLy8gZm9vKCk6IHRoaXNcbiAgICAgICAgICB0aGlzUmV0dXJuVHlwZSA9IHJldFR5cGU7XG4gICAgICAgICAgYWRkVGFnKHt0YWdOYW1lOiAndGVtcGxhdGUnLCB0ZXh0OiAnVEhJUyd9KTtcbiAgICAgICAgICBhZGRUYWcoe3RhZ05hbWU6ICd0aGlzJywgdHlwZTogJ1RISVMnfSk7XG4gICAgICAgICAgcmV0dXJuVGFnLnR5cGUgPSAnVEhJUyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuVGFnLnR5cGUgPSB0aGlzLnR5cGVUb0Nsb3N1cmUoZm5EZWNsLCByZXRUeXBlKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHt0YWdOYW1lLCB0ZXh0fSBvZiB0YWdzKSB7XG4gICAgICAgICAgICBpZiAodGFnTmFtZSA9PT0gJ3JldHVybicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuVGFnLnRleHQgPSB0ZXh0O1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuVGFncy5wdXNoKHJldHVyblRhZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHR5cGVQYXJhbWV0ZXJOYW1lcy5zaXplID4gMCkge1xuICAgICAgYWRkVGFnKHt0YWdOYW1lOiAndGVtcGxhdGUnLCB0ZXh0OiBBcnJheS5mcm9tKHR5cGVQYXJhbWV0ZXJOYW1lcy52YWx1ZXMoKSkuam9pbignLCAnKX0pO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld0RvYyA9IEFycmF5LmZyb20odGFnc0J5TmFtZS52YWx1ZXMoKSk7XG5cbiAgICBpZiAodGhpc1RhZ3MubGVuZ3RoID4gMCkge1xuICAgICAgbmV3RG9jLnB1c2goanNkb2MubWVyZ2UodGhpc1RhZ3MpKTtcbiAgICB9XG5cbiAgICBjb25zdCBtaW5BcmdzQ291bnQgPSBNYXRoLm1pbiguLi5hcmdDb3VudHMpO1xuICAgIGNvbnN0IG1heEFyZ3NDb3VudCA9IE1hdGgubWF4KC4uLmFyZ0NvdW50cyk7XG5cbiAgICAvLyBNZXJnZSB0aGUgSlNEb2MgdGFncyBmb3IgZWFjaCBvdmVybG9hZGVkIHBhcmFtZXRlci5cbiAgICAvLyBFbnN1cmUgZWFjaCBwYXJhbWV0ZXIgaGFzIGEgdW5pcXVlIG5hbWU7IHRoZSBtZXJnaW5nIHByb2Nlc3MgY2FuIG90aGVyd2lzZVxuICAgIC8vIGFjY2lkZW50YWxseSBnZW5lcmF0ZSB0aGUgc2FtZSBwYXJhbWV0ZXIgbmFtZSB0d2ljZS5cbiAgICBjb25zdCBwYXJhbU5hbWVzID0gbmV3IFNldCgpO1xuICAgIGxldCBmb3VuZE9wdGlvbmFsID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhBcmdzQ291bnQ7IGkrKykge1xuICAgICAgY29uc3QgcGFyYW1UYWcgPSBqc2RvYy5tZXJnZShwYXJhbVRhZ3NbaV0pO1xuICAgICAgaWYgKHBhcmFtTmFtZXMuaGFzKHBhcmFtVGFnLnBhcmFtZXRlck5hbWUpKSB7XG4gICAgICAgIHBhcmFtVGFnLnBhcmFtZXRlck5hbWUgKz0gaS50b1N0cmluZygpO1xuICAgICAgfVxuICAgICAgcGFyYW1OYW1lcy5hZGQocGFyYW1UYWcucGFyYW1ldGVyTmFtZSk7XG4gICAgICAvLyBJZiB0aGUgdGFnIGlzIG9wdGlvbmFsLCBtYXJrIHBhcmFtZXRlcnMgZm9sbG93aW5nIG9wdGlvbmFsIGFzIG9wdGlvbmFsLFxuICAgICAgLy8gZXZlbiBpZiB0aGV5IGFyZSBub3QsIHNpbmNlIENsb3N1cmUgcmVzdHJpY3RzIHRoaXMsIHNlZVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvb2dsZS9jbG9zdXJlLWNvbXBpbGVyL2lzc3Vlcy8yMzE0XG4gICAgICBpZiAoIXBhcmFtVGFnLnJlc3RQYXJhbSAmJiAocGFyYW1UYWcub3B0aW9uYWwgfHwgZm91bmRPcHRpb25hbCB8fCBpID49IG1pbkFyZ3NDb3VudCkpIHtcbiAgICAgICAgZm91bmRPcHRpb25hbCA9IHRydWU7XG4gICAgICAgIHBhcmFtVGFnLm9wdGlvbmFsID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG5ld0RvYy5wdXNoKHBhcmFtVGFnKTtcbiAgICAgIGlmIChwYXJhbVRhZy5yZXN0UGFyYW0pIHtcbiAgICAgICAgLy8gQ2Fubm90IGhhdmUgYW55IHBhcmFtZXRlcnMgYWZ0ZXIgYSByZXN0IHBhcmFtLlxuICAgICAgICAvLyBKdXN0IGR1bXAgdGhlIHJlbWFpbmluZyBwYXJhbWV0ZXJzLlxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNZXJnZSB0aGUgSlNEb2MgdGFncyBmb3IgZWFjaCBvdmVybG9hZGVkIHJldHVybi5cbiAgICBpZiAoIWlzQ29uc3RydWN0b3IpIHtcbiAgICAgIG5ld0RvYy5wdXNoKGpzZG9jLm1lcmdlKHJldHVyblRhZ3MpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdGFnczogbmV3RG9jLFxuICAgICAgcGFyYW1ldGVyTmFtZXM6IG5ld0RvYy5maWx0ZXIodCA9PiB0LnRhZ05hbWUgPT09ICdwYXJhbScpLm1hcCh0ID0+IHQucGFyYW1ldGVyTmFtZSEpLFxuICAgICAgdGhpc1JldHVyblR5cGUsXG4gICAgfTtcbiAgfVxufVxuIl19