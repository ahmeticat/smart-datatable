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
        define("tsickle/src/type_translator", ["require", "exports", "path", "typescript", "tsickle/src/annotator_host", "tsickle/src/transformer_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const path = require("path");
    const ts = require("typescript");
    const annotator_host_1 = require("tsickle/src/annotator_host");
    const transformer_util_1 = require("tsickle/src/transformer_util");
    /**
     * TypeScript allows you to write identifiers quoted, like:
     *   interface Foo {
     *     'bar': string;
     *     'complex name': string;
     *   }
     *   Foo.bar;  // ok
     *   Foo['bar']  // ok
     *   Foo['complex name']  // ok
     *
     * In Closure-land, we want identify that the legal name 'bar' can become an
     * ordinary field, but we need to skip strings like 'complex name'.
     */
    function isValidClosurePropertyName(name) {
        // In local experimentation, it appears that reserved words like 'var' and
        // 'if' are legal JS and still accepted by Closure.
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    }
    exports.isValidClosurePropertyName = isValidClosurePropertyName;
    /**
     * Determines if fileName refers to a builtin lib.d.ts file.
     * This is a terrible hack but it mirrors a similar thing done in Clutz.
     */
    function isBuiltinLibDTS(fileName) {
        return fileName.match(/\blib\.(?:[^/]+\.)?d\.ts$/) != null;
    }
    exports.isBuiltinLibDTS = isBuiltinLibDTS;
    /**
     * @return True if the named type is considered compatible with the Closure-defined
     *     type of the same name, e.g. "Array".  Note that we don't actually enforce
     *     that the types are actually compatible, but mostly just hope that they are due
     *     to being derived from the same HTML specs.
     */
    function isClosureProvidedType(symbol) {
        return symbol.declarations != null &&
            symbol.declarations.some(n => isBuiltinLibDTS(n.getSourceFile().fileName));
    }
    function typeToDebugString(type) {
        let debugString = `flags:0x${type.flags.toString(16)}`;
        if (type.aliasSymbol) {
            debugString += ` alias:${symbolToDebugString(type.aliasSymbol)}`;
        }
        if (type.aliasTypeArguments) {
            debugString += ` aliasArgs:<${type.aliasTypeArguments.map(typeToDebugString).join(',')}>`;
        }
        // Just the unique flags (powers of two). Declared in src/compiler/types.ts.
        const basicTypes = [
            ts.TypeFlags.Any, ts.TypeFlags.String, ts.TypeFlags.Number,
            ts.TypeFlags.Boolean, ts.TypeFlags.Enum, ts.TypeFlags.StringLiteral,
            ts.TypeFlags.NumberLiteral, ts.TypeFlags.BooleanLiteral, ts.TypeFlags.EnumLiteral,
            ts.TypeFlags.ESSymbol, ts.TypeFlags.UniqueESSymbol, ts.TypeFlags.Void,
            ts.TypeFlags.Undefined, ts.TypeFlags.Null, ts.TypeFlags.Never,
            ts.TypeFlags.TypeParameter, ts.TypeFlags.Object, ts.TypeFlags.Union,
            ts.TypeFlags.Intersection, ts.TypeFlags.Index, ts.TypeFlags.IndexedAccess,
            ts.TypeFlags.Conditional, ts.TypeFlags.Substitution,
        ];
        for (const flag of basicTypes) {
            if ((type.flags & flag) !== 0) {
                debugString += ` ${ts.TypeFlags[flag]}`;
            }
        }
        if (type.flags === ts.TypeFlags.Object) {
            const objType = type;
            debugString += ` objectFlags:0x${objType.objectFlags}`;
            // Just the unique flags (powers of two). Declared in src/compiler/types.ts.
            const objectFlags = [
                ts.ObjectFlags.Class,
                ts.ObjectFlags.Interface,
                ts.ObjectFlags.Reference,
                ts.ObjectFlags.Tuple,
                ts.ObjectFlags.Anonymous,
                ts.ObjectFlags.Mapped,
                ts.ObjectFlags.Instantiated,
                ts.ObjectFlags.ObjectLiteral,
                ts.ObjectFlags.EvolvingArray,
                ts.ObjectFlags.ObjectLiteralPatternWithComputedProperties,
            ];
            for (const flag of objectFlags) {
                if ((objType.objectFlags & flag) !== 0) {
                    debugString += ` object:${ts.ObjectFlags[flag]}`;
                }
            }
        }
        if (type.symbol && type.symbol.name !== '__type') {
            debugString += ` symbol.name:${JSON.stringify(type.symbol.name)}`;
        }
        if (type.pattern) {
            debugString += ` destructuring:true`;
        }
        return `{type ${debugString}}`;
    }
    exports.typeToDebugString = typeToDebugString;
    function symbolToDebugString(sym) {
        let debugString = `${JSON.stringify(sym.name)} flags:0x${sym.flags.toString(16)}`;
        // Just the unique flags (powers of two). Declared in src/compiler/types.ts.
        const symbolFlags = [
            ts.SymbolFlags.FunctionScopedVariable,
            ts.SymbolFlags.BlockScopedVariable,
            ts.SymbolFlags.Property,
            ts.SymbolFlags.EnumMember,
            ts.SymbolFlags.Function,
            ts.SymbolFlags.Class,
            ts.SymbolFlags.Interface,
            ts.SymbolFlags.ConstEnum,
            ts.SymbolFlags.RegularEnum,
            ts.SymbolFlags.ValueModule,
            ts.SymbolFlags.NamespaceModule,
            ts.SymbolFlags.TypeLiteral,
            ts.SymbolFlags.ObjectLiteral,
            ts.SymbolFlags.Method,
            ts.SymbolFlags.Constructor,
            ts.SymbolFlags.GetAccessor,
            ts.SymbolFlags.SetAccessor,
            ts.SymbolFlags.Signature,
            ts.SymbolFlags.TypeParameter,
            ts.SymbolFlags.TypeAlias,
            ts.SymbolFlags.ExportValue,
            ts.SymbolFlags.Alias,
            ts.SymbolFlags.Prototype,
            ts.SymbolFlags.ExportStar,
            ts.SymbolFlags.Optional,
            ts.SymbolFlags.Transient,
        ];
        for (const flag of symbolFlags) {
            if ((sym.flags & flag) !== 0) {
                debugString += ` ${ts.SymbolFlags[flag]}`;
            }
        }
        return debugString;
    }
    exports.symbolToDebugString = symbolToDebugString;
    /**
     * Searches for an ambient module declaration in the ancestors of declarations, depth first, and
     * returns the first or null if none found.
     */
    function getContainingAmbientModuleDeclaration(declarations) {
        for (const declaration of declarations) {
            let parent = declaration.parent;
            while (parent) {
                if (ts.isModuleDeclaration(parent) && ts.isStringLiteral(parent.name)) {
                    return parent;
                }
                parent = parent.parent;
            }
        }
        return null;
    }
    /** Returns true if any of declarations is a top level declaration in an external module. */
    function isTopLevelExternal(declarations) {
        for (const declaration of declarations) {
            if (declaration.parent === undefined)
                continue;
            if (ts.isSourceFile(declaration.parent) && ts.isExternalModule(declaration.parent))
                return true;
        }
        return false;
    }
    /**
     * Returns true if a and b are (or were originally before transformation) nodes of the same source
     * file.
     */
    function isDeclaredInSameFile(a, b) {
        return ts.getOriginalNode(a).getSourceFile() === ts.getOriginalNode(b).getSourceFile();
    }
    /** TypeTranslator translates TypeScript types to Closure types. */
    class TypeTranslator {
        /**
         * @param node is the source AST ts.Node the type comes from.  This is used
         *     in some cases (e.g. anonymous types) for looking up field names.
         * @param pathBlackList is a set of paths that should never get typed;
         *     any reference to symbols defined in these paths should by typed
         *     as {?}.
         * @param symbolsToAliasedNames a mapping from symbols (`Foo`) to a name in scope they should be
         *     emitted as (e.g. `tsickle_reqType_1.Foo`). Can be augmented during type translation, e.g.
         *     to blacklist a symbol.
         */
        constructor(host, typeChecker, node, pathBlackList, symbolsToAliasedNames = new Map(), ensureSymbolDeclared = () => { }) {
            this.host = host;
            this.typeChecker = typeChecker;
            this.node = node;
            this.pathBlackList = pathBlackList;
            this.symbolsToAliasedNames = symbolsToAliasedNames;
            this.ensureSymbolDeclared = ensureSymbolDeclared;
            /**
             * A list of type literals we've encountered while emitting; used to avoid getting stuck in
             * recursive types.
             */
            this.seenAnonymousTypes = new Set();
            /**
             * Whether to write types suitable for an \@externs file. Externs types must not refer to
             * non-externs types (i.e. non ambient types) and need to use fully qualified names.
             */
            this.isForExterns = false;
            // Normalize paths to not break checks on Windows.
            if (this.pathBlackList != null) {
                this.pathBlackList =
                    new Set(Array.from(this.pathBlackList.values()).map(p => path.normalize(p)));
            }
        }
        /**
         * Converts a ts.Symbol to a string, applying aliases and ensuring symbols are imported.
         * @return a string representation of the symbol as a valid Closure type name, or `undefined` if
         *     the type cannot be expressed (e.g. for anonymous types).
         */
        symbolToString(sym) {
            // TypeScript resolves e.g. union types to their members, which can include symbols not declared
            // in the current scope. Ensure that all symbols found this way are actually declared.
            // This must happen before the alias check below, it might introduce a new alias for the symbol.
            if (!this.isForExterns && (sym.flags & ts.SymbolFlags.TypeParameter) === 0) {
                this.ensureSymbolDeclared(sym);
            }
            const name = this.typeChecker.symbolToEntityName(sym, ts.SymbolFlags.Type, this.node, ts.NodeBuilderFlags.UseFullyQualifiedType);
            // name might be undefined, e.g. for anonymous classes.
            if (!name)
                return undefined;
            let str = '';
            /** Recursively visits components of entity name and writes them to `str` above. */
            const writeEntityWithSymbols = (name) => {
                let identifier;
                if (ts.isQualifiedName(name)) {
                    writeEntityWithSymbols(name.left);
                    str += '.';
                    identifier = name.right;
                }
                else {
                    identifier = name;
                }
                let symbol = identifier.symbol;
                // When writing a symbol, check if there is an alias for it in the current scope that should
                // take precedence, e.g. from a goog.requireType.
                if (symbol.flags & ts.SymbolFlags.Alias) {
                    symbol = this.typeChecker.getAliasedSymbol(symbol);
                }
                const alias = this.symbolsToAliasedNames.get(symbol);
                if (alias) {
                    // If so, discard the entire current text and only use the alias - otherwise if a symbol has
                    // a local alias but appears in a dotted type path (e.g. when it's imported using import *
                    // as foo), str would contain both the prefx *and* the full alias (foo.alias.name).
                    str = alias;
                    return;
                }
                let text = transformer_util_1.getIdentifierText(identifier);
                if (str.length === 0) {
                    const mangledPrefix = this.maybeGetMangledNamePrefix(symbol);
                    text = mangledPrefix + text;
                }
                str += text;
            };
            writeEntityWithSymbols(name);
            return this.stripClutzNamespace(str);
        }
        /**
         * Returns the mangled name prefix for symbol, or an empty string if not applicable.
         *
         * Type names are emitted with a mangled prefix if they are top level symbols declared in an
         * external module (.d.ts or .ts), and are ambient declarations ("declare ..."). This is because
         * their declarations get moved to externs files (to make external names visible to Closure and
         * prevent renaming), which only use global names. This means the names must be mangled to prevent
         * collisions and allow referencing them uniquely.
         *
         * This method also handles the special case of symbols declared in an ambient external module
         * context.
         *
         * Symbols declared in a global block, e.g. "declare global { type X; }", are handled implicitly:
         * when referenced, they are written as just "X", which is not a top level declaration, so the
         * code below ignores them.
         */
        maybeGetMangledNamePrefix(symbol) {
            if (!symbol.declarations)
                return '';
            const declarations = symbol.declarations;
            let ambientModuleDeclaration = null;
            // If the symbol is neither a top level declaration in an external module nor in an ambient
            // block, tsickle should not emit a prefix: it's either not an external symbol, or it's an
            // external symbol nested in a module, so it will need to be qualified, and the mangling prefix
            // goes on the qualifier.
            if (!isTopLevelExternal(declarations)) {
                ambientModuleDeclaration = getContainingAmbientModuleDeclaration(declarations);
                if (!ambientModuleDeclaration)
                    return '';
            }
            // At this point, the declaration is from an external module (possibly ambient).
            // These declarations must be prefixed if either:
            // (a) tsickle is emitting an externs file, so all symbols are qualified within it
            // (b) or the declaration must be an exported ambient declaration from the local file.
            // Ambient external declarations from other files are imported, so there's a local alias for the
            // module and no mangling is needed.
            if (!this.isForExterns &&
                !declarations.every(d => isDeclaredInSameFile(this.node, d) && transformer_util_1.isAmbient(d) &&
                    transformer_util_1.hasModifierFlag(d, ts.ModifierFlags.Export))) {
                return '';
            }
            // If from an ambient declaration, use and resolve the name from that. Otherwise, use the file
            // name from the (arbitrary) first declaration to mangle.
            const fileName = ambientModuleDeclaration ?
                ambientModuleDeclaration.name.text :
                ts.getOriginalNode(declarations[0]).getSourceFile().fileName;
            const mangled = annotator_host_1.moduleNameAsIdentifier(this.host, fileName);
            return mangled + '.';
        }
        // Clutz (https://github.com/angular/clutz) emits global type symbols hidden in a special
        // ಠ_ಠ.clutz namespace. While most code seen by Tsickle will only ever see local aliases, Clutz
        // symbols can be written by users directly in code, and they can appear by dereferencing
        // TypeAliases. The code below simply strips the prefix, the remaining type name then matches
        // Closure's type.
        stripClutzNamespace(name) {
            if (name.startsWith('ಠ_ಠ.clutz.'))
                return name.substring('ಠ_ಠ.clutz.'.length);
            return name;
        }
        translate(type) {
            // NOTE: Though type.flags has the name "flags", it usually can only be one
            // of the enum options at a time (except for unions of literal types, e.g. unions of boolean
            // values, string values, enum values). This switch handles all the cases in the ts.TypeFlags
            // enum in the order they occur.
            // NOTE: Some TypeFlags are marked "internal" in the d.ts but still show up in the value of
            // type.flags. This mask limits the flag checks to the ones in the public API. "lastFlag" here
            // is the last flag handled in this switch statement, and should be kept in sync with
            // typescript.d.ts.
            // NonPrimitive occurs on its own on the lower case "object" type. Special case to "!Object".
            if (type.flags === ts.TypeFlags.NonPrimitive)
                return '!Object';
            // Avoid infinite loops on recursive type literals.
            // It would be nice to just emit the name of the recursive type here (in type.aliasSymbol
            // below), but Closure Compiler does not allow recursive type definitions.
            if (this.seenAnonymousTypes.has(type))
                return '?';
            let isAmbient = false;
            let isInNamespace = false;
            let isModule = false;
            if (type.symbol) {
                for (const decl of type.symbol.declarations || []) {
                    if (ts.isExternalModule(decl.getSourceFile()))
                        isModule = true;
                    if (decl.getSourceFile().isDeclarationFile)
                        isAmbient = true;
                    let current = decl;
                    while (current) {
                        if (ts.getCombinedModifierFlags(current) & ts.ModifierFlags.Ambient)
                            isAmbient = true;
                        if (current.kind === ts.SyntaxKind.ModuleDeclaration)
                            isInNamespace = true;
                        current = current.parent;
                    }
                }
            }
            // tsickle cannot generate types for non-ambient namespaces nor any symbols contained in them.
            if (isInNamespace && !isAmbient)
                return '?';
            // Types in externs cannot reference types from external modules.
            // However ambient types in modules get moved to externs, too, so type references work and we
            // can emit a precise type.
            if (this.isForExterns && isModule && !isAmbient)
                return '?';
            const lastFlag = ts.TypeFlags.Substitution;
            const mask = (lastFlag << 1) - 1;
            switch (type.flags & mask) {
                case ts.TypeFlags.Any:
                    return '?';
                case ts.TypeFlags.Unknown:
                    return '*';
                case ts.TypeFlags.String:
                case ts.TypeFlags.StringLiteral:
                    return 'string';
                case ts.TypeFlags.Number:
                case ts.TypeFlags.NumberLiteral:
                    return 'number';
                case ts.TypeFlags.Boolean:
                case ts.TypeFlags.BooleanLiteral:
                    // See the note in translateUnion about booleans.
                    return 'boolean';
                case ts.TypeFlags.Enum:
                    if (!type.symbol) {
                        this.warn(`EnumType without a symbol`);
                        return '?';
                    }
                    return this.symbolToString(type.symbol) || '?';
                case ts.TypeFlags.ESSymbol:
                case ts.TypeFlags.UniqueESSymbol:
                    // ESSymbol indicates something typed symbol.
                    // UniqueESSymbol indicates a specific unique symbol, used e.g. to index into an object.
                    // Closure does not have this distinction, so tsickle emits both as 'symbol'.
                    return 'symbol';
                case ts.TypeFlags.Void:
                    return 'void';
                case ts.TypeFlags.Undefined:
                    return 'undefined';
                case ts.TypeFlags.BigInt:
                    return 'bigintPlaceholder';
                case ts.TypeFlags.Null:
                    return 'null';
                case ts.TypeFlags.Never:
                    this.warn(`should not emit a 'never' type`);
                    return '?';
                case ts.TypeFlags.TypeParameter:
                    // This is e.g. the T in a type like Foo<T>.
                    if (!type.symbol) {
                        this.warn(`TypeParameter without a symbol`); // should not happen (tm)
                        return '?';
                    }
                    // In Closure, type parameters ("<T>") are non-nullable by default, unlike references to
                    // classes or interfaces. However this code path can be reached by bound type parameters,
                    // where the type parameter's symbol references a plain class or interface. In this case,
                    // add `!` to avoid emitting a nullable type.
                    let prefix = '';
                    if ((type.symbol.flags & ts.SymbolFlags.TypeParameter) === 0) {
                        prefix = '!';
                    }
                    const name = this.symbolToString(type.symbol);
                    if (!name)
                        return '?';
                    return prefix + name;
                case ts.TypeFlags.Object:
                    return this.translateObject(type);
                case ts.TypeFlags.Union:
                    return this.translateUnion(type);
                case ts.TypeFlags.Conditional:
                case ts.TypeFlags.Substitution:
                    this.warn(`emitting ? for conditional/substitution type`);
                    return '?';
                case ts.TypeFlags.Intersection:
                case ts.TypeFlags.Index:
                case ts.TypeFlags.IndexedAccess:
                    // TODO(ts2.1): handle these special types.
                    this.warn(`unhandled type flags: ${ts.TypeFlags[type.flags]}`);
                    return '?';
                default:
                    // Handle cases where multiple flags are set.
                    // Types with literal members are represented as
                    //   ts.TypeFlags.Union | [literal member]
                    // E.g. an enum typed value is a union type with the enum's members as its members. A
                    // boolean type is a union type with 'true' and 'false' as its members.
                    // Note also that in a more complex union, e.g. boolean|number, then it's a union of three
                    // things (true|false|number) and ts.TypeFlags.Boolean doesn't show up at all.
                    if (type.flags & ts.TypeFlags.Union) {
                        return this.translateUnion(type);
                    }
                    if (type.flags & ts.TypeFlags.EnumLiteral) {
                        return this.translateEnumLiteral(type);
                    }
                    // The switch statement should have been exhaustive.
                    throw new Error(`unknown type flags ${type.flags} on ${typeToDebugString(type)}`);
            }
        }
        translateUnion(type) {
            let parts = type.types.map(t => this.translate(t));
            // Union types that include literals (e.g. boolean, enum) can end up repeating the same Closure
            // type. For example: true | boolean will be translated to boolean | boolean.
            // Remove duplicates to produce types that read better.
            parts = parts.filter((el, idx) => parts.indexOf(el) === idx);
            return parts.length === 1 ? parts[0] : `(${parts.join('|')})`;
        }
        translateEnumLiteral(type) {
            // Suppose you had:
            //   enum EnumType { MEMBER }
            // then the type of "EnumType.MEMBER" is an enum literal (the thing passed to this function)
            // and it has type flags that include
            //   ts.TypeFlags.NumberLiteral | ts.TypeFlags.EnumLiteral
            //
            // Closure Compiler doesn't support literals in types, so this code must not emit
            // "EnumType.MEMBER", but rather "EnumType".
            const enumLiteralBaseType = this.typeChecker.getBaseTypeOfLiteralType(type);
            if (!enumLiteralBaseType.symbol) {
                this.warn(`EnumLiteralType without a symbol`);
                return '?';
            }
            let symbol = enumLiteralBaseType.symbol;
            if (enumLiteralBaseType === type) {
                // TypeScript's API will return the same EnumLiteral type if the enum only has a single member
                // value. See https://github.com/Microsoft/TypeScript/issues/28869.
                // In that case, take the parent symbol of the enum member, which should be the enum
                // declaration.
                // tslint:disable-next-line:no-any working around a TS API deficiency.
                const parent = symbol.parent;
                if (!parent)
                    return '?';
                symbol = parent;
            }
            const name = this.symbolToString(symbol);
            if (!name)
                return '?';
            // In Closure, enum types are non-null by default, so we wouldn't need to emit the `!` here.
            // However that's confusing to users, to the point that style guides and linters require to
            // *always* specify the nullability modifier. To be consistent with that style, include it here
            // as well.
            return '!' + name;
        }
        // translateObject translates a ts.ObjectType, which is the type of all
        // object-like things in TS, such as classes and interfaces.
        translateObject(type) {
            if (type.symbol && this.isBlackListed(type.symbol))
                return '?';
            // NOTE: objectFlags is an enum, but a given type can have multiple flags.
            // Array<string> is both ts.ObjectFlags.Reference and ts.ObjectFlags.Interface.
            if (type.objectFlags & ts.ObjectFlags.Class) {
                if (!type.symbol) {
                    this.warn('class has no symbol');
                    return '?';
                }
                const name = this.symbolToString(type.symbol);
                if (!name) {
                    // An anonymous type. Make sure not to emit '!?', as that is a syntax error in Closure
                    // Compiler.
                    return '?';
                }
                return '!' + name;
            }
            else if (type.objectFlags & ts.ObjectFlags.Interface) {
                // Note: ts.InterfaceType has a typeParameters field, but that
                // specifies the parameters that the interface type *expects*
                // when it's used, and should not be transformed to the output.
                // E.g. a type like Array<number> is a TypeReference to the
                // InterfaceType "Array", but the "number" type parameter is
                // part of the outer TypeReference, not a typeParameter on
                // the InterfaceType.
                if (!type.symbol) {
                    this.warn('interface has no symbol');
                    return '?';
                }
                if (type.symbol.flags & ts.SymbolFlags.Value) {
                    // The symbol is both a type and a value.
                    // For user-defined types in this state, we don't have a Closure name
                    // for the type.  See the type_and_value test.
                    if (!isClosureProvidedType(type.symbol)) {
                        this.warn(`type/symbol conflict for ${type.symbol.name}, using {?} for now`);
                        return '?';
                    }
                }
                return '!' + this.symbolToString(type.symbol);
            }
            else if (type.objectFlags & ts.ObjectFlags.Reference) {
                // A reference to another type, e.g. Array<number> refers to Array.
                // Emit the referenced type and any type arguments.
                const referenceType = type;
                // A tuple is a ReferenceType where the target is flagged Tuple and the
                // typeArguments are the tuple arguments.  Just treat it as a mystery
                // array, because Closure doesn't understand tuples.
                if (referenceType.target.objectFlags & ts.ObjectFlags.Tuple) {
                    return '!Array<?>';
                }
                let typeStr = '';
                if (referenceType.target === referenceType) {
                    // We get into an infinite loop here if the inner reference is
                    // the same as the outer; this can occur when this function
                    // fails to translate a more specific type before getting to
                    // this point.
                    throw new Error(`reference loop in ${typeToDebugString(referenceType)} ${referenceType.flags}`);
                }
                typeStr += this.translate(referenceType.target);
                // Translate can return '?' for a number of situations, e.g. type/value conflicts.
                // `?<?>` is illegal syntax in Closure Compiler, so just return `?` here.
                if (typeStr === '?')
                    return '?';
                if (referenceType.typeArguments) {
                    const params = referenceType.typeArguments.map(t => this.translate(t));
                    typeStr += `<${params.join(', ')}>`;
                }
                return typeStr;
            }
            else if (type.objectFlags & ts.ObjectFlags.Anonymous) {
                if (!type.symbol) {
                    // This comes up when generating code for an arrow function as passed
                    // to a generic function.  The passed-in type is tagged as anonymous
                    // and has no properties so it's hard to figure out what to generate.
                    // Just avoid it for now so we don't crash.
                    this.warn('anonymous type has no symbol');
                    return '?';
                }
                if (type.symbol.flags & ts.SymbolFlags.Function ||
                    type.symbol.flags & ts.SymbolFlags.Method) {
                    const sigs = this.typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call);
                    if (sigs.length === 1) {
                        return this.signatureToClosure(sigs[0]);
                    }
                    this.warn('unhandled anonymous type with multiple call signatures');
                    return '?';
                }
                else {
                    return this.translateAnonymousType(type);
                }
            }
            /*
            TODO(ts2.1): more unhandled object type flags:
              Tuple
              Mapped
              Instantiated
              ObjectLiteral
              EvolvingArray
              ObjectLiteralPatternWithComputedProperties
            */
            this.warn(`unhandled type ${typeToDebugString(type)}`);
            return '?';
        }
        /**
         * translateAnonymousType translates a ts.TypeFlags.ObjectType that is also
         * ts.ObjectFlags.Anonymous. That is, this type's symbol does not have a name. This is the
         * anonymous type encountered in e.g.
         *     let x: {a: number};
         * But also the inferred type in:
         *     let x = {a: 1};  // type of x is {a: number}, as above
         */
        translateAnonymousType(type) {
            this.seenAnonymousTypes.add(type);
            // Gather up all the named fields and whether the object is also callable.
            let callable = false;
            let indexable = false;
            const fields = [];
            if (!type.symbol || !type.symbol.members) {
                this.warn('anonymous type has no symbol');
                return '?';
            }
            // special-case construct signatures.
            const ctors = type.getConstructSignatures();
            if (ctors.length) {
                // TODO(martinprobst): this does not support additional properties defined on constructors
                // (not expressible in Closure), nor multiple constructors (same).
                const decl = ctors[0].declaration;
                if (!decl) {
                    this.warn('unhandled anonymous type with constructor signature but no declaration');
                    return '?';
                }
                if (decl.kind === ts.SyntaxKind.JSDocSignature) {
                    this.warn('unhandled JSDoc based constructor signature');
                    return '?';
                }
                // new <T>(tee: T) is not supported by Closure, blacklist as ?.
                this.blacklistTypeParameters(this.symbolsToAliasedNames, decl.typeParameters);
                const params = this.convertParams(ctors[0], decl.parameters);
                const paramsStr = params.length ? (', ' + params.join(', ')) : '';
                const constructedType = this.translate(ctors[0].getReturnType());
                // In the specific case of the "new" in a function, it appears that
                //   function(new: !Bar)
                // fails to parse, while
                //   function(new: (!Bar))
                // parses in the way you'd expect.
                // It appears from testing that Closure ignores the ! anyway and just
                // assumes the result will be non-null in either case.  (To be pedantic,
                // it's possible to return null from a ctor it seems like a bad idea.)
                return `function(new: (${constructedType})${paramsStr}): ?`;
            }
            // members is an ES6 map, but the .d.ts defining it defined their own map
            // type, so typescript doesn't believe that .keys() is iterable
            // tslint:disable-next-line:no-any
            for (const field of type.symbol.members.keys()) {
                switch (field) {
                    case '__call':
                        callable = true;
                        break;
                    case '__index':
                        indexable = true;
                        break;
                    default:
                        if (!isValidClosurePropertyName(field)) {
                            this.warn(`omitting inexpressible property name: ${field}`);
                            continue;
                        }
                        const member = type.symbol.members.get(field);
                        // optional members are handled by the type including |undefined in a union type.
                        const memberType = this.translate(this.typeChecker.getTypeOfSymbolAtLocation(member, this.node));
                        fields.push(`${field}: ${memberType}`);
                        break;
                }
            }
            // Try to special-case plain key-value objects and functions.
            if (fields.length === 0) {
                if (callable && !indexable) {
                    // A function type.
                    const sigs = this.typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call);
                    if (sigs.length === 1) {
                        return this.signatureToClosure(sigs[0]);
                    }
                }
                else if (indexable && !callable) {
                    // A plain key-value map type.
                    let keyType = 'string';
                    let valType = this.typeChecker.getIndexTypeOfType(type, ts.IndexKind.String);
                    if (!valType) {
                        keyType = 'number';
                        valType = this.typeChecker.getIndexTypeOfType(type, ts.IndexKind.Number);
                    }
                    if (!valType) {
                        this.warn('unknown index key type');
                        return `!Object<?,?>`;
                    }
                    return `!Object<${keyType},${this.translate(valType)}>`;
                }
                else if (!callable && !indexable) {
                    // The object has no members.  This is the TS type '{}',
                    // which means "any value other than null or undefined".
                    // What is this in Closure's type system?
                    //
                    // First, {!Object} is wrong because it is not a supertype of
                    // {string} or {number}.  This would mean you cannot assign a
                    // number to a variable of TS type {}.
                    //
                    // We get closer with {*}, aka the ALL type.  This one better
                    // captures the typical use of the TS {}, which users use for
                    // "I don't care".
                    //
                    // {*} unfortunately does include null/undefined, so it's a closer
                    // match for TS 3.0's 'unknown'.
                    return '*';
                }
            }
            if (!callable && !indexable) {
                // Not callable, not indexable; implies a plain object with fields in it.
                return `{${fields.join(', ')}}`;
            }
            this.warn('unhandled anonymous type');
            return '?';
        }
        /** Converts a ts.Signature (function signature) to a Closure function type. */
        signatureToClosure(sig) {
            // TODO(martinprobst): Consider harmonizing some overlap with emitFunctionType in tsickle.ts.
            if (!sig.declaration) {
                this.warn('signature without declaration');
                return 'Function';
            }
            if (sig.declaration.kind === ts.SyntaxKind.JSDocSignature) {
                this.warn('signature with JSDoc declaration');
                return 'Function';
            }
            this.blacklistTypeParameters(this.symbolsToAliasedNames, sig.declaration.typeParameters);
            let typeStr = `function(`;
            let paramDecls = sig.declaration.parameters || [];
            const maybeThisParam = paramDecls[0];
            // Oddly, the this type shows up in paramDecls, but not in the type's parameters.
            // Handle it here and then pass paramDecls down without its first element.
            if (maybeThisParam && maybeThisParam.name.getText() === 'this') {
                if (maybeThisParam.type) {
                    const thisType = this.typeChecker.getTypeAtLocation(maybeThisParam.type);
                    typeStr += `this: (${this.translate(thisType)})`;
                    if (paramDecls.length > 1)
                        typeStr += ', ';
                }
                else {
                    this.warn('this type without type');
                }
                paramDecls = paramDecls.slice(1);
            }
            const params = this.convertParams(sig, paramDecls);
            typeStr += `${params.join(', ')})`;
            const retType = this.translate(this.typeChecker.getReturnTypeOfSignature(sig));
            if (retType) {
                typeStr += `: ${retType}`;
            }
            return typeStr;
        }
        /**
         * Converts parameters for the given signature. Takes parameter declarations as those might not
         * match the signature parameters (e.g. there might be an additional this parameter). This
         * difference is handled by the caller, as is converting the "this" parameter.
         */
        convertParams(sig, paramDecls) {
            const paramTypes = [];
            for (let i = 0; i < sig.parameters.length; i++) {
                const param = sig.parameters[i];
                const paramDecl = paramDecls[i];
                const optional = !!paramDecl.questionToken;
                const varArgs = !!paramDecl.dotDotDotToken;
                let paramType = this.typeChecker.getTypeOfSymbolAtLocation(param, this.node);
                if (varArgs) {
                    if ((paramType.flags & ts.TypeFlags.Object) === 0) {
                        this.warn('var args type is not an object type');
                        paramTypes.push('!Array<?>');
                        continue;
                    }
                    if ((paramType.objectFlags & ts.ObjectFlags.Reference) === 0) {
                        this.warn('unsupported var args type (not an array reference)');
                        paramTypes.push('!Array<?>');
                        continue;
                    }
                    const typeRef = paramType;
                    if (!typeRef.typeArguments) {
                        // When a rest argument resolves empty, i.e. the concrete instantiation does not take any
                        // arguments, the type arguments are empty. Emit a function type that takes no arg in this
                        // position then.
                        continue;
                    }
                    paramType = typeRef.typeArguments[0];
                }
                let typeStr = this.translate(paramType);
                if (varArgs)
                    typeStr = '...' + typeStr;
                if (optional)
                    typeStr = typeStr + '=';
                paramTypes.push(typeStr);
            }
            return paramTypes;
        }
        warn(msg) {
            // By default, warn() does nothing.  The caller will overwrite this
            // if it wants different behavior.
        }
        /** @return true if sym should always have type {?}. */
        isBlackListed(symbol) {
            return isBlacklisted(this.pathBlackList, symbol);
        }
        /**
         * Closure doesn not support type parameters for function types, i.e. generic function types.
         * Blacklist the symbols declared by them and emit a ? for the types.
         *
         * This mutates the given blacklist map. The map's scope is one file, and symbols are
         * unique objects, so this should neither lead to excessive memory consumption nor introduce
         * errors.
         *
         * @param blacklist a map to store the blacklisted symbols in, with a value of '?'. In practice,
         *     this is always === this.symbolsToAliasedNames, but we're passing it explicitly to make it
         *    clear that the map is mutated (in particular when used from outside the class).
         * @param decls the declarations whose symbols should be blacklisted.
         */
        blacklistTypeParameters(blacklist, decls) {
            if (!decls || !decls.length)
                return;
            for (const tpd of decls) {
                const sym = this.typeChecker.getSymbolAtLocation(tpd.name);
                if (!sym) {
                    this.warn(`type parameter with no symbol`);
                    continue;
                }
                blacklist.set(sym, '?');
            }
        }
    }
    exports.TypeTranslator = TypeTranslator;
    /** @return true if sym should always have type {?}. */
    function isBlacklisted(pathBlackList, symbol) {
        if (pathBlackList === undefined)
            return false;
        // Some builtin types, such as {}, get represented by a symbol that has no declarations.
        if (symbol.declarations === undefined)
            return false;
        return symbol.declarations.every(n => {
            const fileName = path.normalize(n.getSourceFile().fileName);
            return pathBlackList.has(fileName);
        });
    }
    exports.isBlacklisted = isBlacklisted;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV90cmFuc2xhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3R5cGVfdHJhbnNsYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUVILDZCQUE2QjtJQUM3QixpQ0FBaUM7SUFFakMsK0RBQXVFO0lBQ3ZFLG1FQUFpRjtJQUVqRjs7Ozs7Ozs7Ozs7O09BWUc7SUFDSCxTQUFnQiwwQkFBMEIsQ0FBQyxJQUFZO1FBQ3JELDBFQUEwRTtRQUMxRSxtREFBbUQ7UUFDbkQsT0FBTywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUpELGdFQUlDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsZUFBZSxDQUFDLFFBQWdCO1FBQzlDLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLElBQUksQ0FBQztJQUM3RCxDQUFDO0lBRkQsMENBRUM7SUFFRDs7Ozs7T0FLRztJQUNILFNBQVMscUJBQXFCLENBQUMsTUFBaUI7UUFDOUMsT0FBTyxNQUFNLENBQUMsWUFBWSxJQUFJLElBQUk7WUFDOUIsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUVELFNBQWdCLGlCQUFpQixDQUFDLElBQWE7UUFDN0MsSUFBSSxXQUFXLEdBQUcsV0FBVyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBRXZELElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNwQixXQUFXLElBQUksVUFBVSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztTQUNsRTtRQUNELElBQUksSUFBSSxDQUFDLGtCQUFr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RyxDQUFDLENBQUM7YUFDekI7UUFDSCxDQUFDO0tBQ0Y7SUE3cUJELHdDQTZxQkM7SUFFRCx1REFBdUQ7SUFDdkQsU0FBZ0IsYUFBYSxDQUFDLGFBQW9DLEVBQUUsTUFBaUI7UUFDbkYsSUFBSSxhQUFhLEtBQUssU0FBUztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzlDLHdGQUF3RjtRQUN4RixJQUFJLE1BQU0sQ0FBQyxZQUFZLEtBQUssU0FBUztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3BELE9BQU8sTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDbkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDNUQsT0FBTyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQVJELHNDQVFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7QW5ub3RhdG9ySG9zdCwgbW9kdWxlTmFtZUFzSWRlbnRpZmllcn0gZnJvbSAnLi9hbm5vdGF0b3JfaG9zdCc7XG5pbXBvcnQge2dldElkZW50aWZpZXJUZXh0LCBoYXNNb2RpZmllckZsYWcsIGlzQW1iaWVudH0gZnJvbSAnLi90cmFuc2Zvcm1lcl91dGlsJztcblxuLyoqXG4gKiBUeXBlU2NyaXB0IGFsbG93cyB5b3UgdG8gd3JpdGUgaWRlbnRpZmllcnMgcXVvdGVkLCBsaWtlOlxuICogICBpbnRlcmZhY2UgRm9vIHtcbiAqICAgICAnYmFyJzogc3RyaW5nO1xuICogICAgICdjb21wbGV4IG5hbWUnOiBzdHJpbmc7XG4gKiAgIH1cbiAqICAgRm9vLmJhcjsgIC8vIG9rXG4gKiAgIEZvb1snYmFyJ10gIC8vIG9rXG4gKiAgIEZvb1snY29tcGxleCBuYW1lJ10gIC8vIG9rXG4gKlxuICogSW4gQ2xvc3VyZS1sYW5kLCB3ZSB3YW50IGlkZW50aWZ5IHRoYXQgdGhlIGxlZ2FsIG5hbWUgJ2JhcicgY2FuIGJlY29tZSBhblxuICogb3JkaW5hcnkgZmllbGQsIGJ1dCB3ZSBuZWVkIHRvIHNraXAgc3RyaW5ncyBsaWtlICdjb21wbGV4IG5hbWUnLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZENsb3N1cmVQcm9wZXJ0eU5hbWUobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIC8vIEluIGxvY2FsIGV4cGVyaW1lbnRhdGlvbiwgaXQgYXBwZWFycyB0aGF0IHJlc2VydmVkIHdvcmRzIGxpa2UgJ3ZhcicgYW5kXG4gIC8vICdpZicgYXJlIGxlZ2FsIEpTIGFuZCBzdGlsbCBhY2NlcHRlZCBieSBDbG9zdXJlLlxuICByZXR1cm4gL15bYS16QS1aX11bYS16QS1aMC05X10qJC8udGVzdChuYW1lKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGZpbGVOYW1lIHJlZmVycyB0byBhIGJ1aWx0aW4gbGliLmQudHMgZmlsZS5cbiAqIFRoaXMgaXMgYSB0ZXJyaWJsZSBoYWNrIGJ1dCBpdCBtaXJyb3JzIGEgc2ltaWxhciB0aGluZyBkb25lIGluIENsdXR6LlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCdWlsdGluTGliRFRTKGZpbGVOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIGZpbGVOYW1lLm1hdGNoKC9cXGJsaWJcXC4oPzpbXi9dK1xcLik/ZFxcLnRzJC8pICE9IG51bGw7XG59XG5cbi8qKlxuICogQHJldHVybiBUcnVlIGlmIHRoZSBuYW1lZCB0eXBlIGlzIGNvbnNpZGVyZWQgY29tcGF0aWJsZSB3aXRoIHRoZSBDbG9zdXJlLWRlZmluZWRcbiAqICAgICB0eXBlIG9mIHRoZSBzYW1lIG5hbWUsIGUuZy4gXCJBcnJheVwiLiAgTm90ZSB0aGF0IHdlIGRvbid0IGFjdHVhbGx5IGVuZm9yY2VcbiAqICAgICB0aGF0IHRoZSB0eXBlcyBhcmUgYWN0dWFsbHkgY29tcGF0aWJsZSwgYnV0IG1vc3RseSBqdXN0IGhvcGUgdGhhdCB0aGV5IGFyZSBkdWVcbiAqICAgICB0byBiZWluZyBkZXJpdmVkIGZyb20gdGhlIHNhbWUgSFRNTCBzcGVjcy5cbiAqL1xuZnVuY3Rpb24gaXNDbG9zdXJlUHJvdmlkZWRUeXBlKHN5bWJvbDogdHMuU3ltYm9sKTogYm9vbGVhbiB7XG4gIHJldHVybiBzeW1ib2wuZGVjbGFyYXRpb25zICE9IG51bGwgJiZcbiAgICAgIHN5bWJvbC5kZWNsYXJhdGlvbnMuc29tZShuID0+IGlzQnVpbHRpbkxpYkRUUyhuLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHlwZVRvRGVidWdTdHJpbmcodHlwZTogdHMuVHlwZSk6IHN0cmluZyB7XG4gIGxldCBkZWJ1Z1N0cmluZyA9IGBmbGFnczoweCR7dHlwZS5mbGFncy50b1N0cmluZygxNil9YDtcblxuICBpZiAodHlwZS5hbGlhc1N5bWJvbCkge1xuICAgIGRlYnVnU3RyaW5nICs9IGAgYWxpYXM6JHtzeW1ib2xUb0RlYnVnU3RyaW5nKHR5cGUuYWxpYXNTeW1ib2wpfWA7XG4gIH1cbiAgaWYgKHR5cGUuYWxpYXNUeXBlQXJndW1lbnRzKSB7XG4gICAgZGVidWdTdHJpbmcgKz0gYCBhbGlhc0FyZ3M6PCR7dHlwZS5hbGlhc1R5cGVBcmd1bWVudHMubWFwKHR5cGVUb0RlYnVnU3RyaW5nKS5qb2luKCcsJyl9PmA7XG4gIH1cblxuICAvLyBKdXN0IHRoZSB1bmlxdWUgZmxhZ3MgKHBvd2VycyBvZiB0d28pLiBEZWNsYXJlZCBpbiBzcmMvY29tcGlsZXIvdHlwZXMudHMuXG4gIGNvbnN0IGJhc2ljVHlwZXM6IHRzLlR5cGVGbGFnc1tdID0gW1xuICAgIHRzLlR5cGVGbGFncy5BbnksICAgICAgICAgICB0cy5UeXBlRmxhZ3MuU3RyaW5nLCAgICAgICAgIHRzLlR5cGVGbGFncy5OdW1iZXIsXG4gICAgdHMuVHlwZUZsYWdzLkJvb2xlYW4sICAgICAgIHRzLlR5cGVGbGFncy5FbnVtLCAgICAgICAgICAgdHMuVHlwZUZsYWdzLlN0cmluZ0xpdGVyYWwsXG4gICAgdHMuVHlwZUZsYWdzLk51bWJlckxpdGVyYWwsIHRzLlR5cGVGbGFncy5Cb29sZWFuTGl0ZXJhbCwgdHMuVHlwZUZsYWdzLkVudW1MaXRlcmFsLFxuICAgIHRzLlR5cGVGbGFncy5FU1N5bWJvbCwgICAgICB0cy5UeXBlRmxhZ3MuVW5pcXVlRVNTeW1ib2wsIHRzLlR5cGVGbGFncy5Wb2lkLFxuICAgIHRzLlR5cGVGbGFncy5VbmRlZmluZWQsICAgICB0cy5UeXBlRmxhZ3MuTnVsbCwgICAgICAgICAgIHRzLlR5cGVGbGFncy5OZXZlcixcbiAgICB0cy5UeXBlRmxhZ3MuVHlwZVBhcmFtZXRlciwgdHMuVHlwZUZsYWdzLk9iamVjdCwgICAgICAgICB0cy5UeXBlRmxhZ3MuVW5pb24sXG4gICAgdHMuVHlwZUZsYWdzLkludGVyc2VjdGlvbiwgIHRzLlR5cGVGbGFncy5JbmRleCwgICAgICAgICAgdHMuVHlwZUZsYWdzLkluZGV4ZWRBY2Nlc3MsXG4gICAgdHMuVHlwZUZsYWdzLkNvbmRpdGlvbmFsLCAgIHRzLlR5cGVGbGFncy5TdWJzdGl0dXRpb24sXG4gIF07XG4gIGZvciAoY29uc3QgZmxhZyBvZiBiYXNpY1R5cGVzKSB7XG4gICAgaWYgKCh0eXBlLmZsYWdzICYgZmxhZykgIT09IDApIHtcbiAgICAgIGRlYnVnU3RyaW5nICs9IGAgJHt0cy5UeXBlRmxhZ3NbZmxhZ119YDtcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZS5mbGFncyA9PT0gdHMuVHlwZUZsYWdzLk9iamVjdCkge1xuICAgIGNvbnN0IG9ialR5cGUgPSB0eXBlIGFzIHRzLk9iamVjdFR5cGU7XG4gICAgZGVidWdTdHJpbmcgKz0gYCBvYmplY3RGbGFnczoweCR7b2JqVHlwZS5vYmplY3RGbGFnc31gO1xuICAgIC8vIEp1c3QgdGhlIHVuaXF1ZSBmbGFncyAocG93ZXJzIG9mIHR3bykuIERlY2xhcmVkIGluIHNyYy9jb21waWxlci90eXBlcy50cy5cbiAgICBjb25zdCBvYmplY3RGbGFnczogdHMuT2JqZWN0RmxhZ3NbXSA9IFtcbiAgICAgIHRzLk9iamVjdEZsYWdzLkNsYXNzLFxuICAgICAgdHMuT2JqZWN0RmxhZ3MuSW50ZXJmYWNlLFxuICAgICAgdHMuT2JqZWN0RmxhZ3MuUmVmZXJlbmNlLFxuICAgICAgdHMuT2JqZWN0RmxhZ3MuVHVwbGUsXG4gICAgICB0cy5PYmplY3RGbGFncy5Bbm9ueW1vdXMsXG4gICAgICB0cy5PYmplY3RGbGFncy5NYXBwZWQsXG4gICAgICB0cy5PYmplY3RGbGFncy5JbnN0YW50aWF0ZWQsXG4gICAgICB0cy5PYmplY3RGbGFncy5PYmplY3RMaXRlcmFsLFxuICAgICAgdHMuT2JqZWN0RmxhZ3MuRXZvbHZpbmdBcnJheSxcbiAgICAgIHRzLk9iamVjdEZsYWdzLk9iamVjdExpdGVyYWxQYXR0ZXJuV2l0aENvbXB1dGVkUHJvcGVydGllcyxcbiAgICBdO1xuICAgIGZvciAoY29uc3QgZmxhZyBvZiBvYmplY3RGbGFncykge1xuICAgICAgaWYgKChvYmpUeXBlLm9iamVjdEZsYWdzICYgZmxhZykgIT09IDApIHtcbiAgICAgICAgZGVidWdTdHJpbmcgKz0gYCBvYmplY3Q6JHt0cy5PYmplY3RGbGFnc1tmbGFnXX1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlLnN5bWJvbCAmJiB0eXBlLnN5bWJvbC5uYW1lICE9PSAnX190eXBlJykge1xuICAgIGRlYnVnU3RyaW5nICs9IGAgc3ltYm9sLm5hbWU6JHtKU09OLnN0cmluZ2lmeSh0eXBlLnN5bWJvbC5uYW1lKX1gO1xuICB9XG5cbiAgaWYgKHR5cGUucGF0dGVybikge1xuICAgIGRlYnVnU3RyaW5nICs9IGAgZGVzdHJ1Y3R1cmluZzp0cnVlYDtcbiAgfVxuXG4gIHJldHVybiBge3R5cGUgJHtkZWJ1Z1N0cmluZ319YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bWJvbFRvRGVidWdTdHJpbmcoc3ltOiB0cy5TeW1ib2wpOiBzdHJpbmcge1xuICBsZXQgZGVidWdTdHJpbmcgPSBgJHtKU09OLnN0cmluZ2lmeShzeW0ubmFtZSl9IGZsYWdzOjB4JHtzeW0uZmxhZ3MudG9TdHJpbmcoMTYpfWA7XG5cbiAgLy8gSnVzdCB0aGUgdW5pcXVlIGZsYWdzIChwb3dlcnMgb2YgdHdvKS4gRGVjbGFyZWQgaW4gc3JjL2NvbXBpbGVyL3R5cGVzLnRzLlxuICBjb25zdCBzeW1ib2xGbGFncyA9IFtcbiAgICB0cy5TeW1ib2xGbGFncy5GdW5jdGlvblNjb3BlZFZhcmlhYmxlLFxuICAgIHRzLlN5bWJvbEZsYWdzLkJsb2NrU2NvcGVkVmFyaWFibGUsXG4gICAgdHMuU3ltYm9sRmxhZ3MuUHJvcGVydHksXG4gICAgdHMuU3ltYm9sRmxhZ3MuRW51bU1lbWJlcixcbiAgICB0cy5TeW1ib2xGbGFncy5GdW5jdGlvbixcbiAgICB0cy5TeW1ib2xGbGFncy5DbGFzcyxcbiAgICB0cy5TeW1ib2xGbGFncy5JbnRlcmZhY2UsXG4gICAgdHMuU3ltYm9sRmxhZ3MuQ29uc3RFbnVtLFxuICAgIHRzLlN5bWJvbEZsYWdzLlJlZ3VsYXJFbnVtLFxuICAgIHRzLlN5bWJvbEZsYWdzLlZhbHVlTW9kdWxlLFxuICAgIHRzLlN5bWJvbEZsYWdzLk5hbWVzcGFjZU1vZHVsZSxcbiAgICB0cy5TeW1ib2xGbGFncy5UeXBlTGl0ZXJhbCxcbiAgICB0cy5TeW1ib2xGbGFncy5PYmplY3RMaXRlcmFsLFxuICAgIHRzLlN5bWJvbEZsYWdzLk1ldGhvZCxcbiAgICB0cy5TeW1ib2xGbGFncy5Db25zdHJ1Y3RvcixcbiAgICB0cy5TeW1ib2xGbGFncy5HZXRBY2Nlc3NvcixcbiAgICB0cy5TeW1ib2xGbGFncy5TZXRBY2Nlc3NvcixcbiAgICB0cy5TeW1ib2xGbGFncy5TaWduYXR1cmUsXG4gICAgdHMuU3ltYm9sRmxhZ3MuVHlwZVBhcmFtZXRlcixcbiAgICB0cy5TeW1ib2xGbGFncy5UeXBlQWxpYXMsXG4gICAgdHMuU3ltYm9sRmxhZ3MuRXhwb3J0VmFsdWUsXG4gICAgdHMuU3ltYm9sRmxhZ3MuQWxpYXMsXG4gICAgdHMuU3ltYm9sRmxhZ3MuUHJvdG90eXBlLFxuICAgIHRzLlN5bWJvbEZsYWdzLkV4cG9ydFN0YXIsXG4gICAgdHMuU3ltYm9sRmxhZ3MuT3B0aW9uYWwsXG4gICAgdHMuU3ltYm9sRmxhZ3MuVHJhbnNpZW50LFxuICBdO1xuICBmb3IgKGNvbnN0IGZsYWcgb2Ygc3ltYm9sRmxhZ3MpIHtcbiAgICBpZiAoKHN5bS5mbGFncyAmIGZsYWcpICE9PSAwKSB7XG4gICAgICBkZWJ1Z1N0cmluZyArPSBgICR7dHMuU3ltYm9sRmxhZ3NbZmxhZ119YDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVidWdTdHJpbmc7XG59XG5cbi8qKiBBIG1vZHVsZSBkZWNsYXJlZCBhcyBcImRlY2xhcmUgbW9kdWxlICdleHRlcm5hbF9uYW1lJyB7Li4ufVwiIChub3RlIHRoZSBxdW90ZXMpLiAqL1xudHlwZSBBbWJpZW50TW9kdWxlRGVjbGFyYXRpb24gPSB0cy5Nb2R1bGVEZWNsYXJhdGlvbiZ7bmFtZTogdHMuU3RyaW5nTGl0ZXJhbH07XG5cbi8qKlxuICogU2VhcmNoZXMgZm9yIGFuIGFtYmllbnQgbW9kdWxlIGRlY2xhcmF0aW9uIGluIHRoZSBhbmNlc3RvcnMgb2YgZGVjbGFyYXRpb25zLCBkZXB0aCBmaXJzdCwgYW5kXG4gKiByZXR1cm5zIHRoZSBmaXJzdCBvciBudWxsIGlmIG5vbmUgZm91bmQuXG4gKi9cbmZ1bmN0aW9uIGdldENvbnRhaW5pbmdBbWJpZW50TW9kdWxlRGVjbGFyYXRpb24oZGVjbGFyYXRpb25zOiB0cy5EZWNsYXJhdGlvbltdKTpcbiAgICBBbWJpZW50TW9kdWxlRGVjbGFyYXRpb258bnVsbCB7XG4gIGZvciAoY29uc3QgZGVjbGFyYXRpb24gb2YgZGVjbGFyYXRpb25zKSB7XG4gICAgbGV0IHBhcmVudCA9IGRlY2xhcmF0aW9uLnBhcmVudDtcbiAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICBpZiAodHMuaXNNb2R1bGVEZWNsYXJhdGlvbihwYXJlbnQpICYmIHRzLmlzU3RyaW5nTGl0ZXJhbChwYXJlbnQubmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIHBhcmVudCBhcyBBbWJpZW50TW9kdWxlRGVjbGFyYXRpb247XG4gICAgICB9XG4gICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqIFJldHVybnMgdHJ1ZSBpZiBhbnkgb2YgZGVjbGFyYXRpb25zIGlzIGEgdG9wIGxldmVsIGRlY2xhcmF0aW9uIGluIGFuIGV4dGVybmFsIG1vZHVsZS4gKi9cbmZ1bmN0aW9uIGlzVG9wTGV2ZWxFeHRlcm5hbChkZWNsYXJhdGlvbnM6IHRzLkRlY2xhcmF0aW9uW10pIHtcbiAgZm9yIChjb25zdCBkZWNsYXJhdGlvbiBvZiBkZWNsYXJhdGlvbnMpIHtcbiAgICBpZiAoZGVjbGFyYXRpb24ucGFyZW50ID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuICAgIGlmICh0cy5pc1NvdXJjZUZpbGUoZGVjbGFyYXRpb24ucGFyZW50KSAmJiB0cy5pc0V4dGVybmFsTW9kdWxlKGRlY2xhcmF0aW9uLnBhcmVudCkpIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgYSBhbmQgYiBhcmUgKG9yIHdlcmUgb3JpZ2luYWxseSBiZWZvcmUgdHJhbnNmb3JtYXRpb24pIG5vZGVzIG9mIHRoZSBzYW1lIHNvdXJjZVxuICogZmlsZS5cbiAqL1xuZnVuY3Rpb24gaXNEZWNsYXJlZEluU2FtZUZpbGUoYTogdHMuTm9kZSwgYjogdHMuTm9kZSkge1xuICByZXR1cm4gdHMuZ2V0T3JpZ2luYWxOb2RlKGEpLmdldFNvdXJjZUZpbGUoKSA9PT0gdHMuZ2V0T3JpZ2luYWxOb2RlKGIpLmdldFNvdXJjZUZpbGUoKTtcbn1cblxuLyoqIFR5cGVUcmFuc2xhdG9yIHRyYW5zbGF0ZXMgVHlwZVNjcmlwdCB0eXBlcyB0byBDbG9zdXJlIHR5cGVzLiAqL1xuZXhwb3J0IGNsYXNzIFR5cGVUcmFuc2xhdG9yIHtcbiAgLyoqXG4gICAqIEEgbGlzdCBvZiB0eXBlIGxpdGVyYWxzIHdlJ3ZlIGVuY291bnRlcmVkIHdoaWxlIGVtaXR0aW5nOyB1c2VkIHRvIGF2b2lkIGdldHRpbmcgc3R1Y2sgaW5cbiAgICogcmVjdXJzaXZlIHR5cGVzLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBzZWVuQW5vbnltb3VzVHlwZXMgPSBuZXcgU2V0PHRzLlR5cGU+KCk7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gd3JpdGUgdHlwZXMgc3VpdGFibGUgZm9yIGFuIFxcQGV4dGVybnMgZmlsZS4gRXh0ZXJucyB0eXBlcyBtdXN0IG5vdCByZWZlciB0b1xuICAgKiBub24tZXh0ZXJucyB0eXBlcyAoaS5lLiBub24gYW1iaWVudCB0eXBlcykgYW5kIG5lZWQgdG8gdXNlIGZ1bGx5IHF1YWxpZmllZCBuYW1lcy5cbiAgICovXG4gIGlzRm9yRXh0ZXJucyA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gbm9kZSBpcyB0aGUgc291cmNlIEFTVCB0cy5Ob2RlIHRoZSB0eXBlIGNvbWVzIGZyb20uICBUaGlzIGlzIHVzZWRcbiAgICogICAgIGluIHNvbWUgY2FzZXMgKGUuZy4gYW5vbnltb3VzIHR5cGVzKSBmb3IgbG9va2luZyB1cCBmaWVsZCBuYW1lcy5cbiAgICogQHBhcmFtIHBhdGhCbGFja0xpc3QgaXMgYSBzZXQgb2YgcGF0aHMgdGhhdCBzaG91bGQgbmV2ZXIgZ2V0IHR5cGVkO1xuICAgKiAgICAgYW55IHJlZmVyZW5jZSB0byBzeW1ib2xzIGRlZmluZWQgaW4gdGhlc2UgcGF0aHMgc2hvdWxkIGJ5IHR5cGVkXG4gICAqICAgICBhcyB7P30uXG4gICAqIEBwYXJhbSBzeW1ib2xzVG9BbGlhc2VkTmFtZXMgYSBtYXBwaW5nIGZyb20gc3ltYm9scyAoYEZvb2ApIHRvIGEgbmFtZSBpbiBzY29wZSB0aGV5IHNob3VsZCBiZVxuICAgKiAgICAgZW1pdHRlZCBhcyAoZS5nLiBgdHNpY2tsZV9yZXFUeXBlXzEuRm9vYCkuIENhbiBiZSBhdWdtZW50ZWQgZHVyaW5nIHR5cGUgdHJhbnNsYXRpb24sIGUuZy5cbiAgICogICAgIHRvIGJsYWNrbGlzdCBhIHN5bWJvbC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWFkb25seSBob3N0OiBBbm5vdGF0b3JIb3N0LCBwcml2YXRlIHJlYWRvbmx5IHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcixcbiAgICAgIHByaXZhdGUgcmVhZG9ubHkgbm9kZTogdHMuTm9kZSwgcHJpdmF0ZSByZWFkb25seSBwYXRoQmxhY2tMaXN0PzogU2V0PHN0cmluZz4sXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IHN5bWJvbHNUb0FsaWFzZWROYW1lcyA9IG5ldyBNYXA8dHMuU3ltYm9sLCBzdHJpbmc+KCksXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IGVuc3VyZVN5bWJvbERlY2xhcmVkOiAoc3ltOiB0cy5TeW1ib2wpID0+IHZvaWQgPSAoKSA9PiB7fSkge1xuICAgIC8vIE5vcm1hbGl6ZSBwYXRocyB0byBub3QgYnJlYWsgY2hlY2tzIG9uIFdpbmRvd3MuXG4gICAgaWYgKHRoaXMucGF0aEJsYWNrTGlzdCAhPSBudWxsKSB7XG4gICAgICB0aGlzLnBhdGhCbGFja0xpc3QgPVxuICAgICAgICAgIG5ldyBTZXQ8c3RyaW5nPihBcnJheS5mcm9tKHRoaXMucGF0aEJsYWNrTGlzdC52YWx1ZXMoKSkubWFwKHAgPT4gcGF0aC5ub3JtYWxpemUocCkpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgYSB0cy5TeW1ib2wgdG8gYSBzdHJpbmcsIGFwcGx5aW5nIGFsaWFzZXMgYW5kIGVuc3VyaW5nIHN5bWJvbHMgYXJlIGltcG9ydGVkLlxuICAgKiBAcmV0dXJuIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBzeW1ib2wgYXMgYSB2YWxpZCBDbG9zdXJlIHR5cGUgbmFtZSwgb3IgYHVuZGVmaW5lZGAgaWZcbiAgICogICAgIHRoZSB0eXBlIGNhbm5vdCBiZSBleHByZXNzZWQgKGUuZy4gZm9yIGFub255bW91cyB0eXBlcykuXG4gICAqL1xuICBzeW1ib2xUb1N0cmluZyhzeW06IHRzLlN5bWJvbCk6IHN0cmluZ3x1bmRlZmluZWQge1xuICAgIC8vIFR5cGVTY3JpcHQgcmVzb2x2ZXMgZS5nLiB1bmlvbiB0eXBlcyB0byB0aGVpciBtZW1iZXJzLCB3aGljaCBjYW4gaW5jbHVkZSBzeW1ib2xzIG5vdCBkZWNsYXJlZFxuICAgIC8vIGluIHRoZSBjdXJyZW50IHNjb3BlLiBFbnN1cmUgdGhhdCBhbGwgc3ltYm9scyBmb3VuZCB0aGlzIHdheSBhcmUgYWN0dWFsbHkgZGVjbGFyZWQuXG4gICAgLy8gVGhpcyBtdXN0IGhhcHBlbiBiZWZvcmUgdGhlIGFsaWFzIGNoZWNrIGJlbG93LCBpdCBtaWdodCBpbnRyb2R1Y2UgYSBuZXcgYWxpYXMgZm9yIHRoZSBzeW1ib2wuXG4gICAgaWYgKCF0aGlzLmlzRm9yRXh0ZXJucyAmJiAoc3ltLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuVHlwZVBhcmFtZXRlcikgPT09IDApIHtcbiAgICAgIHRoaXMuZW5zdXJlU3ltYm9sRGVjbGFyZWQoc3ltKTtcbiAgICB9XG5cbiAgICBjb25zdCBuYW1lID0gdGhpcy50eXBlQ2hlY2tlci5zeW1ib2xUb0VudGl0eU5hbWUoXG4gICAgICAgIHN5bSwgdHMuU3ltYm9sRmxhZ3MuVHlwZSwgdGhpcy5ub2RlLCB0cy5Ob2RlQnVpbGRlckZsYWdzLlVzZUZ1bGx5UXVhbGlmaWVkVHlwZSk7XG4gICAgLy8gbmFtZSBtaWdodCBiZSB1bmRlZmluZWQsIGUuZy4gZm9yIGFub255bW91cyBjbGFzc2VzLlxuICAgIGlmICghbmFtZSkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgIC8vIFR5cGVTY3JpcHQncyBzeW1ib2xUb0VudGl0eU5hbWUgcmV0dXJucyBhIHRyZWUgb2YgSWRlbnRpZmllciBvYmplY3RzLiB0c2lja2xlIG5lZWRzIHRvXG4gICAgLy8gaWRlbnRpZnkgYW5kIGFsaWFzIHNwZWNpZml5IHN5bWJvbHMgb24gaXQuIFRoZSBjb2RlIGJlbG93IGFjY2Vzc2VzIHRoZSBUeXBlU2NyaXB0IEBpbnRlcm5hbFxuICAgIC8vIHN5bWJvbCBmaWVsZCBvbiBJZGVudGlmaWVyIHRvIGRvIHNvLlxuICAgIHR5cGUgSWRlbnRpZmllcldpdGhTeW1ib2wgPSB0cy5JZGVudGlmaWVyJntzeW1ib2w6IHRzLlN5bWJvbH07XG4gICAgbGV0IHN0ciA9ICcnO1xuICAgIC8qKiBSZWN1cnNpdmVseSB2aXNpdHMgY29tcG9uZW50cyBvZiBlbnRpdHkgbmFtZSBhbmQgd3JpdGVzIHRoZW0gdG8gYHN0cmAgYWJvdmUuICovXG4gICAgY29uc3Qgd3JpdGVFbnRpdHlXaXRoU3ltYm9scyA9IChuYW1lOiB0cy5FbnRpdHlOYW1lKSA9PiB7XG4gICAgICBsZXQgaWRlbnRpZmllcjogSWRlbnRpZmllcldpdGhTeW1ib2w7XG4gICAgICBpZiAodHMuaXNRdWFsaWZpZWROYW1lKG5hbWUpKSB7XG4gICAgICAgIHdyaXRlRW50aXR5V2l0aFN5bWJvbHMobmFtZS5sZWZ0KTtcbiAgICAgICAgc3RyICs9ICcuJztcbiAgICAgICAgaWRlbnRpZmllciA9IG5hbWUucmlnaHQgYXMgSWRlbnRpZmllcldpdGhTeW1ib2w7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZGVudGlmaWVyID0gbmFtZSBhcyBJZGVudGlmaWVyV2l0aFN5bWJvbDtcbiAgICAgIH1cbiAgICAgIGxldCBzeW1ib2wgPSBpZGVudGlmaWVyLnN5bWJvbDtcbiAgICAgIC8vIFdoZW4gd3JpdGluZyBhIHN5bWJvbCwgY2hlY2sgaWYgdGhlcmUgaXMgYW4gYWxpYXMgZm9yIGl0IGluIHRoZSBjdXJyZW50IHNjb3BlIHRoYXQgc2hvdWxkXG4gICAgICAvLyB0YWtlIHByZWNlZGVuY2UsIGUuZy4gZnJvbSBhIGdvb2cucmVxdWlyZVR5cGUuXG4gICAgICBpZiAoc3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy50eXBlQ2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHN5bWJvbCk7XG4gICAgICB9XG4gICAgICBjb25zdCBhbGlhcyA9IHRoaXMuc3ltYm9sc1RvQWxpYXNlZE5hbWVzLmdldChzeW1ib2wpO1xuICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgIC8vIElmIHNvLCBkaXNjYXJkIHRoZSBlbnRpcmUgY3VycmVudCB0ZXh0IGFuZCBvbmx5IHVzZSB0aGUgYWxpYXMgLSBvdGhlcndpc2UgaWYgYSBzeW1ib2wgaGFzXG4gICAgICAgIC8vIGEgbG9jYWwgYWxpYXMgYnV0IGFwcGVhcnMgaW4gYSBkb3R0ZWQgdHlwZSBwYXRoIChlLmcuIHdoZW4gaXQncyBpbXBvcnRlZCB1c2luZyBpbXBvcnQgKlxuICAgICAgICAvLyBhcyBmb28pLCBzdHIgd291bGQgY29udGFpbiBib3RoIHRoZSBwcmVmeCAqYW5kKiB0aGUgZnVsbCBhbGlhcyAoZm9vLmFsaWFzLm5hbWUpLlxuICAgICAgICBzdHIgPSBhbGlhcztcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgdGV4dCA9IGdldElkZW50aWZpZXJUZXh0KGlkZW50aWZpZXIpO1xuICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc3QgbWFuZ2xlZFByZWZpeCA9IHRoaXMubWF5YmVHZXRNYW5nbGVkTmFtZVByZWZpeChzeW1ib2wpO1xuICAgICAgICB0ZXh0ID0gbWFuZ2xlZFByZWZpeCArIHRleHQ7XG4gICAgICB9XG4gICAgICBzdHIgKz0gdGV4dDtcbiAgICB9O1xuICAgIHdyaXRlRW50aXR5V2l0aFN5bWJvbHMobmFtZSk7XG4gICAgcmV0dXJuIHRoaXMuc3RyaXBDbHV0ek5hbWVzcGFjZShzdHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG1hbmdsZWQgbmFtZSBwcmVmaXggZm9yIHN5bWJvbCwgb3IgYW4gZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlLlxuICAgKlxuICAgKiBUeXBlIG5hbWVzIGFyZSBlbWl0dGVkIHdpdGggYSBtYW5nbGVkIHByZWZpeCBpZiB0aGV5IGFyZSB0b3AgbGV2ZWwgc3ltYm9scyBkZWNsYXJlZCBpbiBhblxuICAgKiBleHRlcm5hbCBtb2R1bGUgKC5kLnRzIG9yIC50cyksIGFuZCBhcmUgYW1iaWVudCBkZWNsYXJhdGlvbnMgKFwiZGVjbGFyZSAuLi5cIikuIFRoaXMgaXMgYmVjYXVzZVxuICAgKiB0aGVpciBkZWNsYXJhdGlvbnMgZ2V0IG1vdmVkIHRvIGV4dGVybnMgZmlsZXMgKHRvIG1ha2UgZXh0ZXJuYWwgbmFtZXMgdmlzaWJsZSB0byBDbG9zdXJlIGFuZFxuICAgKiBwcmV2ZW50IHJlbmFtaW5nKSwgd2hpY2ggb25seSB1c2UgZ2xvYmFsIG5hbWVzLiBUaGlzIG1lYW5zIHRoZSBuYW1lcyBtdXN0IGJlIG1hbmdsZWQgdG8gcHJldmVudFxuICAgKiBjb2xsaXNpb25zIGFuZCBhbGxvdyByZWZlcmVuY2luZyB0aGVtIHVuaXF1ZWx5LlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhbHNvIGhhbmRsZXMgdGhlIHNwZWNpYWwgY2FzZSBvZiBzeW1ib2xzIGRlY2xhcmVkIGluIGFuIGFtYmllbnQgZXh0ZXJuYWwgbW9kdWxlXG4gICAqIGNvbnRleHQuXG4gICAqXG4gICAqIFN5bWJvbHMgZGVjbGFyZWQgaW4gYSBnbG9iYWwgYmxvY2ssIGUuZy4gXCJkZWNsYXJlIGdsb2JhbCB7IHR5cGUgWDsgfVwiLCBhcmUgaGFuZGxlZCBpbXBsaWNpdGx5OlxuICAgKiB3aGVuIHJlZmVyZW5jZWQsIHRoZXkgYXJlIHdyaXR0ZW4gYXMganVzdCBcIlhcIiwgd2hpY2ggaXMgbm90IGEgdG9wIGxldmVsIGRlY2xhcmF0aW9uLCBzbyB0aGVcbiAgICogY29kZSBiZWxvdyBpZ25vcmVzIHRoZW0uXG4gICAqL1xuICBtYXliZUdldE1hbmdsZWROYW1lUHJlZml4KHN5bWJvbDogdHMuU3ltYm9sKTogc3RyaW5nfCcnIHtcbiAgICBpZiAoIXN5bWJvbC5kZWNsYXJhdGlvbnMpIHJldHVybiAnJztcbiAgICBjb25zdCBkZWNsYXJhdGlvbnMgPSBzeW1ib2wuZGVjbGFyYXRpb25zO1xuICAgIGxldCBhbWJpZW50TW9kdWxlRGVjbGFyYXRpb246IEFtYmllbnRNb2R1bGVEZWNsYXJhdGlvbnxudWxsID0gbnVsbDtcbiAgICAvLyBJZiB0aGUgc3ltYm9sIGlzIG5laXRoZXIgYSB0b3AgbGV2ZWwgZGVjbGFyYXRpb24gaW4gYW4gZXh0ZXJuYWwgbW9kdWxlIG5vciBpbiBhbiBhbWJpZW50XG4gICAgLy8gYmxvY2ssIHRzaWNrbGUgc2hvdWxkIG5vdCBlbWl0IGEgcHJlZml4OiBpdCdzIGVpdGhlciBub3QgYW4gZXh0ZXJuYWwgc3ltYm9sLCBvciBpdCdzIGFuXG4gICAgLy8gZXh0ZXJuYWwgc3ltYm9sIG5lc3RlZCBpbiBhIG1vZHVsZSwgc28gaXQgd2lsbCBuZWVkIHRvIGJlIHF1YWxpZmllZCwgYW5kIHRoZSBtYW5nbGluZyBwcmVmaXhcbiAgICAvLyBnb2VzIG9uIHRoZSBxdWFsaWZpZXIuXG4gICAgaWYgKCFpc1RvcExldmVsRXh0ZXJuYWwoZGVjbGFyYXRpb25zKSkge1xuICAgICAgYW1iaWVudE1vZHVsZURlY2xhcmF0aW9uID0gZ2V0Q29udGFpbmluZ0FtYmllbnRNb2R1bGVEZWNsYXJhdGlvbihkZWNsYXJhdGlvbnMpO1xuICAgICAgaWYgKCFhbWJpZW50TW9kdWxlRGVjbGFyYXRpb24pIHJldHVybiAnJztcbiAgICB9XG4gICAgLy8gQXQgdGhpcyBwb2ludCwgdGhlIGRlY2xhcmF0aW9uIGlzIGZyb20gYW4gZXh0ZXJuYWwgbW9kdWxlIChwb3NzaWJseSBhbWJpZW50KS5cbiAgICAvLyBUaGVzZSBkZWNsYXJhdGlvbnMgbXVzdCBiZSBwcmVmaXhlZCBpZiBlaXRoZXI6XG4gICAgLy8gKGEpIHRzaWNrbGUgaXMgZW1pdHRpbmcgYW4gZXh0ZXJucyBmaWxlLCBzbyBhbGwgc3ltYm9scyBhcmUgcXVhbGlmaWVkIHdpdGhpbiBpdFxuICAgIC8vIChiKSBvciB0aGUgZGVjbGFyYXRpb24gbXVzdCBiZSBhbiBleHBvcnRlZCBhbWJpZW50IGRlY2xhcmF0aW9uIGZyb20gdGhlIGxvY2FsIGZpbGUuXG4gICAgLy8gQW1iaWVudCBleHRlcm5hbCBkZWNsYXJhdGlvbnMgZnJvbSBvdGhlciBmaWxlcyBhcmUgaW1wb3J0ZWQsIHNvIHRoZXJlJ3MgYSBsb2NhbCBhbGlhcyBmb3IgdGhlXG4gICAgLy8gbW9kdWxlIGFuZCBubyBtYW5nbGluZyBpcyBuZWVkZWQuXG4gICAgaWYgKCF0aGlzLmlzRm9yRXh0ZXJucyAmJlxuICAgICAgICAhZGVjbGFyYXRpb25zLmV2ZXJ5KFxuICAgICAgICAgICAgZCA9PiBpc0RlY2xhcmVkSW5TYW1lRmlsZSh0aGlzLm5vZGUsIGQpICYmIGlzQW1iaWVudChkKSAmJlxuICAgICAgICAgICAgICAgIGhhc01vZGlmaWVyRmxhZyhkLCB0cy5Nb2RpZmllckZsYWdzLkV4cG9ydCkpKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIC8vIElmIGZyb20gYW4gYW1iaWVudCBkZWNsYXJhdGlvbiwgdXNlIGFuZCByZXNvbHZlIHRoZSBuYW1lIGZyb20gdGhhdC4gT3RoZXJ3aXNlLCB1c2UgdGhlIGZpbGVcbiAgICAvLyBuYW1lIGZyb20gdGhlIChhcmJpdHJhcnkpIGZpcnN0IGRlY2xhcmF0aW9uIHRvIG1hbmdsZS5cbiAgICBjb25zdCBmaWxlTmFtZSA9IGFtYmllbnRNb2R1bGVEZWNsYXJhdGlvbiA/XG4gICAgICAgIGFtYmllbnRNb2R1bGVEZWNsYXJhdGlvbi5uYW1lLnRleHQgOlxuICAgICAgICB0cy5nZXRPcmlnaW5hbE5vZGUoZGVjbGFyYXRpb25zWzBdKS5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWU7XG4gICAgY29uc3QgbWFuZ2xlZCA9IG1vZHVsZU5hbWVBc0lkZW50aWZpZXIodGhpcy5ob3N0LCBmaWxlTmFtZSk7XG4gICAgcmV0dXJuIG1hbmdsZWQgKyAnLic7XG4gIH1cblxuICAvLyBDbHV0eiAoaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvY2x1dHopIGVtaXRzIGdsb2JhbCB0eXBlIHN5bWJvbHMgaGlkZGVuIGluIGEgc3BlY2lhbFxuICAvLyDgsqBf4LKgLmNsdXR6IG5hbWVzcGFjZS4gV2hpbGUgbW9zdCBjb2RlIHNlZW4gYnkgVHNpY2tsZSB3aWxsIG9ubHkgZXZlciBzZWUgbG9jYWwgYWxpYXNlcywgQ2x1dHpcbiAgLy8gc3ltYm9scyBjYW4gYmUgd3JpdHRlbiBieSB1c2VycyBkaXJlY3RseSBpbiBjb2RlLCBhbmQgdGhleSBjYW4gYXBwZWFyIGJ5IGRlcmVmZXJlbmNpbmdcbiAgLy8gVHlwZUFsaWFzZXMuIFRoZSBjb2RlIGJlbG93IHNpbXBseSBzdHJpcHMgdGhlIHByZWZpeCwgdGhlIHJlbWFpbmluZyB0eXBlIG5hbWUgdGhlbiBtYXRjaGVzXG4gIC8vIENsb3N1cmUncyB0eXBlLlxuICBwcml2YXRlIHN0cmlwQ2x1dHpOYW1lc3BhY2UobmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKG5hbWUuc3RhcnRzV2l0aCgn4LKgX+CyoC5jbHV0ei4nKSkgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKCfgsqBf4LKgLmNsdXR6LicubGVuZ3RoKTtcbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuXG4gIHRyYW5zbGF0ZSh0eXBlOiB0cy5UeXBlKTogc3RyaW5nIHtcbiAgICAvLyBOT1RFOiBUaG91Z2ggdHlwZS5mbGFncyBoYXMgdGhlIG5hbWUgXCJmbGFnc1wiLCBpdCB1c3VhbGx5IGNhbiBvbmx5IGJlIG9uZVxuICAgIC8vIG9mIHRoZSBlbnVtIG9wdGlvbnMgYXQgYSB0aW1lIChleGNlcHQgZm9yIHVuaW9ucyBvZiBsaXRlcmFsIHR5cGVzLCBlLmcuIHVuaW9ucyBvZiBib29sZWFuXG4gICAgLy8gdmFsdWVzLCBzdHJpbmcgdmFsdWVzLCBlbnVtIHZhbHVlcykuIFRoaXMgc3dpdGNoIGhhbmRsZXMgYWxsIHRoZSBjYXNlcyBpbiB0aGUgdHMuVHlwZUZsYWdzXG4gICAgLy8gZW51bSBpbiB0aGUgb3JkZXIgdGhleSBvY2N1ci5cblxuICAgIC8vIE5PVEU6IFNvbWUgVHlwZUZsYWdzIGFyZSBtYXJrZWQgXCJpbnRlcm5hbFwiIGluIHRoZSBkLnRzIGJ1dCBzdGlsbCBzaG93IHVwIGluIHRoZSB2YWx1ZSBvZlxuICAgIC8vIHR5cGUuZmxhZ3MuIFRoaXMgbWFzayBsaW1pdHMgdGhlIGZsYWcgY2hlY2tzIHRvIHRoZSBvbmVzIGluIHRoZSBwdWJsaWMgQVBJLiBcImxhc3RGbGFnXCIgaGVyZVxuICAgIC8vIGlzIHRoZSBsYXN0IGZsYWcgaGFuZGxlZCBpbiB0aGlzIHN3aXRjaCBzdGF0ZW1lbnQsIGFuZCBzaG91bGQgYmUga2VwdCBpbiBzeW5jIHdpdGhcbiAgICAvLyB0eXBlc2NyaXB0LmQudHMuXG5cbiAgICAvLyBOb25QcmltaXRpdmUgb2NjdXJzIG9uIGl0cyBvd24gb24gdGhlIGxvd2VyIGNhc2UgXCJvYmplY3RcIiB0eXBlLiBTcGVjaWFsIGNhc2UgdG8gXCIhT2JqZWN0XCIuXG4gICAgaWYgKHR5cGUuZmxhZ3MgPT09IHRzLlR5cGVGbGFncy5Ob25QcmltaXRpdmUpIHJldHVybiAnIU9iamVjdCc7XG5cbiAgICAvLyBBdm9pZCBpbmZpbml0ZSBsb29wcyBvbiByZWN1cnNpdmUgdHlwZSBsaXRlcmFscy5cbiAgICAvLyBJdCB3b3VsZCBiZSBuaWNlIHRvIGp1c3QgZW1pdCB0aGUgbmFtZSBvZiB0aGUgcmVjdXJzaXZlIHR5cGUgaGVyZSAoaW4gdHlwZS5hbGlhc1N5bWJvbFxuICAgIC8vIGJlbG93KSwgYnV0IENsb3N1cmUgQ29tcGlsZXIgZG9lcyBub3QgYWxsb3cgcmVjdXJzaXZlIHR5cGUgZGVmaW5pdGlvbnMuXG4gICAgaWYgKHRoaXMuc2VlbkFub255bW91c1R5cGVzLmhhcyh0eXBlKSkgcmV0dXJuICc/JztcblxuICAgIGxldCBpc0FtYmllbnQgPSBmYWxzZTtcbiAgICBsZXQgaXNJbk5hbWVzcGFjZSA9IGZhbHNlO1xuICAgIGxldCBpc01vZHVsZSA9IGZhbHNlO1xuICAgIGlmICh0eXBlLnN5bWJvbCkge1xuICAgICAgZm9yIChjb25zdCBkZWNsIG9mIHR5cGUuc3ltYm9sLmRlY2xhcmF0aW9ucyB8fCBbXSkge1xuICAgICAgICBpZiAodHMuaXNFeHRlcm5hbE1vZHVsZShkZWNsLmdldFNvdXJjZUZpbGUoKSkpIGlzTW9kdWxlID0gdHJ1ZTtcbiAgICAgICAgaWYgKGRlY2wuZ2V0U291cmNlRmlsZSgpLmlzRGVjbGFyYXRpb25GaWxlKSBpc0FtYmllbnQgPSB0cnVlO1xuICAgICAgICBsZXQgY3VycmVudDogdHMuRGVjbGFyYXRpb258dW5kZWZpbmVkID0gZGVjbDtcbiAgICAgICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgICAgICBpZiAodHMuZ2V0Q29tYmluZWRNb2RpZmllckZsYWdzKGN1cnJlbnQpICYgdHMuTW9kaWZpZXJGbGFncy5BbWJpZW50KSBpc0FtYmllbnQgPSB0cnVlO1xuICAgICAgICAgIGlmIChjdXJyZW50LmtpbmQgPT09IHRzLlN5bnRheEtpbmQuTW9kdWxlRGVjbGFyYXRpb24pIGlzSW5OYW1lc3BhY2UgPSB0cnVlO1xuICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudCBhcyB0cy5EZWNsYXJhdGlvbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRzaWNrbGUgY2Fubm90IGdlbmVyYXRlIHR5cGVzIGZvciBub24tYW1iaWVudCBuYW1lc3BhY2VzIG5vciBhbnkgc3ltYm9scyBjb250YWluZWQgaW4gdGhlbS5cbiAgICBpZiAoaXNJbk5hbWVzcGFjZSAmJiAhaXNBbWJpZW50KSByZXR1cm4gJz8nO1xuXG4gICAgLy8gVHlwZXMgaW4gZXh0ZXJucyBjYW5ub3QgcmVmZXJlbmNlIHR5cGVzIGZyb20gZXh0ZXJuYWwgbW9kdWxlcy5cbiAgICAvLyBIb3dldmVyIGFtYmllbnQgdHlwZXMgaW4gbW9kdWxlcyBnZXQgbW92ZWQgdG8gZXh0ZXJucywgdG9vLCBzbyB0eXBlIHJlZmVyZW5jZXMgd29yayBhbmQgd2VcbiAgICAvLyBjYW4gZW1pdCBhIHByZWNpc2UgdHlwZS5cbiAgICBpZiAodGhpcy5pc0ZvckV4dGVybnMgJiYgaXNNb2R1bGUgJiYgIWlzQW1iaWVudCkgcmV0dXJuICc/JztcblxuICAgIGNvbnN0IGxhc3RGbGFnID0gdHMuVHlwZUZsYWdzLlN1YnN0aXR1dGlvbjtcbiAgICBjb25zdCBtYXNrID0gKGxhc3RGbGFnIDw8IDEpIC0gMTtcbiAgICBzd2l0Y2ggKHR5cGUuZmxhZ3MgJiBtYXNrKSB7XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5Bbnk6XG4gICAgICAgIHJldHVybiAnPyc7XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5Vbmtub3duOlxuICAgICAgICByZXR1cm4gJyonO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuU3RyaW5nOlxuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuU3RyaW5nTGl0ZXJhbDpcbiAgICAgICAgcmV0dXJuICdzdHJpbmcnO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuTnVtYmVyOlxuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuTnVtYmVyTGl0ZXJhbDpcbiAgICAgICAgcmV0dXJuICdudW1iZXInO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuQm9vbGVhbjpcbiAgICAgIGNhc2UgdHMuVHlwZUZsYWdzLkJvb2xlYW5MaXRlcmFsOlxuICAgICAgICAvLyBTZWUgdGhlIG5vdGUgaW4gdHJhbnNsYXRlVW5pb24gYWJvdXQgYm9vbGVhbnMuXG4gICAgICAgIHJldHVybiAnYm9vbGVhbic7XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5FbnVtOlxuICAgICAgICBpZiAoIXR5cGUuc3ltYm9sKSB7XG4gICAgICAgICAgdGhpcy53YXJuKGBFbnVtVHlwZSB3aXRob3V0IGEgc3ltYm9sYCk7XG4gICAgICAgICAgcmV0dXJuICc/JztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5zeW1ib2xUb1N0cmluZyh0eXBlLnN5bWJvbCkgfHwgJz8nO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuRVNTeW1ib2w6XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5VbmlxdWVFU1N5bWJvbDpcbiAgICAgICAgLy8gRVNTeW1ib2wgaW5kaWNhdGVzIHNvbWV0aGluZyB0eXBlZCBzeW1ib2wuXG4gICAgICAgIC8vIFVuaXF1ZUVTU3ltYm9sIGluZGljYXRlcyBhIHNwZWNpZmljIHVuaXF1ZSBzeW1ib2wsIHVzZWQgZS5nLiB0byBpbmRleCBpbnRvIGFuIG9iamVjdC5cbiAgICAgICAgLy8gQ2xvc3VyZSBkb2VzIG5vdCBoYXZlIHRoaXMgZGlzdGluY3Rpb24sIHNvIHRzaWNrbGUgZW1pdHMgYm90aCBhcyAnc3ltYm9sJy5cbiAgICAgICAgcmV0dXJuICdzeW1ib2wnO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuVm9pZDpcbiAgICAgICAgcmV0dXJuICd2b2lkJztcbiAgICAgIGNhc2UgdHMuVHlwZUZsYWdzLlVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuICd1bmRlZmluZWQnO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuQmlnSW50OlxuICAgICAgICByZXR1cm4gJ2JpZ2ludFBsYWNlaG9sZGVyJztcbiAgICAgIGNhc2UgdHMuVHlwZUZsYWdzLk51bGw6XG4gICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5OZXZlcjpcbiAgICAgICAgdGhpcy53YXJuKGBzaG91bGQgbm90IGVtaXQgYSAnbmV2ZXInIHR5cGVgKTtcbiAgICAgICAgcmV0dXJuICc/JztcbiAgICAgIGNhc2UgdHMuVHlwZUZsYWdzLlR5cGVQYXJhbWV0ZXI6XG4gICAgICAgIC8vIFRoaXMgaXMgZS5nLiB0aGUgVCBpbiBhIHR5cGUgbGlrZSBGb288VD4uXG4gICAgICAgIGlmICghdHlwZS5zeW1ib2wpIHtcbiAgICAgICAgICB0aGlzLndhcm4oYFR5cGVQYXJhbWV0ZXIgd2l0aG91dCBhIHN5bWJvbGApOyAgLy8gc2hvdWxkIG5vdCBoYXBwZW4gKHRtKVxuICAgICAgICAgIHJldHVybiAnPyc7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSW4gQ2xvc3VyZSwgdHlwZSBwYXJhbWV0ZXJzIChcIjxUPlwiKSBhcmUgbm9uLW51bGxhYmxlIGJ5IGRlZmF1bHQsIHVubGlrZSByZWZlcmVuY2VzIHRvXG4gICAgICAgIC8vIGNsYXNzZXMgb3IgaW50ZXJmYWNlcy4gSG93ZXZlciB0aGlzIGNvZGUgcGF0aCBjYW4gYmUgcmVhY2hlZCBieSBib3VuZCB0eXBlIHBhcmFtZXRlcnMsXG4gICAgICAgIC8vIHdoZXJlIHRoZSB0eXBlIHBhcmFtZXRlcidzIHN5bWJvbCByZWZlcmVuY2VzIGEgcGxhaW4gY2xhc3Mgb3IgaW50ZXJmYWNlLiBJbiB0aGlzIGNhc2UsXG4gICAgICAgIC8vIGFkZCBgIWAgdG8gYXZvaWQgZW1pdHRpbmcgYSBudWxsYWJsZSB0eXBlLlxuICAgICAgICBsZXQgcHJlZml4ID0gJyc7XG4gICAgICAgIGlmICgodHlwZS5zeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5UeXBlUGFyYW1ldGVyKSA9PT0gMCkge1xuICAgICAgICAgIHByZWZpeCA9ICchJztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5zeW1ib2xUb1N0cmluZyh0eXBlLnN5bWJvbCk7XG4gICAgICAgIGlmICghbmFtZSkgcmV0dXJuICc/JztcbiAgICAgICAgcmV0dXJuIHByZWZpeCArIG5hbWU7XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5PYmplY3Q6XG4gICAgICAgIHJldHVybiB0aGlzLnRyYW5zbGF0ZU9iamVjdCh0eXBlIGFzIHRzLk9iamVjdFR5cGUpO1xuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuVW5pb246XG4gICAgICAgIHJldHVybiB0aGlzLnRyYW5zbGF0ZVVuaW9uKHR5cGUgYXMgdHMuVW5pb25UeXBlKTtcbiAgICAgIGNhc2UgdHMuVHlwZUZsYWdzLkNvbmRpdGlvbmFsOlxuICAgICAgY2FzZSB0cy5UeXBlRmxhZ3MuU3Vic3RpdHV0aW9uOlxuICAgICAgICB0aGlzLndhcm4oYGVtaXR0aW5nID8gZm9yIGNvbmRpdGlvbmFsL3N1YnN0aXR1dGlvbiB0eXBlYCk7XG4gICAgICAgIHJldHVybiAnPyc7XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5JbnRlcnNlY3Rpb246XG4gICAgICBjYXNlIHRzLlR5cGVGbGFncy5JbmRleDpcbiAgICAgIGNhc2UgdHMuVHlwZUZsYWdzLkluZGV4ZWRBY2Nlc3M6XG4gICAgICAgIC8vIFRPRE8odHMyLjEpOiBoYW5kbGUgdGhlc2Ugc3BlY2lhbCB0eXBlcy5cbiAgICAgICAgdGhpcy53YXJuKGB1bmhhbmRsZWQgdHlwZSBmbGFnczogJHt0cy5UeXBlRmxhZ3NbdHlwZS5mbGFnc119YCk7XG4gICAgICAgIHJldHVybiAnPyc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyBIYW5kbGUgY2FzZXMgd2hlcmUgbXVsdGlwbGUgZmxhZ3MgYXJlIHNldC5cblxuICAgICAgICAvLyBUeXBlcyB3aXRoIGxpdGVyYWwgbWVtYmVycyBhcmUgcmVwcmVzZW50ZWQgYXNcbiAgICAgICAgLy8gICB0cy5UeXBlRmxhZ3MuVW5pb24gfCBbbGl0ZXJhbCBtZW1iZXJdXG4gICAgICAgIC8vIEUuZy4gYW4gZW51bSB0eXBlZCB2YWx1ZSBpcyBhIHVuaW9uIHR5cGUgd2l0aCB0aGUgZW51bSdzIG1lbWJlcnMgYXMgaXRzIG1lbWJlcnMuIEFcbiAgICAgICAgLy8gYm9vbGVhbiB0eXBlIGlzIGEgdW5pb24gdHlwZSB3aXRoICd0cnVlJyBhbmQgJ2ZhbHNlJyBhcyBpdHMgbWVtYmVycy5cbiAgICAgICAgLy8gTm90ZSBhbHNvIHRoYXQgaW4gYSBtb3JlIGNvbXBsZXggdW5pb24sIGUuZy4gYm9vbGVhbnxudW1iZXIsIHRoZW4gaXQncyBhIHVuaW9uIG9mIHRocmVlXG4gICAgICAgIC8vIHRoaW5ncyAodHJ1ZXxmYWxzZXxudW1iZXIpIGFuZCB0cy5UeXBlRmxhZ3MuQm9vbGVhbiBkb2Vzbid0IHNob3cgdXAgYXQgYWxsLlxuICAgICAgICBpZiAodHlwZS5mbGFncyAmIHRzLlR5cGVGbGFncy5Vbmlvbikge1xuICAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zbGF0ZVVuaW9uKHR5cGUgYXMgdHMuVW5pb25UeXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlLmZsYWdzICYgdHMuVHlwZUZsYWdzLkVudW1MaXRlcmFsKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNsYXRlRW51bUxpdGVyYWwodHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgc3dpdGNoIHN0YXRlbWVudCBzaG91bGQgaGF2ZSBiZWVuIGV4aGF1c3RpdmUuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdW5rbm93biB0eXBlIGZsYWdzICR7dHlwZS5mbGFnc30gb24gJHt0eXBlVG9EZWJ1Z1N0cmluZyh0eXBlKX1gKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHRyYW5zbGF0ZVVuaW9uKHR5cGU6IHRzLlVuaW9uVHlwZSk6IHN0cmluZyB7XG4gICAgbGV0IHBhcnRzID0gdHlwZS50eXBlcy5tYXAodCA9PiB0aGlzLnRyYW5zbGF0ZSh0KSk7XG4gICAgLy8gVW5pb24gdHlwZXMgdGhhdCBpbmNsdWRlIGxpdGVyYWxzIChlLmcuIGJvb2xlYW4sIGVudW0pIGNhbiBlbmQgdXAgcmVwZWF0aW5nIHRoZSBzYW1lIENsb3N1cmVcbiAgICAvLyB0eXBlLiBGb3IgZXhhbXBsZTogdHJ1ZSB8IGJvb2xlYW4gd2lsbCBiZSB0cmFuc2xhdGVkIHRvIGJvb2xlYW4gfCBib29sZWFuLlxuICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIHRvIHByb2R1Y2UgdHlwZXMgdGhhdCByZWFkIGJldHRlci5cbiAgICBwYXJ0cyA9IHBhcnRzLmZpbHRlcigoZWwsIGlkeCkgPT4gcGFydHMuaW5kZXhPZihlbCkgPT09IGlkeCk7XG4gICAgcmV0dXJuIHBhcnRzLmxlbmd0aCA9PT0gMSA/IHBhcnRzWzBdIDogYCgke3BhcnRzLmpvaW4oJ3wnKX0pYDtcbiAgfVxuXG4gIHByaXZhdGUgdHJhbnNsYXRlRW51bUxpdGVyYWwodHlwZTogdHMuVHlwZSk6IHN0cmluZyB7XG4gICAgLy8gU3VwcG9zZSB5b3UgaGFkOlxuICAgIC8vICAgZW51bSBFbnVtVHlwZSB7IE1FTUJFUiB9XG4gICAgLy8gdGhlbiB0aGUgdHlwZSBvZiBcIkVudW1UeXBlLk1FTUJFUlwiIGlzIGFuIGVudW0gbGl0ZXJhbCAodGhlIHRoaW5nIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uKVxuICAgIC8vIGFuZCBpdCBoYXMgdHlwZSBmbGFncyB0aGF0IGluY2x1ZGVcbiAgICAvLyAgIHRzLlR5cGVGbGFncy5OdW1iZXJMaXRlcmFsIHwgdHMuVHlwZUZsYWdzLkVudW1MaXRlcmFsXG4gICAgLy9cbiAgICAvLyBDbG9zdXJlIENvbXBpbGVyIGRvZXNuJ3Qgc3VwcG9ydCBsaXRlcmFscyBpbiB0eXBlcywgc28gdGhpcyBjb2RlIG11c3Qgbm90IGVtaXRcbiAgICAvLyBcIkVudW1UeXBlLk1FTUJFUlwiLCBidXQgcmF0aGVyIFwiRW51bVR5cGVcIi5cblxuICAgIGNvbnN0IGVudW1MaXRlcmFsQmFzZVR5cGUgPSB0aGlzLnR5cGVDaGVja2VyLmdldEJhc2VUeXBlT2ZMaXRlcmFsVHlwZSh0eXBlKTtcbiAgICBpZiAoIWVudW1MaXRlcmFsQmFzZVR5cGUuc3ltYm9sKSB7XG4gICAgICB0aGlzLndhcm4oYEVudW1MaXRlcmFsVHlwZSB3aXRob3V0IGEgc3ltYm9sYCk7XG4gICAgICByZXR1cm4gJz8nO1xuICAgIH1cbiAgICBsZXQgc3ltYm9sID0gZW51bUxpdGVyYWxCYXNlVHlwZS5zeW1ib2w7XG4gICAgaWYgKGVudW1MaXRlcmFsQmFzZVR5cGUgPT09IHR5cGUpIHtcbiAgICAgIC8vIFR5cGVTY3JpcHQncyBBUEkgd2lsbCByZXR1cm4gdGhlIHNhbWUgRW51bUxpdGVyYWwgdHlwZSBpZiB0aGUgZW51bSBvbmx5IGhhcyBhIHNpbmdsZSBtZW1iZXJcbiAgICAgIC8vIHZhbHVlLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8yODg2OS5cbiAgICAgIC8vIEluIHRoYXQgY2FzZSwgdGFrZSB0aGUgcGFyZW50IHN5bWJvbCBvZiB0aGUgZW51bSBtZW1iZXIsIHdoaWNoIHNob3VsZCBiZSB0aGUgZW51bVxuICAgICAgLy8gZGVjbGFyYXRpb24uXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IHdvcmtpbmcgYXJvdW5kIGEgVFMgQVBJIGRlZmljaWVuY3kuXG4gICAgICBjb25zdCBwYXJlbnQ6IHRzLlN5bWJvbHx1bmRlZmluZWQgPSAoc3ltYm9sIGFzIGFueSkucGFyZW50O1xuICAgICAgaWYgKCFwYXJlbnQpIHJldHVybiAnPyc7XG4gICAgICBzeW1ib2wgPSBwYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLnN5bWJvbFRvU3RyaW5nKHN5bWJvbCk7XG4gICAgaWYgKCFuYW1lKSByZXR1cm4gJz8nO1xuICAgIC8vIEluIENsb3N1cmUsIGVudW0gdHlwZXMgYXJlIG5vbi1udWxsIGJ5IGRlZmF1bHQsIHNvIHdlIHdvdWxkbid0IG5lZWQgdG8gZW1pdCB0aGUgYCFgIGhlcmUuXG4gICAgLy8gSG93ZXZlciB0aGF0J3MgY29uZnVzaW5nIHRvIHVzZXJzLCB0byB0aGUgcG9pbnQgdGhhdCBzdHlsZSBndWlkZXMgYW5kIGxpbnRlcnMgcmVxdWlyZSB0b1xuICAgIC8vICphbHdheXMqIHNwZWNpZnkgdGhlIG51bGxhYmlsaXR5IG1vZGlmaWVyLiBUbyBiZSBjb25zaXN0ZW50IHdpdGggdGhhdCBzdHlsZSwgaW5jbHVkZSBpdCBoZXJlXG4gICAgLy8gYXMgd2VsbC5cbiAgICByZXR1cm4gJyEnICsgbmFtZTtcbiAgfVxuXG4gIC8vIHRyYW5zbGF0ZU9iamVjdCB0cmFuc2xhdGVzIGEgdHMuT2JqZWN0VHlwZSwgd2hpY2ggaXMgdGhlIHR5cGUgb2YgYWxsXG4gIC8vIG9iamVjdC1saWtlIHRoaW5ncyBpbiBUUywgc3VjaCBhcyBjbGFzc2VzIGFuZCBpbnRlcmZhY2VzLlxuICBwcml2YXRlIHRyYW5zbGF0ZU9iamVjdCh0eXBlOiB0cy5PYmplY3RUeXBlKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZS5zeW1ib2wgJiYgdGhpcy5pc0JsYWNrTGlzdGVkKHR5cGUuc3ltYm9sKSkgcmV0dXJuICc/JztcblxuICAgIC8vIE5PVEU6IG9iamVjdEZsYWdzIGlzIGFuIGVudW0sIGJ1dCBhIGdpdmVuIHR5cGUgY2FuIGhhdmUgbXVsdGlwbGUgZmxhZ3MuXG4gICAgLy8gQXJyYXk8c3RyaW5nPiBpcyBib3RoIHRzLk9iamVjdEZsYWdzLlJlZmVyZW5jZSBhbmQgdHMuT2JqZWN0RmxhZ3MuSW50ZXJmYWNlLlxuXG4gICAgaWYgKHR5cGUub2JqZWN0RmxhZ3MgJiB0cy5PYmplY3RGbGFncy5DbGFzcykge1xuICAgICAgaWYgKCF0eXBlLnN5bWJvbCkge1xuICAgICAgICB0aGlzLndhcm4oJ2NsYXNzIGhhcyBubyBzeW1ib2wnKTtcbiAgICAgICAgcmV0dXJuICc/JztcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLnN5bWJvbFRvU3RyaW5nKHR5cGUuc3ltYm9sKTtcbiAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAvLyBBbiBhbm9ueW1vdXMgdHlwZS4gTWFrZSBzdXJlIG5vdCB0byBlbWl0ICchPycsIGFzIHRoYXQgaXMgYSBzeW50YXggZXJyb3IgaW4gQ2xvc3VyZVxuICAgICAgICAvLyBDb21waWxlci5cbiAgICAgICAgcmV0dXJuICc/JztcbiAgICAgIH1cbiAgICAgIHJldHVybiAnIScgKyBuYW1lO1xuICAgIH0gZWxzZSBpZiAodHlwZS5vYmplY3RGbGFncyAmIHRzLk9iamVjdEZsYWdzLkludGVyZmFjZSkge1xuICAgICAgLy8gTm90ZTogdHMuSW50ZXJmYWNlVHlwZSBoYXMgYSB0eXBlUGFyYW1ldGVycyBmaWVsZCwgYnV0IHRoYXRcbiAgICAgIC8vIHNwZWNpZmllcyB0aGUgcGFyYW1ldGVycyB0aGF0IHRoZSBpbnRlcmZhY2UgdHlwZSAqZXhwZWN0cypcbiAgICAgIC8vIHdoZW4gaXQncyB1c2VkLCBhbmQgc2hvdWxkIG5vdCBiZSB0cmFuc2Zvcm1lZCB0byB0aGUgb3V0cHV0LlxuICAgICAgLy8gRS5nLiBhIHR5cGUgbGlrZSBBcnJheTxudW1iZXI+IGlzIGEgVHlwZVJlZmVyZW5jZSB0byB0aGVcbiAgICAgIC8vIEludGVyZmFjZVR5cGUgXCJBcnJheVwiLCBidXQgdGhlIFwibnVtYmVyXCIgdHlwZSBwYXJhbWV0ZXIgaXNcbiAgICAgIC8vIHBhcnQgb2YgdGhlIG91dGVyIFR5cGVSZWZlcmVuY2UsIG5vdCBhIHR5cGVQYXJhbWV0ZXIgb25cbiAgICAgIC8vIHRoZSBJbnRlcmZhY2VUeXBlLlxuICAgICAgaWYgKCF0eXBlLnN5bWJvbCkge1xuICAgICAgICB0aGlzLndhcm4oJ2ludGVyZmFjZSBoYXMgbm8gc3ltYm9sJyk7XG4gICAgICAgIHJldHVybiAnPyc7XG4gICAgICB9XG4gICAgICBpZiAodHlwZS5zeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5WYWx1ZSkge1xuICAgICAgICAvLyBUaGUgc3ltYm9sIGlzIGJvdGggYSB0eXBlIGFuZCBhIHZhbHVlLlxuICAgICAgICAvLyBGb3IgdXNlci1kZWZpbmVkIHR5cGVzIGluIHRoaXMgc3RhdGUsIHdlIGRvbid0IGhhdmUgYSBDbG9zdXJlIG5hbWVcbiAgICAgICAgLy8gZm9yIHRoZSB0eXBlLiAgU2VlIHRoZSB0eXBlX2FuZF92YWx1ZSB0ZXN0LlxuICAgICAgICBpZiAoIWlzQ2xvc3VyZVByb3ZpZGVkVHlwZSh0eXBlLnN5bWJvbCkpIHtcbiAgICAgICAgICB0aGlzLndhcm4oYHR5cGUvc3ltYm9sIGNvbmZsaWN0IGZvciAke3R5cGUuc3ltYm9sLm5hbWV9LCB1c2luZyB7P30gZm9yIG5vd2ApO1xuICAgICAgICAgIHJldHVybiAnPyc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAnIScgKyB0aGlzLnN5bWJvbFRvU3RyaW5nKHR5cGUuc3ltYm9sKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUub2JqZWN0RmxhZ3MgJiB0cy5PYmplY3RGbGFncy5SZWZlcmVuY2UpIHtcbiAgICAgIC8vIEEgcmVmZXJlbmNlIHRvIGFub3RoZXIgdHlwZSwgZS5nLiBBcnJheTxudW1iZXI+IHJlZmVycyB0byBBcnJheS5cbiAgICAgIC8vIEVtaXQgdGhlIHJlZmVyZW5jZWQgdHlwZSBhbmQgYW55IHR5cGUgYXJndW1lbnRzLlxuICAgICAgY29uc3QgcmVmZXJlbmNlVHlwZSA9IHR5cGUgYXMgdHMuVHlwZVJlZmVyZW5jZTtcblxuICAgICAgLy8gQSB0dXBsZSBpcyBhIFJlZmVyZW5jZVR5cGUgd2hlcmUgdGhlIHRhcmdldCBpcyBmbGFnZ2VkIFR1cGxlIGFuZCB0aGVcbiAgICAgIC8vIHR5cGVBcmd1bWVudHMgYXJlIHRoZSB0dXBsZSBhcmd1bWVudHMuICBKdXN0IHRyZWF0IGl0IGFzIGEgbXlzdGVyeVxuICAgICAgLy8gYXJyYXksIGJlY2F1c2UgQ2xvc3VyZSBkb2Vzbid0IHVuZGVyc3RhbmQgdHVwbGVzLlxuICAgICAgaWYgKHJlZmVyZW5jZVR5cGUudGFyZ2V0Lm9iamVjdEZsYWdzICYgdHMuT2JqZWN0RmxhZ3MuVHVwbGUpIHtcbiAgICAgICAgcmV0dXJuICchQXJyYXk8Pz4nO1xuICAgICAgfVxuXG4gICAgICBsZXQgdHlwZVN0ciA9ICcnO1xuICAgICAgaWYgKHJlZmVyZW5jZVR5cGUudGFyZ2V0ID09PSByZWZlcmVuY2VUeXBlKSB7XG4gICAgICAgIC8vIFdlIGdldCBpbnRvIGFuIGluZmluaXRlIGxvb3AgaGVyZSBpZiB0aGUgaW5uZXIgcmVmZXJlbmNlIGlzXG4gICAgICAgIC8vIHRoZSBzYW1lIGFzIHRoZSBvdXRlcjsgdGhpcyBjYW4gb2NjdXIgd2hlbiB0aGlzIGZ1bmN0aW9uXG4gICAgICAgIC8vIGZhaWxzIHRvIHRyYW5zbGF0ZSBhIG1vcmUgc3BlY2lmaWMgdHlwZSBiZWZvcmUgZ2V0dGluZyB0b1xuICAgICAgICAvLyB0aGlzIHBvaW50LlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgcmVmZXJlbmNlIGxvb3AgaW4gJHt0eXBlVG9EZWJ1Z1N0cmluZyhyZWZlcmVuY2VUeXBlKX0gJHtyZWZlcmVuY2VUeXBlLmZsYWdzfWApO1xuICAgICAgfVxuICAgICAgdHlwZVN0ciArPSB0aGlzLnRyYW5zbGF0ZShyZWZlcmVuY2VUeXBlLnRhcmdldCk7XG4gICAgICAvLyBUcmFuc2xhdGUgY2FuIHJldHVybiAnPycgZm9yIGEgbnVtYmVyIG9mIHNpdHVhdGlvbnMsIGUuZy4gdHlwZS92YWx1ZSBjb25mbGljdHMuXG4gICAgICAvLyBgPzw/PmAgaXMgaWxsZWdhbCBzeW50YXggaW4gQ2xvc3VyZSBDb21waWxlciwgc28ganVzdCByZXR1cm4gYD9gIGhlcmUuXG4gICAgICBpZiAodHlwZVN0ciA9PT0gJz8nKSByZXR1cm4gJz8nO1xuICAgICAgaWYgKHJlZmVyZW5jZVR5cGUudHlwZUFyZ3VtZW50cykge1xuICAgICAgICBjb25zdCBwYXJhbXMgPSByZWZlcmVuY2VUeXBlLnR5cGVBcmd1bWVudHMubWFwKHQgPT4gdGhpcy50cmFuc2xhdGUodCkpO1xuICAgICAgICB0eXBlU3RyICs9IGA8JHtwYXJhbXMuam9pbignLCAnKX0+YDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0eXBlU3RyO1xuICAgIH0gZWxzZSBpZiAodHlwZS5vYmplY3RGbGFncyAmIHRzLk9iamVjdEZsYWdzLkFub255bW91cykge1xuICAgICAgaWYgKCF0eXBlLnN5bWJvbCkge1xuICAgICAgICAvLyBUaGlzIGNvbWVzIHVwIHdoZW4gZ2VuZXJhdGluZyBjb2RlIGZvciBhbiBhcnJvdyBmdW5jdGlvbiBhcyBwYXNzZWRcbiAgICAgICAgLy8gdG8gYSBnZW5lcmljIGZ1bmN0aW9uLiAgVGhlIHBhc3NlZC1pbiB0eXBlIGlzIHRhZ2dlZCBhcyBhbm9ueW1vdXNcbiAgICAgICAgLy8gYW5kIGhhcyBubyBwcm9wZXJ0aWVzIHNvIGl0J3MgaGFyZCB0byBmaWd1cmUgb3V0IHdoYXQgdG8gZ2VuZXJhdGUuXG4gICAgICAgIC8vIEp1c3QgYXZvaWQgaXQgZm9yIG5vdyBzbyB3ZSBkb24ndCBjcmFzaC5cbiAgICAgICAgdGhpcy53YXJuKCdhbm9ueW1vdXMgdHlwZSBoYXMgbm8gc3ltYm9sJyk7XG4gICAgICAgIHJldHVybiAnPyc7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlLnN5bWJvbC5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLkZ1bmN0aW9uIHx8XG4gICAgICAgICAgdHlwZS5zeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5NZXRob2QpIHtcbiAgICAgICAgY29uc3Qgc2lncyA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0U2lnbmF0dXJlc09mVHlwZSh0eXBlLCB0cy5TaWduYXR1cmVLaW5kLkNhbGwpO1xuICAgICAgICBpZiAoc2lncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zaWduYXR1cmVUb0Nsb3N1cmUoc2lnc1swXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy53YXJuKCd1bmhhbmRsZWQgYW5vbnltb3VzIHR5cGUgd2l0aCBtdWx0aXBsZSBjYWxsIHNpZ25hdHVyZXMnKTtcbiAgICAgICAgcmV0dXJuICc/JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRyYW5zbGF0ZUFub255bW91c1R5cGUodHlwZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICBUT0RPKHRzMi4xKTogbW9yZSB1bmhhbmRsZWQgb2JqZWN0IHR5cGUgZmxhZ3M6XG4gICAgICBUdXBsZVxuICAgICAgTWFwcGVkXG4gICAgICBJbnN0YW50aWF0ZWRcbiAgICAgIE9iamVjdExpdGVyYWxcbiAgICAgIEV2b2x2aW5nQXJyYXlcbiAgICAgIE9iamVjdExpdGVyYWxQYXR0ZXJuV2l0aENvbXB1dGVkUHJvcGVydGllc1xuICAgICovXG4gICAgdGhpcy53YXJuKGB1bmhhbmRsZWQgdHlwZSAke3R5cGVUb0RlYnVnU3RyaW5nKHR5cGUpfWApO1xuICAgIHJldHVybiAnPyc7XG4gIH1cblxuICAvKipcbiAgICogdHJhbnNsYXRlQW5vbnltb3VzVHlwZSB0cmFuc2xhdGVzIGEgdHMuVHlwZUZsYWdzLk9iamVjdFR5cGUgdGhhdCBpcyBhbHNvXG4gICAqIHRzLk9iamVjdEZsYWdzLkFub255bW91cy4gVGhhdCBpcywgdGhpcyB0eXBlJ3Mgc3ltYm9sIGRvZXMgbm90IGhhdmUgYSBuYW1lLiBUaGlzIGlzIHRoZVxuICAgKiBhbm9ueW1vdXMgdHlwZSBlbmNvdW50ZXJlZCBpbiBlLmcuXG4gICAqICAgICBsZXQgeDoge2E6IG51bWJlcn07XG4gICAqIEJ1dCBhbHNvIHRoZSBpbmZlcnJlZCB0eXBlIGluOlxuICAgKiAgICAgbGV0IHggPSB7YTogMX07ICAvLyB0eXBlIG9mIHggaXMge2E6IG51bWJlcn0sIGFzIGFib3ZlXG4gICAqL1xuICBwcml2YXRlIHRyYW5zbGF0ZUFub255bW91c1R5cGUodHlwZTogdHMuVHlwZSk6IHN0cmluZyB7XG4gICAgdGhpcy5zZWVuQW5vbnltb3VzVHlwZXMuYWRkKHR5cGUpO1xuICAgIC8vIEdhdGhlciB1cCBhbGwgdGhlIG5hbWVkIGZpZWxkcyBhbmQgd2hldGhlciB0aGUgb2JqZWN0IGlzIGFsc28gY2FsbGFibGUuXG4gICAgbGV0IGNhbGxhYmxlID0gZmFsc2U7XG4gICAgbGV0IGluZGV4YWJsZSA9IGZhbHNlO1xuICAgIGNvbnN0IGZpZWxkczogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoIXR5cGUuc3ltYm9sIHx8ICF0eXBlLnN5bWJvbC5tZW1iZXJzKSB7XG4gICAgICB0aGlzLndhcm4oJ2Fub255bW91cyB0eXBlIGhhcyBubyBzeW1ib2wnKTtcbiAgICAgIHJldHVybiAnPyc7XG4gICAgfVxuXG4gICAgLy8gc3BlY2lhbC1jYXNlIGNvbnN0cnVjdCBzaWduYXR1cmVzLlxuICAgIGNvbnN0IGN0b3JzID0gdHlwZS5nZXRDb25zdHJ1Y3RTaWduYXR1cmVzKCk7XG4gICAgaWYgKGN0b3JzLmxlbmd0aCkge1xuICAgICAgLy8gVE9ETyhtYXJ0aW5wcm9ic3QpOiB0aGlzIGRvZXMgbm90IHN1cHBvcnQgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIGRlZmluZWQgb24gY29uc3RydWN0b3JzXG4gICAgICAvLyAobm90IGV4cHJlc3NpYmxlIGluIENsb3N1cmUpLCBub3IgbXVsdGlwbGUgY29uc3RydWN0b3JzIChzYW1lKS5cbiAgICAgIGNvbnN0IGRlY2wgPSBjdG9yc1swXS5kZWNsYXJhdGlvbjtcbiAgICAgIGlmICghZGVjbCkge1xuICAgICAgICB0aGlzLndhcm4oJ3VuaGFuZGxlZCBhbm9ueW1vdXMgdHlwZSB3aXRoIGNvbnN0cnVjdG9yIHNpZ25hdHVyZSBidXQgbm8gZGVjbGFyYXRpb24nKTtcbiAgICAgICAgcmV0dXJuICc/JztcbiAgICAgIH1cbiAgICAgIGlmIChkZWNsLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuSlNEb2NTaWduYXR1cmUpIHtcbiAgICAgICAgdGhpcy53YXJuKCd1bmhhbmRsZWQgSlNEb2MgYmFzZWQgY29uc3RydWN0b3Igc2lnbmF0dXJlJyk7XG4gICAgICAgIHJldHVybiAnPyc7XG4gICAgICB9XG5cbiAgICAgIC8vIG5ldyA8VD4odGVlOiBUKSBpcyBub3Qgc3VwcG9ydGVkIGJ5IENsb3N1cmUsIGJsYWNrbGlzdCBhcyA/LlxuICAgICAgdGhpcy5ibGFja2xpc3RUeXBlUGFyYW1ldGVycyh0aGlzLnN5bWJvbHNUb0FsaWFzZWROYW1lcywgZGVjbC50eXBlUGFyYW1ldGVycyk7XG5cbiAgICAgIGNvbnN0IHBhcmFtcyA9IHRoaXMuY29udmVydFBhcmFtcyhjdG9yc1swXSwgZGVjbC5wYXJhbWV0ZXJzKTtcbiAgICAgIGNvbnN0IHBhcmFtc1N0ciA9IHBhcmFtcy5sZW5ndGggPyAoJywgJyArIHBhcmFtcy5qb2luKCcsICcpKSA6ICcnO1xuICAgICAgY29uc3QgY29uc3RydWN0ZWRUeXBlID0gdGhpcy50cmFuc2xhdGUoY3RvcnNbMF0uZ2V0UmV0dXJuVHlwZSgpKTtcbiAgICAgIC8vIEluIHRoZSBzcGVjaWZpYyBjYXNlIG9mIHRoZSBcIm5ld1wiIGluIGEgZnVuY3Rpb24sIGl0IGFwcGVhcnMgdGhhdFxuICAgICAgLy8gICBmdW5jdGlvbihuZXc6ICFCYXIpXG4gICAgICAvLyBmYWlscyB0byBwYXJzZSwgd2hpbGVcbiAgICAgIC8vICAgZnVuY3Rpb24obmV3OiAoIUJhcikpXG4gICAgICAvLyBwYXJzZXMgaW4gdGhlIHdheSB5b3UnZCBleHBlY3QuXG4gICAgICAvLyBJdCBhcHBlYXJzIGZyb20gdGVzdGluZyB0aGF0IENsb3N1cmUgaWdub3JlcyB0aGUgISBhbnl3YXkgYW5kIGp1c3RcbiAgICAgIC8vIGFzc3VtZXMgdGhlIHJlc3VsdCB3aWxsIGJlIG5vbi1udWxsIGluIGVpdGhlciBjYXNlLiAgKFRvIGJlIHBlZGFudGljLFxuICAgICAgLy8gaXQncyBwb3NzaWJsZSB0byByZXR1cm4gbnVsbCBmcm9tIGEgY3RvciBpdCBzZWVtcyBsaWtlIGEgYmFkIGlkZWEuKVxuICAgICAgcmV0dXJuIGBmdW5jdGlvbihuZXc6ICgke2NvbnN0cnVjdGVkVHlwZX0pJHtwYXJhbXNTdHJ9KTogP2A7XG4gICAgfVxuXG4gICAgLy8gbWVtYmVycyBpcyBhbiBFUzYgbWFwLCBidXQgdGhlIC5kLnRzIGRlZmluaW5nIGl0IGRlZmluZWQgdGhlaXIgb3duIG1hcFxuICAgIC8vIHR5cGUsIHNvIHR5cGVzY3JpcHQgZG9lc24ndCBiZWxpZXZlIHRoYXQgLmtleXMoKSBpcyBpdGVyYWJsZVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICBmb3IgKGNvbnN0IGZpZWxkIG9mICh0eXBlLnN5bWJvbC5tZW1iZXJzLmtleXMoKSBhcyBhbnkpKSB7XG4gICAgICBzd2l0Y2ggKGZpZWxkKSB7XG4gICAgICAgIGNhc2UgJ19fY2FsbCc6XG4gICAgICAgICAgY2FsbGFibGUgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdfX2luZGV4JzpcbiAgICAgICAgICBpbmRleGFibGUgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICghaXNWYWxpZENsb3N1cmVQcm9wZXJ0eU5hbWUoZmllbGQpKSB7XG4gICAgICAgICAgICB0aGlzLndhcm4oYG9taXR0aW5nIGluZXhwcmVzc2libGUgcHJvcGVydHkgbmFtZTogJHtmaWVsZH1gKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBtZW1iZXIgPSB0eXBlLnN5bWJvbC5tZW1iZXJzLmdldChmaWVsZCkhO1xuICAgICAgICAgIC8vIG9wdGlvbmFsIG1lbWJlcnMgYXJlIGhhbmRsZWQgYnkgdGhlIHR5cGUgaW5jbHVkaW5nIHx1bmRlZmluZWQgaW4gYSB1bmlvbiB0eXBlLlxuICAgICAgICAgIGNvbnN0IG1lbWJlclR5cGUgPVxuICAgICAgICAgICAgICB0aGlzLnRyYW5zbGF0ZSh0aGlzLnR5cGVDaGVja2VyLmdldFR5cGVPZlN5bWJvbEF0TG9jYXRpb24obWVtYmVyLCB0aGlzLm5vZGUpKTtcbiAgICAgICAgICBmaWVsZHMucHVzaChgJHtmaWVsZH06ICR7bWVtYmVyVHlwZX1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUcnkgdG8gc3BlY2lhbC1jYXNlIHBsYWluIGtleS12YWx1ZSBvYmplY3RzIGFuZCBmdW5jdGlvbnMuXG4gICAgaWYgKGZpZWxkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGlmIChjYWxsYWJsZSAmJiAhaW5kZXhhYmxlKSB7XG4gICAgICAgIC8vIEEgZnVuY3Rpb24gdHlwZS5cbiAgICAgICAgY29uc3Qgc2lncyA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0U2lnbmF0dXJlc09mVHlwZSh0eXBlLCB0cy5TaWduYXR1cmVLaW5kLkNhbGwpO1xuICAgICAgICBpZiAoc2lncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zaWduYXR1cmVUb0Nsb3N1cmUoc2lnc1swXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaW5kZXhhYmxlICYmICFjYWxsYWJsZSkge1xuICAgICAgICAvLyBBIHBsYWluIGtleS12YWx1ZSBtYXAgdHlwZS5cbiAgICAgICAgbGV0IGtleVR5cGUgPSAnc3RyaW5nJztcbiAgICAgICAgbGV0IHZhbFR5cGUgPSB0aGlzLnR5cGVDaGVja2VyLmdldEluZGV4VHlwZU9mVHlwZSh0eXBlLCB0cy5JbmRleEtpbmQuU3RyaW5nKTtcbiAgICAgICAgaWYgKCF2YWxUeXBlKSB7XG4gICAgICAgICAga2V5VHlwZSA9ICdudW1iZXInO1xuICAgICAgICAgIHZhbFR5cGUgPSB0aGlzLnR5cGVDaGVja2VyLmdldEluZGV4VHlwZU9mVHlwZSh0eXBlLCB0cy5JbmRleEtpbmQuTnVtYmVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZhbFR5cGUpIHtcbiAgICAgICAgICB0aGlzLndhcm4oJ3Vua25vd24gaW5kZXgga2V5IHR5cGUnKTtcbiAgICAgICAgICByZXR1cm4gYCFPYmplY3Q8Pyw/PmA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGAhT2JqZWN0PCR7a2V5VHlwZX0sJHt0aGlzLnRyYW5zbGF0ZSh2YWxUeXBlKX0+YDtcbiAgICAgIH0gZWxzZSBpZiAoIWNhbGxhYmxlICYmICFpbmRleGFibGUpIHtcbiAgICAgICAgLy8gVGhlIG9iamVjdCBoYXMgbm8gbWVtYmVycy4gIFRoaXMgaXMgdGhlIFRTIHR5cGUgJ3t9JyxcbiAgICAgICAgLy8gd2hpY2ggbWVhbnMgXCJhbnkgdmFsdWUgb3RoZXIgdGhhbiBudWxsIG9yIHVuZGVmaW5lZFwiLlxuICAgICAgICAvLyBXaGF0IGlzIHRoaXMgaW4gQ2xvc3VyZSdzIHR5cGUgc3lzdGVtP1xuICAgICAgICAvL1xuICAgICAgICAvLyBGaXJzdCwgeyFPYmplY3R9IGlzIHdyb25nIGJlY2F1c2UgaXQgaXMgbm90IGEgc3VwZXJ0eXBlIG9mXG4gICAgICAgIC8vIHtzdHJpbmd9IG9yIHtudW1iZXJ9LiAgVGhpcyB3b3VsZCBtZWFuIHlvdSBjYW5ub3QgYXNzaWduIGFcbiAgICAgICAgLy8gbnVtYmVyIHRvIGEgdmFyaWFibGUgb2YgVFMgdHlwZSB7fS5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gV2UgZ2V0IGNsb3NlciB3aXRoIHsqfSwgYWthIHRoZSBBTEwgdHlwZS4gIFRoaXMgb25lIGJldHRlclxuICAgICAgICAvLyBjYXB0dXJlcyB0aGUgdHlwaWNhbCB1c2Ugb2YgdGhlIFRTIHt9LCB3aGljaCB1c2VycyB1c2UgZm9yXG4gICAgICAgIC8vIFwiSSBkb24ndCBjYXJlXCIuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHsqfSB1bmZvcnR1bmF0ZWx5IGRvZXMgaW5jbHVkZSBudWxsL3VuZGVmaW5lZCwgc28gaXQncyBhIGNsb3NlclxuICAgICAgICAvLyBtYXRjaCBmb3IgVFMgMy4wJ3MgJ3Vua25vd24nLlxuICAgICAgICByZXR1cm4gJyonO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghY2FsbGFibGUgJiYgIWluZGV4YWJsZSkge1xuICAgICAgLy8gTm90IGNhbGxhYmxlLCBub3QgaW5kZXhhYmxlOyBpbXBsaWVzIGEgcGxhaW4gb2JqZWN0IHdpdGggZmllbGRzIGluIGl0LlxuICAgICAgcmV0dXJuIGB7JHtmaWVsZHMuam9pbignLCAnKX19YDtcbiAgICB9XG5cbiAgICB0aGlzLndhcm4oJ3VuaGFuZGxlZCBhbm9ueW1vdXMgdHlwZScpO1xuICAgIHJldHVybiAnPyc7XG4gIH1cblxuICAvKiogQ29udmVydHMgYSB0cy5TaWduYXR1cmUgKGZ1bmN0aW9uIHNpZ25hdHVyZSkgdG8gYSBDbG9zdXJlIGZ1bmN0aW9uIHR5cGUuICovXG4gIHByaXZhdGUgc2lnbmF0dXJlVG9DbG9zdXJlKHNpZzogdHMuU2lnbmF0dXJlKTogc3RyaW5nIHtcbiAgICAvLyBUT0RPKG1hcnRpbnByb2JzdCk6IENvbnNpZGVyIGhhcm1vbml6aW5nIHNvbWUgb3ZlcmxhcCB3aXRoIGVtaXRGdW5jdGlvblR5cGUgaW4gdHNpY2tsZS50cy5cbiAgICBpZiAoIXNpZy5kZWNsYXJhdGlvbikge1xuICAgICAgdGhpcy53YXJuKCdzaWduYXR1cmUgd2l0aG91dCBkZWNsYXJhdGlvbicpO1xuICAgICAgcmV0dXJuICdGdW5jdGlvbic7XG4gICAgfVxuICAgIGlmIChzaWcuZGVjbGFyYXRpb24ua2luZCA9PT0gdHMuU3ludGF4S2luZC5KU0RvY1NpZ25hdHVyZSkge1xuICAgICAgdGhpcy53YXJuKCdzaWduYXR1cmUgd2l0aCBKU0RvYyBkZWNsYXJhdGlvbicpO1xuICAgICAgcmV0dXJuICdGdW5jdGlvbic7XG4gICAgfVxuICAgIHRoaXMuYmxhY2tsaXN0VHlwZVBhcmFtZXRlcnModGhpcy5zeW1ib2xzVG9BbGlhc2VkTmFtZXMsIHNpZy5kZWNsYXJhdGlvbi50eXBlUGFyYW1ldGVycyk7XG5cbiAgICBsZXQgdHlwZVN0ciA9IGBmdW5jdGlvbihgO1xuICAgIGxldCBwYXJhbURlY2xzOiBSZWFkb25seUFycmF5PHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uPiA9IHNpZy5kZWNsYXJhdGlvbi5wYXJhbWV0ZXJzIHx8IFtdO1xuICAgIGNvbnN0IG1heWJlVGhpc1BhcmFtID0gcGFyYW1EZWNsc1swXTtcbiAgICAvLyBPZGRseSwgdGhlIHRoaXMgdHlwZSBzaG93cyB1cCBpbiBwYXJhbURlY2xzLCBidXQgbm90IGluIHRoZSB0eXBlJ3MgcGFyYW1ldGVycy5cbiAgICAvLyBIYW5kbGUgaXQgaGVyZSBhbmQgdGhlbiBwYXNzIHBhcmFtRGVjbHMgZG93biB3aXRob3V0IGl0cyBmaXJzdCBlbGVtZW50LlxuICAgIGlmIChtYXliZVRoaXNQYXJhbSAmJiBtYXliZVRoaXNQYXJhbS5uYW1lLmdldFRleHQoKSA9PT0gJ3RoaXMnKSB7XG4gICAgICBpZiAobWF5YmVUaGlzUGFyYW0udHlwZSkge1xuICAgICAgICBjb25zdCB0aGlzVHlwZSA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0VHlwZUF0TG9jYXRpb24obWF5YmVUaGlzUGFyYW0udHlwZSk7XG4gICAgICAgIHR5cGVTdHIgKz0gYHRoaXM6ICgke3RoaXMudHJhbnNsYXRlKHRoaXNUeXBlKX0pYDtcbiAgICAgICAgaWYgKHBhcmFtRGVjbHMubGVuZ3RoID4gMSkgdHlwZVN0ciArPSAnLCAnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy53YXJuKCd0aGlzIHR5cGUgd2l0aG91dCB0eXBlJyk7XG4gICAgICB9XG4gICAgICBwYXJhbURlY2xzID0gcGFyYW1EZWNscy5zbGljZSgxKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSB0aGlzLmNvbnZlcnRQYXJhbXMoc2lnLCBwYXJhbURlY2xzKTtcbiAgICB0eXBlU3RyICs9IGAke3BhcmFtcy5qb2luKCcsICcpfSlgO1xuXG4gICAgY29uc3QgcmV0VHlwZSA9IHRoaXMudHJhbnNsYXRlKHRoaXMudHlwZUNoZWNrZXIuZ2V0UmV0dXJuVHlwZU9mU2lnbmF0dXJlKHNpZykpO1xuICAgIGlmIChyZXRUeXBlKSB7XG4gICAgICB0eXBlU3RyICs9IGA6ICR7cmV0VHlwZX1gO1xuICAgIH1cblxuICAgIHJldHVybiB0eXBlU3RyO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIHBhcmFtZXRlcnMgZm9yIHRoZSBnaXZlbiBzaWduYXR1cmUuIFRha2VzIHBhcmFtZXRlciBkZWNsYXJhdGlvbnMgYXMgdGhvc2UgbWlnaHQgbm90XG4gICAqIG1hdGNoIHRoZSBzaWduYXR1cmUgcGFyYW1ldGVycyAoZS5nLiB0aGVyZSBtaWdodCBiZSBhbiBhZGRpdGlvbmFsIHRoaXMgcGFyYW1ldGVyKS4gVGhpc1xuICAgKiBkaWZmZXJlbmNlIGlzIGhhbmRsZWQgYnkgdGhlIGNhbGxlciwgYXMgaXMgY29udmVydGluZyB0aGUgXCJ0aGlzXCIgcGFyYW1ldGVyLlxuICAgKi9cbiAgcHJpdmF0ZSBjb252ZXJ0UGFyYW1zKHNpZzogdHMuU2lnbmF0dXJlLCBwYXJhbURlY2xzOiBSZWFkb25seUFycmF5PHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uPik6XG4gICAgICBzdHJpbmdbXSB7XG4gICAgY29uc3QgcGFyYW1UeXBlczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpZy5wYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwYXJhbSA9IHNpZy5wYXJhbWV0ZXJzW2ldO1xuXG4gICAgICBjb25zdCBwYXJhbURlY2wgPSBwYXJhbURlY2xzW2ldO1xuICAgICAgY29uc3Qgb3B0aW9uYWwgPSAhIXBhcmFtRGVjbC5xdWVzdGlvblRva2VuO1xuICAgICAgY29uc3QgdmFyQXJncyA9ICEhcGFyYW1EZWNsLmRvdERvdERvdFRva2VuO1xuICAgICAgbGV0IHBhcmFtVHlwZSA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0VHlwZU9mU3ltYm9sQXRMb2NhdGlvbihwYXJhbSwgdGhpcy5ub2RlKTtcbiAgICAgIGlmICh2YXJBcmdzKSB7XG4gICAgICAgIGlmICgocGFyYW1UeXBlLmZsYWdzICYgdHMuVHlwZUZsYWdzLk9iamVjdCkgPT09IDApIHtcbiAgICAgICAgICB0aGlzLndhcm4oJ3ZhciBhcmdzIHR5cGUgaXMgbm90IGFuIG9iamVjdCB0eXBlJyk7XG4gICAgICAgICAgcGFyYW1UeXBlcy5wdXNoKCchQXJyYXk8Pz4nKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKChwYXJhbVR5cGUgYXMgdHMuT2JqZWN0VHlwZSkub2JqZWN0RmxhZ3MgJiB0cy5PYmplY3RGbGFncy5SZWZlcmVuY2UpID09PSAwKSB7XG4gICAgICAgICAgdGhpcy53YXJuKCd1bnN1cHBvcnRlZCB2YXIgYXJncyB0eXBlIChub3QgYW4gYXJyYXkgcmVmZXJlbmNlKScpO1xuICAgICAgICAgIHBhcmFtVHlwZXMucHVzaCgnIUFycmF5PD8+Jyk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdHlwZVJlZiA9IHBhcmFtVHlwZSBhcyB0cy5UeXBlUmVmZXJlbmNlO1xuICAgICAgICBpZiAoIXR5cGVSZWYudHlwZUFyZ3VtZW50cykge1xuICAgICAgICAgIC8vIFdoZW4gYSByZXN0IGFyZ3VtZW50IHJlc29sdmVzIGVtcHR5LCBpLmUuIHRoZSBjb25jcmV0ZSBpbnN0YW50aWF0aW9uIGRvZXMgbm90IHRha2UgYW55XG4gICAgICAgICAgLy8gYXJndW1lbnRzLCB0aGUgdHlwZSBhcmd1bWVudHMgYXJlIGVtcHR5LiBFbWl0IGEgZnVuY3Rpb24gdHlwZSB0aGF0IHRha2VzIG5vIGFyZyBpbiB0aGlzXG4gICAgICAgICAgLy8gcG9zaXRpb24gdGhlbi5cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBwYXJhbVR5cGUgPSB0eXBlUmVmLnR5cGVBcmd1bWVudHNbMF07XG4gICAgICB9XG4gICAgICBsZXQgdHlwZVN0ciA9IHRoaXMudHJhbnNsYXRlKHBhcmFtVHlwZSk7XG4gICAgICBpZiAodmFyQXJncykgdHlwZVN0ciA9ICcuLi4nICsgdHlwZVN0cjtcbiAgICAgIGlmIChvcHRpb25hbCkgdHlwZVN0ciA9IHR5cGVTdHIgKyAnPSc7XG4gICAgICBwYXJhbVR5cGVzLnB1c2godHlwZVN0cik7XG4gICAgfVxuICAgIHJldHVybiBwYXJhbVR5cGVzO1xuICB9XG5cbiAgd2Fybihtc2c6IHN0cmluZykge1xuICAgIC8vIEJ5IGRlZmF1bHQsIHdhcm4oKSBkb2VzIG5vdGhpbmcuICBUaGUgY2FsbGVyIHdpbGwgb3ZlcndyaXRlIHRoaXNcbiAgICAvLyBpZiBpdCB3YW50cyBkaWZmZXJlbnQgYmVoYXZpb3IuXG4gIH1cblxuICAvKiogQHJldHVybiB0cnVlIGlmIHN5bSBzaG91bGQgYWx3YXlzIGhhdmUgdHlwZSB7P30uICovXG4gIGlzQmxhY2tMaXN0ZWQoc3ltYm9sOiB0cy5TeW1ib2wpOiBib29sZWFuIHtcbiAgICByZXR1cm4gaXNCbGFja2xpc3RlZCh0aGlzLnBhdGhCbGFja0xpc3QsIHN5bWJvbCk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvc3VyZSBkb2VzbiBub3Qgc3VwcG9ydCB0eXBlIHBhcmFtZXRlcnMgZm9yIGZ1bmN0aW9uIHR5cGVzLCBpLmUuIGdlbmVyaWMgZnVuY3Rpb24gdHlwZXMuXG4gICAqIEJsYWNrbGlzdCB0aGUgc3ltYm9scyBkZWNsYXJlZCBieSB0aGVtIGFuZCBlbWl0IGEgPyBmb3IgdGhlIHR5cGVzLlxuICAgKlxuICAgKiBUaGlzIG11dGF0ZXMgdGhlIGdpdmVuIGJsYWNrbGlzdCBtYXAuIFRoZSBtYXAncyBzY29wZSBpcyBvbmUgZmlsZSwgYW5kIHN5bWJvbHMgYXJlXG4gICAqIHVuaXF1ZSBvYmplY3RzLCBzbyB0aGlzIHNob3VsZCBuZWl0aGVyIGxlYWQgdG8gZXhjZXNzaXZlIG1lbW9yeSBjb25zdW1wdGlvbiBub3IgaW50cm9kdWNlXG4gICAqIGVycm9ycy5cbiAgICpcbiAgICogQHBhcmFtIGJsYWNrbGlzdCBhIG1hcCB0byBzdG9yZSB0aGUgYmxhY2tsaXN0ZWQgc3ltYm9scyBpbiwgd2l0aCBhIHZhbHVlIG9mICc/Jy4gSW4gcHJhY3RpY2UsXG4gICAqICAgICB0aGlzIGlzIGFsd2F5cyA9PT0gdGhpcy5zeW1ib2xzVG9BbGlhc2VkTmFtZXMsIGJ1dCB3ZSdyZSBwYXNzaW5nIGl0IGV4cGxpY2l0bHkgdG8gbWFrZSBpdFxuICAgKiAgICBjbGVhciB0aGF0IHRoZSBtYXAgaXMgbXV0YXRlZCAoaW4gcGFydGljdWxhciB3aGVuIHVzZWQgZnJvbSBvdXRzaWRlIHRoZSBjbGFzcykuXG4gICAqIEBwYXJhbSBkZWNscyB0aGUgZGVjbGFyYXRpb25zIHdob3NlIHN5bWJvbHMgc2hvdWxkIGJlIGJsYWNrbGlzdGVkLlxuICAgKi9cbiAgYmxhY2tsaXN0VHlwZVBhcmFtZXRlcnMoXG4gICAgICBibGFja2xpc3Q6IE1hcDx0cy5TeW1ib2wsIHN0cmluZz4sXG4gICAgICBkZWNsczogUmVhZG9ubHlBcnJheTx0cy5UeXBlUGFyYW1ldGVyRGVjbGFyYXRpb24+fHVuZGVmaW5lZCkge1xuICAgIGlmICghZGVjbHMgfHwgIWRlY2xzLmxlbmd0aCkgcmV0dXJuO1xuICAgIGZvciAoY29uc3QgdHBkIG9mIGRlY2xzKSB7XG4gICAgICBjb25zdCBzeW0gPSB0aGlzLnR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24odHBkLm5hbWUpO1xuICAgICAgaWYgKCFzeW0pIHtcbiAgICAgICAgdGhpcy53YXJuKGB0eXBlIHBhcmFtZXRlciB3aXRoIG5vIHN5bWJvbGApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJsYWNrbGlzdC5zZXQoc3ltLCAnPycpO1xuICAgIH1cbiAgfVxufVxuXG4vKiogQHJldHVybiB0cnVlIGlmIHN5bSBzaG91bGQgYWx3YXlzIGhhdmUgdHlwZSB7P30uICovXG5leHBvcnQgZnVuY3Rpb24gaXNCbGFja2xpc3RlZChwYXRoQmxhY2tMaXN0OiBTZXQ8c3RyaW5nPnx1bmRlZmluZWQsIHN5bWJvbDogdHMuU3ltYm9sKSB7XG4gIGlmIChwYXRoQmxhY2tMaXN0ID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgLy8gU29tZSBidWlsdGluIHR5cGVzLCBzdWNoIGFzIHt9LCBnZXQgcmVwcmVzZW50ZWQgYnkgYSBzeW1ib2wgdGhhdCBoYXMgbm8gZGVjbGFyYXRpb25zLlxuICBpZiAoc3ltYm9sLmRlY2xhcmF0aW9ucyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBzeW1ib2wuZGVjbGFyYXRpb25zLmV2ZXJ5KG4gPT4ge1xuICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5ub3JtYWxpemUobi5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWUpO1xuICAgIHJldHVybiBwYXRoQmxhY2tMaXN0LmhhcyhmaWxlTmFtZSk7XG4gIH0pO1xufVxuIl19