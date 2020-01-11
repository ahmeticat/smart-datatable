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
        define("tsickle/src/jsdoc_transformer", ["require", "exports", "typescript", "tsickle/src/annotator_host", "tsickle/src/decorators", "tsickle/src/googmodule", "tsickle/src/jsdoc", "tsickle/src/module_type_translator", "tsickle/src/transformer_util", "tsickle/src/type_translator"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * @fileoverview jsdoc_transformer contains the logic to add JSDoc comments to TypeScript code.
     *
     * One of tsickle's features is to add Closure Compiler compatible JSDoc comments containing type
     * annotations, inheritance information, etc., onto TypeScript code. This allows Closure Compiler to
     * make better optimization decisions compared to an untyped code base.
     *
     * The entry point to the annotation operation is jsdocTransformer below. It adds synthetic comments
     * to existing TypeScript constructs, for example:
     *     const x: number = 1;
     * Might get transformed to:
     *     /.. \@type {number} ./
     *     const x: number = 1;
     * Later TypeScript phases then remove the type annotation, and the final emit is JavaScript that
     * only contains the JSDoc comment.
     *
     * To handle certain constructs, this transformer also performs AST transformations, e.g. by adding
     * CommonJS-style exports for type constructs, expanding `export *`, parenthesizing casts, etc.
     */
    const ts = require("typescript");
    const annotator_host_1 = require("tsickle/src/annotator_host");
    const decorators_1 = require("tsickle/src/decorators");
    const googmodule = require("tsickle/src/googmodule");
    const jsdoc = require("tsickle/src/jsdoc");
    const module_type_translator_1 = require("tsickle/src/module_type_translator");
    const transformerUtil = require("tsickle/src/transformer_util");
    const type_translator_1 = require("tsickle/src/type_translator");
    function addCommentOn(node, tags, escapeExtraTags) {
        const comment = jsdoc.toSynthesizedComment(tags, escapeExtraTags);
        const comments = ts.getSyntheticLeadingComments(node) || [];
        comments.push(comment);
        ts.setSyntheticLeadingComments(node, comments);
        return comment;
    }
    /** Adds an \@template clause to docTags if decl has type parameters. */
    function maybeAddTemplateClause(docTags, decl) {
        if (!decl.typeParameters)
            return;
        // Closure does not support template constraints (T extends X), these are ignored below.
        docTags.push({
            tagName: 'template',
            text: decl.typeParameters.map(tp => transformerUtil.getIdentifierText(tp.name)).join(', ')
        });
    }
    exports.maybeAddTemplateClause = maybeAddTemplateClause;
    /**
     * Adds heritage clauses (\@extends, \@implements) to the given docTags for decl. Used by
     * jsdoc_transformer and externs generation.
     */
    function maybeAddHeritageClauses(docTags, mtt, decl) {
        if (!decl.heritageClauses)
            return;
        const isClass = decl.kind === ts.SyntaxKind.ClassDeclaration;
        const hasExtends = decl.heritageClauses.some(c => c.token === ts.SyntaxKind.ExtendsKeyword);
        for (const heritage of decl.heritageClauses) {
            const isExtends = heritage.token === ts.SyntaxKind.ExtendsKeyword;
            if (isClass && isExtends) {
                // If a class has an "extends", that is preserved in the ES6 output
                // and we don't need to emit any additional jsdoc.
                //
                // However for ambient declarations, we only emit externs, and in those we do need to
                // add "@extends {Foo}" as they use ES5 syntax.
                if (!transformerUtil.isAmbient(decl))
                    continue;
            }
            // Otherwise, if we get here, we need to emit some jsdoc.
            for (const expr of heritage.types) {
                const heritage = heritageName(isExtends, hasExtends, expr);
                // heritageName may return null, indicating that the clause is something inexpressible
                // in Closure, e.g. "class Foo implements Partial<Bar>".
                if (heritage) {
                    docTags.push({
                        tagName: heritage.tagName,
                        type: heritage.parentName,
                    });
                }
            }
        }
        /**
         * Computes the Closure name of an expression occurring in a heritage clause,
         * e.g. "implements FooBar".  Will return null if the expression is inexpressible
         * in Closure semantics.  Note that we don't need to consider all possible
         * combinations of types/values and extends/implements because our input is
         * already verified to be valid TypeScript.  See test_files/class/ for the full
         * cartesian product of test cases.
         * @param isExtends True if we're in an 'extends', false in an 'implements'.
         * @param hasExtends True if there are any 'extends' clauses present at all.
         */
        function heritageName(isExtends, hasExtends, expr) {
            let tagName = isExtends ? 'extends' : 'implements';
            let sym = mtt.typeChecker.getSymbolAtLocation(expr.expression);
            if (!sym) {
                // It's possible for a class declaration to extend an expression that
                // does not have have a symbol, for example when a mixin function is
                // used to build a base class, as in `declare MyClass extends
                // MyMixin(MyBaseClass)`.
                //
                // Handling this correctly is tricky. Closure throws on this
                // `extends <expression>` syntax (see
                // https://github.com/google/closure-compiler/issues/2182). We would
                // probably need to generate an intermediate class declaration and
                // extend that.
                mtt.debugWarn(decl, `could not resolve supertype: ${expr.getText()}`);
                return null;
            }
            // Resolve any aliases to the underlying type.
            if (sym.flags & ts.SymbolFlags.TypeAlias) {
                // It's implementing a type alias.  Follow the type alias back
                // to the original symbol to check whether it's a type or a value.
                const type = mtt.typeChecker.getDeclaredTypeOfSymbol(sym);
                if (!type.symbol) {
                    // It's not clear when this can happen.
                    mtt.debugWarn(decl, `could not get type of symbol: ${expr.getText()}`);
                    return null;
                }
                sym = type.symbol;
            }
            if (sym.flags & ts.SymbolFlags.Alias) {
                sym = mtt.typeChecker.getAliasedSymbol(sym);
            }
            const typeTranslator = mtt.newTypeTranslator(expr.expression);
            if (typeTranslator.isBlackListed(sym)) {
                // Don't emit references to blacklisted types.
                return null;
            }
            if (sym.flags & ts.SymbolFlags.Class) {
                if (!isClass) {
                    // Closure interfaces cannot extend or implements classes.
                    mtt.debugWarn(decl, `omitting interface deriving from class: ${expr.getText()}`);
                    return null;
                }
                if (!isExtends) {
                    if (!hasExtends) {
                        // A special case: for a class that has no existing 'extends' clause but does
                        // have an 'implements' clause that refers to another class, we change it to
                        // instead be an 'extends'.  This was a poorly-thought-out hack that may
                        // actually cause compiler bugs:
                        //   https://github.com/google/closure-compiler/issues/3126
                        // but we have code that now relies on it, ugh.
                        tagName = 'extends';
                    }
                    else {
                        // Closure can only @implements an interface, not a class.
                        mtt.debugWarn(decl, `omitting @implements of a class: ${expr.getText()}`);
                        return null;
                    }
                }
            }
            else if (sym.flags & ts.SymbolFlags.Value) {
                // If it's something other than a class in the value namespace, then it will
                // not be a type in the Closure output (because Closure collapses
                // the type and value namespaces).
                mtt.debugWarn(decl, `omitting heritage reference to a type/value conflict: ${expr.getText()}`);
                return null;
            }
            else if (sym.flags & ts.SymbolFlags.TypeLiteral) {
                // A type literal is a type like `{foo: string}`.
                // These can come up as the output of a mapped type.
                mtt.debugWarn(decl, `omitting heritage reference to a type literal: ${expr.getText()}`);
                return null;
            }
            // typeToClosure includes nullability modifiers, so call symbolToString directly here.
            const parentName = typeTranslator.symbolToString(sym);
            if (!parentName)
                return null;
            return { tagName, parentName };
        }
    }
    exports.maybeAddHeritageClauses = maybeAddHeritageClauses;
    /**
     * createMemberTypeDeclaration emits the type annotations for members of a class. It's necessary in
     * the case where TypeScript syntax specifies there are additional properties on the class, because
     * to declare these in Closure you must declare these separately from the class.
     *
     * createMemberTypeDeclaration produces an if (false) statement containing property declarations, or
     * null if no declarations could or needed to be generated (e.g. no members, or an unnamed type).
     * The if statement is used to make sure the code is not executed, otherwise property accesses could
     * trigger getters on a superclass. See test_files/fields/fields.ts:BaseThatThrows.
     */
    function createMemberTypeDeclaration(mtt, typeDecl) {
        // Gather parameter properties from the constructor, if it exists.
        const ctors = [];
        let paramProps = [];
        const nonStaticProps = [];
        const staticProps = [];
        const unhandled = [];
        const abstractMethods = [];
        for (const member of typeDecl.members) {
            if (member.kind === ts.SyntaxKind.Constructor) {
                ctors.push(member);
            }
            else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
                const isStatic = transformerUtil.hasModifierFlag(member, ts.ModifierFlags.Static);
                if (isStatic) {
                    staticProps.push(member);
                }
                else {
                    nonStaticProps.push(member);
                }
            }
            else if (member.kind === ts.SyntaxKind.MethodDeclaration ||
                member.kind === ts.SyntaxKind.MethodSignature ||
                member.kind === ts.SyntaxKind.GetAccessor || member.kind === ts.SyntaxKind.SetAccessor) {
                if (transformerUtil.hasModifierFlag(member, ts.ModifierFlags.Abstract) ||
                    ts.isInterfaceDeclaration(typeDecl)) {
                    abstractMethods.push(member);
                }
                // Non-abstract methods only exist on classes, and are handled in regular emit.
            }
            else {
                unhandled.push(member);
            }
        }
        if (ctors.length > 0) {
            // Only the actual constructor implementation, which must be last in a potential sequence of
            // overloaded constructors, may contain parameter properties.
            const ctor = ctors[ctors.length - 1];
            paramProps = ctor.parameters.filter(p => transformerUtil.hasModifierFlag(p, ts.ModifierFlags.ParameterPropertyModifier));
        }
        if (nonStaticProps.length === 0 && paramProps.length === 0 && staticProps.length === 0 &&
            abstractMethods.length === 0) {
            // There are no members so we don't need to emit any type
            // annotations helper.
            return null;
        }
        if (!typeDecl.name) {
            mtt.debugWarn(typeDecl, 'cannot add types on unnamed declarations');
            return null;
        }
        const className = transformerUtil.getIdentifierText(typeDecl.name);
        const staticPropAccess = ts.createIdentifier(className);
        const instancePropAccess = ts.createPropertyAccess(staticPropAccess, 'prototype');
        // Closure Compiler will report conformance errors about this being unknown type when emitting
        // class properties as {?|undefined}, instead of just {?}. So make sure to only emit {?|undefined}
        // on interfaces.
        const isInterface = ts.isInterfaceDeclaration(typeDecl);
        const propertyDecls = staticProps.map(p => createClosurePropertyDeclaration(mtt, staticPropAccess, p, isInterface && !!p.questionToken));
        propertyDecls.push(...[...nonStaticProps, ...paramProps].map(p => createClosurePropertyDeclaration(mtt, instancePropAccess, p, isInterface && !!p.questionToken)));
        propertyDecls.push(...unhandled.map(p => transformerUtil.createMultiLineComment(p, `Skipping unhandled member: ${escapeForComment(p.getText())}`)));
        for (const fnDecl of abstractMethods) {
            const name = propertyName(fnDecl);
            if (!name) {
                mtt.error(fnDecl, 'anonymous abstract function');
                continue;
            }
            const { tags, parameterNames } = mtt.getFunctionTypeJSDoc([fnDecl], []);
            if (decorators_1.hasExportingDecorator(fnDecl, mtt.typeChecker))
                tags.push({ tagName: 'export' });
            // memberNamespace because abstract methods cannot be static in TypeScript.
            const abstractFnDecl = ts.createStatement(ts.createAssignment(ts.createPropertyAccess(instancePropAccess, name), ts.createFunctionExpression(
            /* modifiers */ undefined, 
            /* asterisk */ undefined, 
            /* name */ undefined, 
            /* typeParameters */ undefined, parameterNames.map(n => ts.createParameter(
            /* decorators */ undefined, /* modifiers */ undefined, 
            /* dotDotDot */ undefined, n)), undefined, ts.createBlock([]))));
            ts.setSyntheticLeadingComments(abstractFnDecl, [jsdoc.toSynthesizedComment(tags)]);
            propertyDecls.push(ts.setSourceMapRange(abstractFnDecl, fnDecl));
        }
        // See test_files/fields/fields.ts:BaseThatThrows for a note on this wrapper.
        return ts.createIf(ts.createLiteral(false), ts.createBlock(propertyDecls, true));
    }
    function propertyName(prop) {
        if (!prop.name)
            return null;
        switch (prop.name.kind) {
            case ts.SyntaxKind.Identifier:
                return transformerUtil.getIdentifierText(prop.name);
            case ts.SyntaxKind.StringLiteral:
                // E.g. interface Foo { 'bar': number; }
                // If 'bar' is a name that is not valid in Closure then there's nothing we can do.
                const text = prop.name.text;
                if (!type_translator_1.isValidClosurePropertyName(text))
                    return null;
                return text;
            default:
                return null;
        }
    }
    /** Removes comment metacharacters from a string, to make it safe to embed in a comment. */
    function escapeForComment(str) {
        return str.replace(/\/\*/g, '__').replace(/\*\//g, '__');
    }
    exports.escapeForComment = escapeForComment;
    function createClosurePropertyDeclaration(mtt, expr, prop, optional) {
        const name = propertyName(prop);
        if (!name) {
            mtt.debugWarn(prop, `handle unnamed member:\n${escapeForComment(prop.getText())}`);
            return transformerUtil.createMultiLineComment(prop, `Skipping unnamed member:\n${escapeForComment(prop.getText())}`);
        }
        let type = mtt.typeToClosure(prop);
        // When a property is optional, e.g.
        //   foo?: string;
        // Then the TypeScript type of the property is string|undefined, the
        // typeToClosure translation handles it correctly, and string|undefined is
        // how you write an optional property in Closure.
        //
        // But in the special case of an optional property with type any:
        //   foo?: any;
        // The TypeScript type of the property is just "any" (because any includes
        // undefined as well) so our default translation of the type is just "?".
        // To mark the property as optional in Closure it must have "|undefined",
        // so the Closure type must be ?|undefined.
        if (optional && type === '?')
            type += '|undefined';
        const tags = mtt.getJSDoc(prop, /* reportWarnings */ true);
        tags.push({ tagName: 'type', type });
        const flags = ts.getCombinedModifierFlags(prop);
        if (flags & ts.ModifierFlags.Protected) {
            tags.push({ tagName: 'protected' });
        }
        else if (flags & ts.ModifierFlags.Private) {
            tags.push({ tagName: 'private' });
        }
        if (decorators_1.hasExportingDecorator(prop, mtt.typeChecker)) {
            tags.push({ tagName: 'export' });
        }
        const declStmt = ts.setSourceMapRange(ts.createStatement(ts.createPropertyAccess(expr, name)), prop);
        // Avoid printing annotations that can conflict with @type
        // This avoids Closure's error "type annotation incompatible with other annotations"
        addCommentOn(declStmt, tags, jsdoc.TAGS_CONFLICTING_WITH_TYPE);
        return declStmt;
    }
    /**
     * Removes any type assertions and non-null expressions from the AST before TypeScript processing.
     *
     * Ideally, the code in jsdoc_transformer below should just remove the cast expression and
     * replace it with the Closure equivalent. However Angular's compiler is fragile to AST
     * nodes being removed or changing type, so the code must retain the type assertion
     * expression, see: https://github.com/angular/angular/issues/24895.
     *
     * tsickle also cannot just generate and keep a `(/.. @type {SomeType} ./ (expr as SomeType))`
     * because TypeScript removes the parenthesized expressions in that syntax, (reasonably) believing
     * they were only added for the TS cast.
     *
     * The final workaround is then to keep the TypeScript type assertions, and have a post-Angular
     * processing step that removes the assertions before TypeScript sees them.
     *
     * TODO(martinprobst): remove once the Angular issue is fixed.
     */
    function removeTypeAssertions() {
        return (context) => {
            return (sourceFile) => {
                function visitor(node) {
                    switch (node.kind) {
                        case ts.SyntaxKind.TypeAssertionExpression:
                        case ts.SyntaxKind.AsExpression:
                            return ts.visitNode(node.expression, visitor);
                        case ts.SyntaxKind.NonNullExpression:
                            return ts.visitNode(node.expression, visitor);
                        default:
                            break;
                    }
                    return ts.visitEachChild(node, visitor, context);
                }
                return visitor(sourceFile);
            };
        };
    }
    exports.removeTypeAssertions = removeTypeAssertions;
    /**
     * jsdocTransformer returns a transformer factory that converts TypeScript types into the equivalent
     * JSDoc annotations.
     */
    function jsdocTransformer(host, tsOptions, moduleResolutionHost, typeChecker, diagnostics) {
        return (context) => {
            return (sourceFile) => {
                const moduleTypeTranslator = new module_type_translator_1.ModuleTypeTranslator(sourceFile, typeChecker, host, diagnostics, /*isForExterns*/ false);
                /**
                 * The set of all names exported from an export * in the current module. Used to prevent
                 * emitting duplicated exports. The first export * takes precedence in ES6.
                 */
                const expandedStarImports = new Set();
                /**
                 * While Closure compiler supports parameterized types, including parameterized `this` on
                 * methods, it does not support constraints on them. That means that an `\@template`d type is
                 * always considered to be `unknown` within the method, including `THIS`.
                 *
                 * To help Closure Compiler, we keep track of any templated this return type, and substitute
                 * explicit casts to the templated type.
                 *
                 * This is an incomplete solution and works around a specific problem with warnings on unknown
                 * this accesses. More generally, Closure also cannot infer constraints for any other
                 * templated types, but that might require a more general solution in Closure Compiler.
                 */
                let contextThisType = null;
                function visitClassDeclaration(classDecl) {
                    const contextThisTypeBackup = contextThisType;
                    const mjsdoc = moduleTypeTranslator.getMutableJSDoc(classDecl);
                    if (transformerUtil.hasModifierFlag(classDecl, ts.ModifierFlags.Abstract)) {
                        mjsdoc.tags.push({ tagName: 'abstract' });
                    }
                    maybeAddTemplateClause(mjsdoc.tags, classDecl);
                    if (!host.untyped) {
                        maybeAddHeritageClauses(mjsdoc.tags, moduleTypeTranslator, classDecl);
                    }
                    mjsdoc.updateComment();
                    const decls = [];
                    const memberDecl = createMemberTypeDeclaration(moduleTypeTranslator, classDecl);
                    // WARNING: order is significant; we must create the member decl before transforming away
                    // parameter property comments when visiting the constructor.
                    decls.push(ts.visitEachChild(classDecl, visitor, context));
                    if (memberDecl)
                        decls.push(memberDecl);
                    contextThisType = contextThisTypeBackup;
                    return decls;
                }
                /**
                 * visitHeritageClause works around a Closure Compiler issue, where the expression in an
                 * "extends" clause must be a simple identifier, and in particular must not be a parenthesized
                 * expression.
                 *
                 * This is triggered when TS code writes "class X extends (Foo as Bar) { ... }", commonly done
                 * to support mixins. For extends clauses in classes, the code below drops the cast and any
                 * parentheticals, leaving just the original expression.
                 *
                 * This is an incomplete workaround, as Closure will still bail on other super expressions,
                 * but retains compatibility with the previous emit that (accidentally) dropped the cast
                 * expression.
                 *
                 * TODO(martinprobst): remove this once the Closure side issue has been resolved.
                 */
                function visitHeritageClause(heritageClause) {
                    if (heritageClause.token !== ts.SyntaxKind.ExtendsKeyword || !heritageClause.parent ||
                        heritageClause.parent.kind === ts.SyntaxKind.InterfaceDeclaration) {
                        return ts.visitEachChild(heritageClause, visitor, context);
                    }
                    if (heritageClause.types.length !== 1) {
                        moduleTypeTranslator.error(heritageClause, `expected exactly one type in class extension clause`);
                    }
                    const type = heritageClause.types[0];
                    let expr = type.expression;
                    while (ts.isParenthesizedExpression(expr) || ts.isNonNullExpression(expr) ||
                        ts.isAssertionExpression(expr)) {
                        expr = expr.expression;
                    }
                    return ts.updateHeritageClause(heritageClause, [ts.updateExpressionWithTypeArguments(type, type.typeArguments || [], expr)]);
                }
                function visitInterfaceDeclaration(iface) {
                    const sym = typeChecker.getSymbolAtLocation(iface.name);
                    if (!sym) {
                        moduleTypeTranslator.error(iface, 'interface with no symbol');
                        return [];
                    }
                    // If this symbol is both a type and a value, we cannot emit both into Closure's
                    // single namespace.
                    if (sym.flags & ts.SymbolFlags.Value) {
                        moduleTypeTranslator.debugWarn(iface, `type/symbol conflict for ${sym.name}, using {?} for now`);
                        return [transformerUtil.createSingleLineComment(iface, 'WARNING: interface has both a type and a value, skipping emit')];
                    }
                    const tags = moduleTypeTranslator.getJSDoc(iface, /* reportWarnings */ true) || [];
                    tags.push({ tagName: 'record' });
                    maybeAddTemplateClause(tags, iface);
                    if (!host.untyped) {
                        maybeAddHeritageClauses(tags, moduleTypeTranslator, iface);
                    }
                    const name = transformerUtil.getIdentifierText(iface.name);
                    const modifiers = transformerUtil.hasModifierFlag(iface, ts.ModifierFlags.Export) ?
                        [ts.createToken(ts.SyntaxKind.ExportKeyword)] :
                        undefined;
                    const decl = ts.setSourceMapRange(ts.createFunctionDeclaration(
                    /* decorators */ undefined, modifiers, 
                    /* asterisk */ undefined, name, 
                    /* typeParameters */ undefined, 
                    /* parameters */ [], 
                    /* type */ undefined, 
                    /* body */ ts.createBlock([])), iface);
                    addCommentOn(decl, tags);
                    const memberDecl = createMemberTypeDeclaration(moduleTypeTranslator, iface);
                    return memberDecl ? [decl, memberDecl] : [decl];
                }
                /** Function declarations are emitted as they are, with only JSDoc added. */
                function visitFunctionLikeDeclaration(fnDecl) {
                    if (!fnDecl.body) {
                        // Two cases: abstract methods and overloaded methods/functions.
                        // Abstract methods are handled in emitTypeAnnotationsHandler.
                        // Overloads are union-ized into the shared type in FunctionType.
                        return ts.visitEachChild(fnDecl, visitor, context);
                    }
                    const extraTags = [];
                    if (decorators_1.hasExportingDecorator(fnDecl, typeChecker))
                        extraTags.push({ tagName: 'export' });
                    const { tags, thisReturnType } = moduleTypeTranslator.getFunctionTypeJSDoc([fnDecl], extraTags);
                    const mjsdoc = moduleTypeTranslator.getMutableJSDoc(fnDecl);
                    mjsdoc.tags = tags;
                    mjsdoc.updateComment();
                    const contextThisTypeBackup = contextThisType;
                    // Arrow functions retain their context `this` type. All others reset the this type to
                    // either none (if not specified) or the type given in a fn(this: T, ...) declaration.
                    if (!ts.isArrowFunction(fnDecl))
                        contextThisType = thisReturnType;
                    const result = ts.visitEachChild(fnDecl, visitor, context);
                    contextThisType = contextThisTypeBackup;
                    return result;
                }
                /**
                 * In methods with a templated this type, adds explicit casts to accesses on this.
                 *
                 * @see contextThisType
                 */
                function visitThisExpression(node) {
                    if (!contextThisType)
                        return ts.visitEachChild(node, visitor, context);
                    return createClosureCast(node, node, contextThisType);
                }
                /**
                 * visitVariableStatement flattens variable declaration lists (`var a, b;` to `var a; var
                 * b;`), and attaches JSDoc comments to each variable. JSDoc comments preceding the
                 * original variable are attached to the first newly created one.
                 */
                function visitVariableStatement(varStmt) {
                    const stmts = [];
                    // "const", "let", etc are stored in node flags on the declarationList.
                    const flags = ts.getCombinedNodeFlags(varStmt.declarationList);
                    let tags = moduleTypeTranslator.getJSDoc(varStmt, /* reportWarnings */ true);
                    const leading = ts.getSyntheticLeadingComments(varStmt);
                    if (leading) {
                        // Attach non-JSDoc comments to a not emitted statement.
                        const commentHolder = ts.createNotEmittedStatement(varStmt);
                        ts.setSyntheticLeadingComments(commentHolder, leading.filter(c => c.text[0] !== '*'));
                        stmts.push(commentHolder);
                    }
                    const declList = ts.visitNode(varStmt.declarationList, visitor);
                    for (const decl of declList.declarations) {
                        const localTags = [];
                        if (tags) {
                            // Add any tags and docs preceding the entire statement to the first variable.
                            localTags.push(...tags);
                            tags = null;
                        }
                        // Add an @type for plain identifiers, but not for bindings patterns (i.e. object or array
                        // destructuring - those do not have a syntax in Closure) or @defines, which already
                        // declare their type.
                        if (ts.isIdentifier(decl.name)) {
                            // For variables that are initialized and use a blacklisted type, do not emit a type at
                            // all. Closure Compiler might be able to infer a better type from the initializer than
                            // the `?` the code below would emit.
                            // TODO(martinprobst): consider doing this for all types that get emitted as ?, not just
                            // for blacklisted ones.
                            const blackListedInitialized = !!decl.initializer && moduleTypeTranslator.isBlackListed(decl);
                            if (!blackListedInitialized) {
                                // getOriginalNode(decl) is required because the type checker cannot type check
                                // synthesized nodes.
                                const typeStr = moduleTypeTranslator.typeToClosure(ts.getOriginalNode(decl));
                                // If @define is present then add the type to it, rather than adding a normal @type.
                                const defineTag = localTags.find(({ tagName }) => tagName === 'define');
                                if (defineTag) {
                                    defineTag.type = typeStr;
                                }
                                else {
                                    localTags.push({ tagName: 'type', type: typeStr });
                                }
                            }
                        }
                        const newStmt = ts.createVariableStatement(varStmt.modifiers, ts.createVariableDeclarationList([decl], flags));
                        if (localTags.length)
                            addCommentOn(newStmt, localTags, jsdoc.TAGS_CONFLICTING_WITH_TYPE);
                        stmts.push(newStmt);
                    }
                    return stmts;
                }
                /**
                 * shouldEmitExportsAssignments returns true if tsickle should emit `exports.Foo = ...` style
                 * export statements.
                 *
                 * TypeScript modules can export types. Because types are pure design-time constructs in
                 * TypeScript, it does not emit any actual exported symbols for these. But tsickle has to emit
                 * an export, so that downstream Closure code (including tsickle-converted Closure code) can
                 * import upstream types. tsickle has to pick a module format for that, because the pure ES6
                 * export would get stripped by TypeScript.
                 *
                 * tsickle uses CommonJS to emit googmodule, and code not using googmodule doesn't care about
                 * the Closure annotations anyway, so tsickle skips emitting exports if the module target
                 * isn't commonjs.
                 */
                function shouldEmitExportsAssignments() {
                    return tsOptions.module === ts.ModuleKind.CommonJS;
                }
                function visitTypeAliasDeclaration(typeAlias) {
                    // If the type is also defined as a value, skip emitting it. Closure collapses type & value
                    // namespaces, the two emits would conflict if tsickle emitted both.
                    const sym = moduleTypeTranslator.mustGetSymbolAtLocation(typeAlias.name);
                    if (sym.flags & ts.SymbolFlags.Value)
                        return [];
                    // Type aliases are always emitted as the resolved underlying type, so there is no need to
                    // emit anything, except for exported types.
                    if (!transformerUtil.hasModifierFlag(typeAlias, ts.ModifierFlags.Export))
                        return [];
                    if (!shouldEmitExportsAssignments())
                        return [];
                    const typeName = typeAlias.name.getText();
                    // Blacklist any type parameters, Closure does not support type aliases with type
                    // parameters.
                    moduleTypeTranslator.newTypeTranslator(typeAlias).blacklistTypeParameters(moduleTypeTranslator.symbolsToAliasedNames, typeAlias.typeParameters);
                    const typeStr = host.untyped ? '?' : moduleTypeTranslator.typeToClosure(typeAlias, undefined);
                    // In the case of an export, we cannot emit a `export var foo;` because TypeScript drops
                    // exports that are never assigned values, and Closure requires us to not assign values to
                    // typedef exports. Introducing a new local variable and exporting it can cause bugs due to
                    // name shadowing and confusing TypeScript's logic on what symbols and types vs values are
                    // exported. Mangling the name to avoid the conflicts would be reasonably clean, but would
                    // require a two pass emit to first find all type alias names, mangle them, and emit the use
                    // sites only later. With that, the fix here is to never emit type aliases, but always
                    // resolve the alias and emit the underlying type (fixing references in the local module,
                    // and also across modules). For downstream JavaScript code that imports the typedef, we
                    // emit an "export.Foo;" that declares and exports the type, and for TypeScript has no
                    // impact.
                    const tags = moduleTypeTranslator.getJSDoc(typeAlias, /* reportWarnings */ true);
                    tags.push({ tagName: 'typedef', type: typeStr });
                    const decl = ts.setSourceMapRange(ts.createStatement(ts.createPropertyAccess(ts.createIdentifier('exports'), ts.createIdentifier(typeName))), typeAlias);
                    addCommentOn(decl, tags, jsdoc.TAGS_CONFLICTING_WITH_TYPE);
                    return [decl];
                }
                /** Emits a parenthesized Closure cast: `(/** \@type ... * / (expr))`. */
                function createClosureCast(context, expression, type) {
                    const inner = ts.createParen(expression);
                    const comment = addCommentOn(inner, [{ tagName: 'type', type: moduleTypeTranslator.typeToClosure(context, type) }]);
                    comment.hasTrailingNewLine = false;
                    return ts.setSourceMapRange(ts.createParen(inner), context);
                }
                /** Converts a TypeScript type assertion into a Closure Cast. */
                function visitAssertionExpression(assertion) {
                    const type = typeChecker.getTypeAtLocation(assertion.type);
                    return createClosureCast(assertion, ts.visitEachChild(assertion, visitor, context), type);
                }
                /**
                 * Converts a TypeScript non-null assertion into a Closure Cast, by stripping |null and
                 * |undefined from a union type.
                 */
                function visitNonNullExpression(nonNull) {
                    const type = typeChecker.getTypeAtLocation(nonNull.expression);
                    const nonNullType = typeChecker.getNonNullableType(type);
                    return createClosureCast(nonNull, ts.visitEachChild(nonNull, visitor, context), nonNullType);
                }
                function visitImportDeclaration(importDecl) {
                    // For each import, insert a goog.requireType for the module, so that if TypeScript does not
                    // emit the module because it's only used in type positions, the JSDoc comments still
                    // reference a valid Closure level symbol.
                    // No need to requireType side effect imports.
                    if (!importDecl.importClause)
                        return importDecl;
                    const sym = typeChecker.getSymbolAtLocation(importDecl.moduleSpecifier);
                    // Scripts do not have a symbol, and neither do unused modules. Scripts can still be
                    // imported, either as side effect imports or with an empty import set ("{}"). TypeScript
                    // does not emit a runtime load for an import with an empty list of symbols, but the import
                    // forces any global declarations from the library to be visible, which is what users use
                    // this for. No symbols from the script need requireType, so just return.
                    // TODO(evmar): revisit this.  If TS needs to see the module import, it's likely Closure
                    // does too.
                    if (!sym)
                        return importDecl;
                    const importPath = googmodule.resolveModuleName({ options: tsOptions, moduleResolutionHost }, sourceFile.fileName, importDecl.moduleSpecifier.text);
                    moduleTypeTranslator.requireType(importPath, sym, 
                    /* default import? */ !!importDecl.importClause.name);
                    return importDecl;
                }
                /**
                 * Closure Compiler will fail when it finds incorrect JSDoc tags on nodes. This function
                 * parses and then re-serializes JSDoc comments, escaping or removing illegal tags.
                 */
                function escapeIllegalJSDoc(node) {
                    const mjsdoc = moduleTypeTranslator.getMutableJSDoc(node);
                    mjsdoc.updateComment();
                }
                /** Returns true if a value export should be emitted for the given symbol in export *. */
                function shouldEmitValueExportForSymbol(sym) {
                    if (sym.flags & ts.SymbolFlags.Alias) {
                        sym = typeChecker.getAliasedSymbol(sym);
                    }
                    if ((sym.flags & ts.SymbolFlags.Value) === 0) {
                        // Note: We create explicit exports of type symbols for closure in visitExportDeclaration.
                        return false;
                    }
                    if (!tsOptions.preserveConstEnums && sym.flags & ts.SymbolFlags.ConstEnum) {
                        return false;
                    }
                    return true;
                }
                /**
                 * visitExportDeclaration requireTypes exported modules and emits explicit exports for
                 * types (which normally do not get emitted by TypeScript).
                 */
                function visitExportDeclaration(exportDecl) {
                    const importedModuleSymbol = exportDecl.moduleSpecifier &&
                        typeChecker.getSymbolAtLocation(exportDecl.moduleSpecifier);
                    if (importedModuleSymbol) {
                        // requireType all explicitly imported modules, so that symbols can be referenced and
                        // type only modules are usable from type declarations.
                        moduleTypeTranslator.requireType(exportDecl.moduleSpecifier.text, importedModuleSymbol, 
                        /* default import? */ false);
                    }
                    const typesToExport = [];
                    if (!exportDecl.exportClause) {
                        // export * from '...'
                        // Resolve the * into all value symbols exported, and update the export declaration.
                        // Explicitly spelled out exports (i.e. the exports of the current module) take precedence
                        // over implicit ones from export *. Use the current module's exports to filter.
                        const currentModuleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
                        const currentModuleExports = currentModuleSymbol && currentModuleSymbol.exports;
                        if (!importedModuleSymbol) {
                            moduleTypeTranslator.error(exportDecl, `export * without module symbol`);
                            return exportDecl;
                        }
                        const exportedSymbols = typeChecker.getExportsOfModule(importedModuleSymbol);
                        const exportSpecifiers = [];
                        for (const sym of exportedSymbols) {
                            if (currentModuleExports && currentModuleExports.has(sym.escapedName))
                                continue;
                            // We might have already generated an export for the given symbol.
                            if (expandedStarImports.has(sym.name))
                                continue;
                            expandedStarImports.add(sym.name);
                            // Only create an export specifier for values that are exported. For types, the code
                            // below creates specific export statements that match Closure's expectations.
                            if (shouldEmitValueExportForSymbol(sym)) {
                                exportSpecifiers.push(ts.createExportSpecifier(undefined, sym.name));
                            }
                            else {
                                typesToExport.push([sym.name, sym]);
                            }
                        }
                        exportDecl = ts.updateExportDeclaration(exportDecl, exportDecl.decorators, exportDecl.modifiers, ts.createNamedExports(exportSpecifiers), exportDecl.moduleSpecifier);
                    }
                    else {
                        for (const exp of exportDecl.exportClause.elements) {
                            const exportedName = transformerUtil.getIdentifierText(exp.name);
                            typesToExport.push([exportedName, moduleTypeTranslator.mustGetSymbolAtLocation(exp.name)]);
                        }
                    }
                    // Do not emit typedef re-exports in untyped mode.
                    if (host.untyped)
                        return exportDecl;
                    const result = [exportDecl];
                    for (const [exportedName, sym] of typesToExport) {
                        let aliasedSymbol = sym;
                        if (sym.flags & ts.SymbolFlags.Alias) {
                            aliasedSymbol = typeChecker.getAliasedSymbol(sym);
                        }
                        const isTypeAlias = (aliasedSymbol.flags & ts.SymbolFlags.Value) === 0 &&
                            (aliasedSymbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface)) !== 0;
                        if (!isTypeAlias)
                            continue;
                        const typeName = moduleTypeTranslator.symbolsToAliasedNames.get(aliasedSymbol) || aliasedSymbol.name;
                        const stmt = ts.createStatement(ts.createPropertyAccess(ts.createIdentifier('exports'), exportedName));
                        addCommentOn(stmt, [{ tagName: 'typedef', type: '!' + typeName }]);
                        ts.addSyntheticTrailingComment(stmt, ts.SyntaxKind.SingleLineCommentTrivia, ' re-export typedef', true);
                        result.push(stmt);
                    }
                    return result;
                }
                /**
                 * Returns the identifiers exported in a single exported statement - typically just one
                 * identifier (e.g. for `export function foo()`), but multiple for `export declare var a, b`.
                 */
                function getExportDeclarationNames(node) {
                    switch (node.kind) {
                        case ts.SyntaxKind.VariableStatement:
                            const varDecl = node;
                            return varDecl.declarationList.declarations.map((d) => getExportDeclarationNames(d)[0]);
                        case ts.SyntaxKind.VariableDeclaration:
                        case ts.SyntaxKind.FunctionDeclaration:
                        case ts.SyntaxKind.InterfaceDeclaration:
                        case ts.SyntaxKind.ClassDeclaration:
                        case ts.SyntaxKind.ModuleDeclaration:
                        case ts.SyntaxKind.EnumDeclaration:
                            const decl = node;
                            if (!decl.name || decl.name.kind !== ts.SyntaxKind.Identifier) {
                                break;
                            }
                            return [decl.name];
                        case ts.SyntaxKind.TypeAliasDeclaration:
                            const typeAlias = node;
                            return [typeAlias.name];
                        default:
                            break;
                    }
                    moduleTypeTranslator.error(node, `unsupported export declaration ${ts.SyntaxKind[node.kind]}: ${node.getText()}`);
                    return [];
                }
                /**
                 * Ambient declarations declare types for TypeScript's benefit, and will be removede by
                 * TypeScript during its emit phase. Downstream Closure code however might be importing
                 * symbols from this module, so tsickle must emit a Closure-compatible exports declaration.
                 */
                function visitExportedAmbient(node) {
                    if (host.untyped || !shouldEmitExportsAssignments())
                        return [node];
                    const declNames = getExportDeclarationNames(node);
                    const result = [node];
                    for (const decl of declNames) {
                        const sym = typeChecker.getSymbolAtLocation(decl);
                        const isValue = sym.flags & ts.SymbolFlags.Value;
                        // Non-value objects do not exist at runtime, so we cannot access the symbol (it only
                        // exists in externs). Export them as a typedef, which forwards to the type in externs.
                        // Note: TypeScript emits odd code for exported ambients (exports.x for variables, just x
                        // for everything else). That seems buggy, and in either case this code should not attempt
                        // to fix it.
                        // See also https://github.com/Microsoft/TypeScript/issues/8015.
                        if (!isValue) {
                            // Do not emit re-exports for ModuleDeclarations.
                            // Ambient ModuleDeclarations are always referenced as global symbols, so they don't
                            // need to be exported.
                            if (node.kind === ts.SyntaxKind.ModuleDeclaration)
                                continue;
                            const mangledName = annotator_host_1.moduleNameAsIdentifier(host, sourceFile.fileName);
                            const declName = transformerUtil.getIdentifierText(decl);
                            const stmt = ts.createStatement(ts.createPropertyAccess(ts.createIdentifier('exports'), declName));
                            addCommentOn(stmt, [{ tagName: 'typedef', type: `!${mangledName}.${declName}` }]);
                            result.push(stmt);
                        }
                    }
                    return result;
                }
                function visitor(node) {
                    if (transformerUtil.isAmbient(node)) {
                        if (!transformerUtil.hasModifierFlag(node, ts.ModifierFlags.Export)) {
                            return node;
                        }
                        return visitExportedAmbient(node);
                    }
                    switch (node.kind) {
                        case ts.SyntaxKind.ImportDeclaration:
                            return visitImportDeclaration(node);
                        case ts.SyntaxKind.ExportDeclaration:
                            return visitExportDeclaration(node);
                        case ts.SyntaxKind.ClassDeclaration:
                            return visitClassDeclaration(node);
                        case ts.SyntaxKind.InterfaceDeclaration:
                            return visitInterfaceDeclaration(node);
                        case ts.SyntaxKind.HeritageClause:
                            return visitHeritageClause(node);
                        case ts.SyntaxKind.ArrowFunction:
                        case ts.SyntaxKind.FunctionExpression:
                            // Inserting a comment before an expression can trigger automatic semicolon insertion,
                            // e.g. if the function below is the expression in a `return` statement. Parenthesizing
                            // prevents ASI, as long as the opening paren remains on the same line (which it does).
                            return ts.createParen(visitFunctionLikeDeclaration(node));
                        case ts.SyntaxKind.Constructor:
                        case ts.SyntaxKind.FunctionDeclaration:
                        case ts.SyntaxKind.MethodDeclaration:
                        case ts.SyntaxKind.GetAccessor:
                        case ts.SyntaxKind.SetAccessor:
                            return visitFunctionLikeDeclaration(node);
                        case ts.SyntaxKind.ThisKeyword:
                            return visitThisExpression(node);
                        case ts.SyntaxKind.VariableStatement:
                            return visitVariableStatement(node);
                        case ts.SyntaxKind.PropertyDeclaration:
                        case ts.SyntaxKind.PropertyAssignment:
                            escapeIllegalJSDoc(node);
                            break;
                        case ts.SyntaxKind.Parameter:
                            // Parameter properties (e.g. `constructor(/** docs */ private foo: string)`) might have
                            // JSDoc comments, including JSDoc tags recognized by Closure Compiler. Prevent emitting
                            // any comments on them, so that Closure doesn't error on them.
                            // See test_files/parameter_properties.ts.
                            const paramDecl = node;
                            if (transformerUtil.hasModifierFlag(paramDecl, ts.ModifierFlags.ParameterPropertyModifier)) {
                                ts.setSyntheticLeadingComments(paramDecl, []);
                                jsdoc.suppressLeadingCommentsRecursively(paramDecl);
                            }
                            break;
                        case ts.SyntaxKind.TypeAliasDeclaration:
                            return visitTypeAliasDeclaration(node);
                        case ts.SyntaxKind.AsExpression:
                        case ts.SyntaxKind.TypeAssertionExpression:
                            return visitAssertionExpression(node);
                        case ts.SyntaxKind.NonNullExpression:
                            return visitNonNullExpression(node);
                        default:
                            break;
                    }
                    return ts.visitEachChild(node, visitor, context);
                }
                sourceFile = ts.visitEachChild(sourceFile, visitor, context);
                return moduleTypeTranslator.insertAdditionalImports(sourceFile);
            };
        };
    }
    exports.jsdocTransformer = jsdocTransformer;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNkb2NfdHJhbnNmb3JtZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvanNkb2NfdHJhbnNmb3JtZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSDs7Ozs7Ozs7Ozs7Ozs7Ozs7O09Ba0JHO0lBRUgsaUNBQWlDO0lBRWpDLCtEQUF1RTtJQUN2RSx1REFBbUQ7SUFDbkQscURBQTJDO0lBQzNDLDJDQUFpQztJQUNqQywrRUFBOEQ7SUFDOUQsZ0VBQXNEO0lBQ3RELGlFQUE2RDtJQUU3RCxTQUFTLFlBQVksQ0FBQyxJQUFhLEVBQUUsSUFBaUIsRUFBRSxlQUE2QjtRQUNuRixNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDNUQsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN2QixFQUFFLENBQUMsMkJBQTJCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQy9DLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFLRCx3RUFBd0U7SUFDeEUsU0FBZ0Isc0JBQXNCLENBQUMsT0FBb0IsRUFBRSxJQUF1QjtRQUNsRixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWM7WUFBRSxPQUFPO1FBQ2pDLHdGQUF3RjtRQUN4RixPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ1gsT0FBTyxFQUFFLFVBQVU7WUFDbkIsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDM0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQVBELHdEQU9DO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsdUJBQXVCLENBQ25DLE9BQW9CLEVBQUUsR0FBeUIsRUFDL0MsSUFBcUQ7UUFDdkQsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlO1lBQUUsT0FBTztRQUNsQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUM7UUFDN0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDNUYsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQzNDLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUM7WUFDbEUsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO2dCQUN4QixtRUFBbUU7Z0JBQ25FLGtEQUFrRDtnQkFDbEQsRUFBRTtnQkFDRixxRkFBcUY7Z0JBQ3JGLCtDQUErQztnQkFDL0MsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO29CQUFFLFNBQVM7YUFDaEQ7WUFFRCx5REFBeUQ7WUFDekQsS0FBSyxNQUFNLElBQUksSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFO2dCQUNqQyxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0Qsc0ZBQXNGO2dCQUN0Rix3REFBd0Q7Z0JBQ3hELElBQUksUUFBUSxFQUFFO29CQUNaLE9BQU8sQ0FBQyxJQUFJLENBQUM7d0JBQ1gsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPO3dCQUN6QixJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVU7cUJBQzFCLENBQUMsQ0FBQztpQkFDSjthQUNGO1NBQ0Y7UUFFRDs7Ozs7Ozs7O1dBU0c7UUFDSCxTQUFTLFlBQVksQ0FDakIsU0FBa0IsRUFBRSxVQUFtQixFQUN2QyxJQUFvQztZQUN0QyxJQUFJLE9BQU8sR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDO1lBQ25ELElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQy9ELElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ1IscUVBQXFFO2dCQUNyRSxvRUFBb0U7Z0JBQ3BFLDZEQUE2RDtnQkFDN0QseUJBQXlCO2dCQUN6QixFQUFFO2dCQUNGLDREQUE0RDtnQkFDNUQscUNBQXFDO2dCQUNyQyxvRUFBb0U7Z0JBQ3BFLGtFQUFrRTtnQkFDbEUsZUFBZTtnQkFDZixHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQ0FBZ0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDdEUsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELDhDQUE4QztZQUM5QyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUU7Z0JBQ3hDLDhEQUE4RDtnQkFDOUQsa0VBQWtFO2dCQUNsRSxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUMxRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtvQkFDaEIsdUNBQXVDO29CQUN2QyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQ0FBaUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDdkUsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQ0QsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7YUFDbkI7WUFDRCxJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Z0JBQ3BDLEdBQUcsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQzdDO1lBRUQsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5RCxJQUFJLGNBQWMsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3JDLDhDQUE4QztnQkFDOUMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELElBQUksR0FBRyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRTtnQkFDcEMsSUFBSSxDQUFDLE9BQU8sRUFBRTtvQkFDWiwwREFBMEQ7b0JBQzFELEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJDQUEyQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUNqRixPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFDRCxJQUFJLENBQUMsU0FBUyxFQUFFO29CQUNkLElBQUksQ0FBQyxVQUFVLEVBQUU7d0JBQ2YsNkVBQTZFO3dCQUM3RSw0RUFBNEU7d0JBQzVFLHdFQUF3RTt3QkFDeEUsZ0NBQWdDO3dCQUNoQywyREFBMkQ7d0JBQzNELCtDQUErQzt3QkFDL0MsT0FBTyxHQUFHLFNBQVMsQ0FBQztxQkFDckI7eUJBQU07d0JBQ0wsMERBQTBEO3dCQUMxRCxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQ0FBb0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQzt3QkFDMUUsT0FBTyxJQUFJLENBQUM7cUJBQ2I7aUJBQ0Y7YUFDRjtpQkFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Z0JBQzNDLDRFQUE0RTtnQkFDNUUsaUVBQWlFO2dCQUNqRSxrQ0FBa0M7Z0JBQ2xDLEdBQUcsQ0FBQyxTQUFTLENBQ1QsSUFBSSxFQUFFLHlEQUF5RCxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRixPQUFPLElBQUksQ0FBQzthQUNiO2lCQUFNLElBQUksR0FBRyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRTtnQkFDakQsaURBQWlEO2dCQUNqRCxvREFBb0Q7Z0JBQ3BELEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtEQUFrRCxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUN4RixPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsc0ZBQXNGO1lBQ3RGLE1BQU0sVUFBVSxHQUFHLGNBQWMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLFVBQVU7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDN0IsT0FBTyxFQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUMsQ0FBQztRQUMvQixDQUFDO0lBQ0gsQ0FBQztJQTNIRCwwREEySEM7SUFFRDs7Ozs7Ozs7O09BU0c7SUFDSCxTQUFTLDJCQUEyQixDQUNoQyxHQUF5QixFQUN6QixRQUFxRDtRQUN2RCxrRUFBa0U7UUFDbEUsTUFBTSxLQUFLLEdBQWdDLEVBQUUsQ0FBQztRQUM5QyxJQUFJLFVBQVUsR0FBOEIsRUFBRSxDQUFDO1FBQy9DLE1BQU0sY0FBYyxHQUF1RCxFQUFFLENBQUM7UUFDOUUsTUFBTSxXQUFXLEdBQXVELEVBQUUsQ0FBQztRQUMzRSxNQUFNLFNBQVMsR0FBMEIsRUFBRSxDQUFDO1FBQzVDLE1BQU0sZUFBZSxHQUFpQyxFQUFFLENBQUM7UUFDekQsS0FBSyxNQUFNLE1BQU0sSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFO1lBQ3JDLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTtnQkFDN0MsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFtQyxDQUFDLENBQUM7YUFDakQ7aUJBQU0sSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUM3RSxNQUFNLFFBQVEsR0FBRyxlQUFlLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsRixJQUFJLFFBQVEsRUFBRTtvQkFDWixXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUMxQjtxQkFBTTtvQkFDTCxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUM3QjthQUNGO2lCQUFNLElBQ0gsTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGlCQUFpQjtnQkFDL0MsTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGVBQWU7Z0JBQzdDLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTtnQkFDMUYsSUFBSSxlQUFlLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztvQkFDbEUsRUFBRSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUN2QyxlQUFlLENBQUMsSUFBSSxDQUNoQixNQUFzRixDQUFDLENBQUM7aUJBQzdGO2dCQUNELCtFQUErRTthQUNoRjtpQkFBTTtnQkFDTCxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3hCO1NBQ0Y7UUFFRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ3BCLDRGQUE0RjtZQUM1Riw2REFBNkQ7WUFDN0QsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDckMsVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUMvQixDQUFDLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1NBQzFGO1FBRUQsSUFBSSxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUM7WUFDbEYsZUFBZSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDaEMseURBQXlEO1lBQ3pELHNCQUFzQjtZQUN0QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUU7WUFDbEIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsMENBQTBDLENBQUMsQ0FBQztZQUNwRSxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRSxNQUFNLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN4RCxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNsRiw4RkFBOEY7UUFDOUYsa0dBQWtHO1FBQ2xHLGlCQUFpQjtRQUNqQixNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDeEQsTUFBTSxhQUFhLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FDakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FDakMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUMsRUFBRSxXQUFXLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsY0FBYyxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUN4RCxDQUFDLENBQUMsRUFBRSxDQUFDLGdDQUFnQyxDQUNqQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxFQUFFLFdBQVcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4RSxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FDL0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsc0JBQXNCLENBQ3ZDLENBQUMsRUFBRSw4QkFBOEIsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1RSxLQUFLLE1BQU0sTUFBTSxJQUFJLGVBQWUsRUFBRTtZQUNwQyxNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbEMsSUFBSSxDQUFDLElBQUksRUFBRTtnQkFDVCxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSw2QkFBNkIsQ0FBQyxDQUFDO2dCQUNqRCxTQUFTO2FBQ1Y7WUFDRCxNQUFNLEVBQUMsSUFBSSxFQUFFLGNBQWMsRUFBQyxHQUFHLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3RFLElBQUksa0NBQXFCLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUM7Z0JBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO1lBQ25GLDJFQUEyRTtZQUMzRSxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDekQsRUFBRSxDQUFDLG9CQUFvQixDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxFQUNqRCxFQUFFLENBQUMsd0JBQXdCO1lBQ3ZCLGVBQWUsQ0FBQyxTQUFTO1lBQ3pCLGNBQWMsQ0FBQyxTQUFTO1lBQ3hCLFVBQVUsQ0FBQyxTQUFTO1lBQ3BCLG9CQUFvQixDQUFDLFNBQVMsRUFDOUIsY0FBYyxDQUFDLEdBQUcsQ0FDZCxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxlQUFlO1lBQ25CLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsU0FBUztZQUNyRCxlQUFlLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQ3RDLFNBQVMsRUFDVCxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUNqQixDQUFDLENBQUMsQ0FBQztZQUNaLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25GLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQ2xFO1FBRUQsNkVBQTZFO1FBQzdFLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVELFNBQVMsWUFBWSxDQUFDLElBQXlCO1FBQzdDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRTVCLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDdEIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVU7Z0JBQzNCLE9BQU8sZUFBZSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFxQixDQUFDLENBQUM7WUFDdkUsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWE7Z0JBQzlCLHdDQUF3QztnQkFDeEMsa0ZBQWtGO2dCQUNsRixNQUFNLElBQUksR0FBSSxJQUFJLENBQUMsSUFBeUIsQ0FBQyxJQUFJLENBQUM7Z0JBQ2xELElBQUksQ0FBQyw0Q0FBMEIsQ0FBQyxJQUFJLENBQUM7b0JBQUUsT0FBTyxJQUFJLENBQUM7Z0JBQ25ELE9BQU8sSUFBSSxDQUFDO1lBQ2Q7Z0JBQ0UsT0FBTyxJQUFJLENBQUM7U0FDZjtJQUNILENBQUM7SUFFRCwyRkFBMkY7SUFDM0YsU0FBZ0IsZ0JBQWdCLENBQUMsR0FBVztRQUMxQyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUZELDRDQUVDO0lBRUQsU0FBUyxnQ0FBZ0MsQ0FDckMsR0FBeUIsRUFBRSxJQUFtQixFQUM5QyxJQUF5RSxFQUN6RSxRQUFpQjtRQUNuQixNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEMsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNULEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUEyQixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkYsT0FBTyxlQUFlLENBQUMsc0JBQXNCLENBQ3pDLElBQUksRUFBRSw2QkFBNkIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQzVFO1FBRUQsSUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuQyxvQ0FBb0M7UUFDcEMsa0JBQWtCO1FBQ2xCLG9FQUFvRTtRQUNwRSwwRUFBMEU7UUFDMUUsaURBQWlEO1FBQ2pELEVBQUU7UUFDRixpRUFBaUU7UUFDakUsZUFBZTtRQUNmLDBFQUEwRTtRQUMxRSx5RUFBeUU7UUFDekUseUVBQXlFO1FBQ3pFLDJDQUEyQztRQUMzQyxJQUFJLFFBQVEsSUFBSSxJQUFJLEtBQUssR0FBRztZQUFFLElBQUksSUFBSSxZQUFZLENBQUM7UUFFbkQsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztRQUNuQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEQsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUU7WUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQyxDQUFDO1NBQ25DO2FBQU0sSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUU7WUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUMsQ0FBQyxDQUFDO1NBQ2pDO1FBQ0QsSUFBSSxrQ0FBcUIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztTQUNoQztRQUNELE1BQU0sUUFBUSxHQUNWLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN4RiwwREFBMEQ7UUFDMUQsb0ZBQW9GO1FBQ3BGLFlBQVksQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBQy9ELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7OztPQWdCRztJQUNILFNBQWdCLG9CQUFvQjtRQUNsQyxPQUFPLENBQUMsT0FBaUMsRUFBRSxFQUFFO1lBQzNDLE9BQU8sQ0FBQyxVQUF5QixFQUFFLEVBQUU7Z0JBQ25DLFNBQVMsT0FBTyxDQUFDLElBQWE7b0JBQzVCLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRTt3QkFDakIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLHVCQUF1QixDQUFDO3dCQUMzQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWTs0QkFDN0IsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFFLElBQStCLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3dCQUM1RSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCOzRCQUNsQyxPQUFPLEVBQUUsQ0FBQyxTQUFTLENBQUUsSUFBNkIsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7d0JBQzFFOzRCQUNFLE1BQU07cUJBQ1Q7b0JBQ0QsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ25ELENBQUM7Z0JBRUQsT0FBTyxPQUFPLENBQUMsVUFBVSxDQUFrQixDQUFDO1lBQzlDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztJQUNKLENBQUM7SUFuQkQsb0RBbUJDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsZ0JBQWdCLENBQzVCLElBQW1CLEVBQUUsU0FBNkIsRUFDbEQsb0JBQTZDLEVBQUUsV0FBMkIsRUFDMUUsV0FBNEI7UUFFOUIsT0FBTyxDQUFDLE9BQWlDLEVBQWlDLEVBQUU7WUFDMUUsT0FBTyxDQUFDLFVBQXlCLEVBQUUsRUFBRTtnQkFDbkMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLDZDQUFvQixDQUNqRCxVQUFVLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3hFOzs7bUJBR0c7Z0JBQ0gsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO2dCQUU5Qzs7Ozs7Ozs7Ozs7bUJBV0c7Z0JBQ0gsSUFBSSxlQUFlLEdBQWlCLElBQUksQ0FBQztnQkFFekMsU0FBUyxxQkFBcUIsQ0FBQyxTQUE4QjtvQkFDM0QsTUFBTSxxQkFBcUIsR0FBRyxlQUFlLENBQUM7b0JBRTlDLE1BQU0sTUFBTSxHQUFHLG9CQUFvQixDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDL0QsSUFBSSxlQUFlLENBQUMsZUFBZSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxFQUFFO3dCQUN6RSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUMsQ0FBQyxDQUFDO3FCQUN6QztvQkFFRCxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTt3QkFDakIsdUJBQXVCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztxQkFDdkU7b0JBQ0QsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUN2QixNQUFNLEtBQUssR0FBbUIsRUFBRSxDQUFDO29CQUNqQyxNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztvQkFDaEYseUZBQXlGO29CQUN6Riw2REFBNkQ7b0JBQzdELEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQzNELElBQUksVUFBVTt3QkFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUN2QyxlQUFlLEdBQUcscUJBQXFCLENBQUM7b0JBQ3hDLE9BQU8sS0FBSyxDQUFDO2dCQUNmLENBQUM7Z0JBRUQ7Ozs7Ozs7Ozs7Ozs7O21CQWNHO2dCQUNILFNBQVMsbUJBQW1CLENBQUMsY0FBaUM7b0JBQzVELElBQUksY0FBYyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNO3dCQUMvRSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLG9CQUFvQixFQUFFO3dCQUNyRSxPQUFPLEVBQUUsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztxQkFDNUQ7b0JBQ0QsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7d0JBQ3JDLG9CQUFvQixDQUFDLEtBQUssQ0FDdEIsY0FBYyxFQUFFLHFEQUFxRCxDQUFDLENBQUM7cUJBQzVFO29CQUNELE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3JDLElBQUksSUFBSSxHQUFrQixJQUFJLENBQUMsVUFBVSxDQUFDO29CQUMxQyxPQUFPLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDO3dCQUNsRSxFQUFFLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ3JDLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO3FCQUN4QjtvQkFDRCxPQUFPLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsaUNBQWlDLENBQ2pDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdGLENBQUM7Z0JBRUQsU0FBUyx5QkFBeUIsQ0FBQyxLQUE4QjtvQkFDL0QsTUFBTSxHQUFHLEdBQUcsV0FBVyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDeEQsSUFBSSxDQUFDLEdBQUcsRUFBRTt3QkFDUixvQkFBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLDBCQUEwQixDQUFDLENBQUM7d0JBQzlELE9BQU8sRUFBRSxDQUFDO3FCQUNYO29CQUNELGdGQUFnRjtvQkFDaEYsb0JBQW9CO29CQUNwQixJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7d0JBQ3BDLG9CQUFvQixDQUFDLFNBQVMsQ0FDMUIsS0FBSyxFQUFFLDRCQUE0QixHQUFHLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDO3dCQUN0RSxPQUFPLENBQUMsZUFBZSxDQUFDLHVCQUF1QixDQUMzQyxLQUFLLEVBQUUsK0RBQStELENBQUMsQ0FBQyxDQUFDO3FCQUM5RTtvQkFFRCxNQUFNLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDbkYsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO29CQUMvQixzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQ3BDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO3dCQUNqQix1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7cUJBQzVEO29CQUNELE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzNELE1BQU0sU0FBUyxHQUFHLGVBQWUsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzt3QkFDL0UsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUMvQyxTQUFTLENBQUM7b0JBQ2QsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUM3QixFQUFFLENBQUMseUJBQXlCO29CQUN4QixnQkFBZ0IsQ0FBQyxTQUFTLEVBQzFCLFNBQVM7b0JBQ1QsY0FBYyxDQUFDLFNBQVMsRUFDeEIsSUFBSTtvQkFDSixvQkFBb0IsQ0FBQyxTQUFTO29CQUM5QixnQkFBZ0IsQ0FBQSxFQUFFO29CQUNsQixVQUFVLENBQUMsU0FBUztvQkFDcEIsVUFBVSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQzVCLEVBQ0wsS0FBSyxDQUFDLENBQUM7b0JBQ1gsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDekIsTUFBTSxVQUFVLEdBQUcsMkJBQTJCLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQzVFLE9BQU8sVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEQsQ0FBQztnQkFFRCw0RUFBNEU7Z0JBQzVFLFNBQVMsNEJBQTRCLENBQXVDLE1BQVM7b0JBQ25GLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO3dCQUNoQixnRUFBZ0U7d0JBQ2hFLDhEQUE4RDt3QkFDOUQsaUVBQWlFO3dCQUNqRSxPQUFPLEVBQUUsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztxQkFDcEQ7b0JBQ0QsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO29CQUNyQixJQUFJLGtDQUFxQixDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7d0JBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO29CQUVwRixNQUFNLEVBQUMsSUFBSSxFQUFFLGNBQWMsRUFBQyxHQUN4QixvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUNuRSxNQUFNLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzVELE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO29CQUNuQixNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBRXZCLE1BQU0scUJBQXFCLEdBQUcsZUFBZSxDQUFDO29CQUM5QyxzRkFBc0Y7b0JBQ3RGLHNGQUFzRjtvQkFDdEYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDO3dCQUFFLGVBQWUsR0FBRyxjQUFjLENBQUM7b0JBQ2xFLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztvQkFDM0QsZUFBZSxHQUFHLHFCQUFxQixDQUFDO29CQUN4QyxPQUFPLE1BQU0sQ0FBQztnQkFDaEIsQ0FBQztnQkFFRDs7OzttQkFJRztnQkFDSCxTQUFTLG1CQUFtQixDQUFDLElBQXVCO29CQUNsRCxJQUFJLENBQUMsZUFBZTt3QkFBRSxPQUFPLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztvQkFDdkUsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO2dCQUVEOzs7O21CQUlHO2dCQUNILFNBQVMsc0JBQXNCLENBQUMsT0FBNkI7b0JBQzNELE1BQU0sS0FBSyxHQUFtQixFQUFFLENBQUM7b0JBRWpDLHVFQUF1RTtvQkFDdkUsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFFL0QsSUFBSSxJQUFJLEdBQ0osb0JBQW9CLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDdEUsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLDJCQUEyQixDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN4RCxJQUFJLE9BQU8sRUFBRTt3QkFDWCx3REFBd0Q7d0JBQ3hELE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDNUQsRUFBRSxDQUFDLDJCQUEyQixDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUN0RixLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO3FCQUMzQjtvQkFFRCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBQ2hFLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxDQUFDLFlBQVksRUFBRTt3QkFDeEMsTUFBTSxTQUFTLEdBQWdCLEVBQUUsQ0FBQzt3QkFDbEMsSUFBSSxJQUFJLEVBQUU7NEJBQ1IsOEVBQThFOzRCQUM5RSxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7NEJBQ3hCLElBQUksR0FBRyxJQUFJLENBQUM7eUJBQ2I7d0JBQ0QsMEZBQTBGO3dCQUMxRixvRkFBb0Y7d0JBQ3BGLHNCQUFzQjt3QkFDdEIsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTs0QkFDOUIsdUZBQXVGOzRCQUN2Rix1RkFBdUY7NEJBQ3ZGLHFDQUFxQzs0QkFDckMsd0ZBQXdGOzRCQUN4Rix3QkFBd0I7NEJBQ3hCLE1BQU0sc0JBQXNCLEdBQ3hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLG9CQUFvQixDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDbkUsSUFBSSxDQUFDLHNCQUFzQixFQUFFO2dDQUMzQiwrRUFBK0U7Z0NBQy9FLHFCQUFxQjtnQ0FDckIsTUFBTSxPQUFPLEdBQUcsb0JBQW9CLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQ0FDN0Usb0ZBQW9GO2dDQUNwRixNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBQyxPQUFPLEVBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDO2dDQUN0RSxJQUFJLFNBQVMsRUFBRTtvQ0FDYixTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQztpQ0FDMUI7cUNBQU07b0NBQ0wsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBQyxDQUFDLENBQUM7aUNBQ2xEOzZCQUNGO3lCQUNGO3dCQUNELE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyx1QkFBdUIsQ0FDdEMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUN4RSxJQUFJLFNBQVMsQ0FBQyxNQUFNOzRCQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO3dCQUN6RixLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3FCQUNyQjtvQkFFRCxPQUFPLEtBQUssQ0FBQztnQkFDZixDQUFDO2dCQUVEOzs7Ozs7Ozs7Ozs7O21CQWFHO2dCQUNILFNBQVMsNEJBQTRCO29CQUNuQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7Z0JBQ3JELENBQUM7Z0JBRUQsU0FBUyx5QkFBeUIsQ0FBQyxTQUFrQztvQkFDbkUsMkZBQTJGO29CQUMzRixvRUFBb0U7b0JBQ3BFLE1BQU0sR0FBRyxHQUFHLG9CQUFvQixDQUFDLHVCQUF1QixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDekUsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSzt3QkFBRSxPQUFPLEVBQUUsQ0FBQztvQkFDaEQsMEZBQTBGO29CQUMxRiw0Q0FBNEM7b0JBQzVDLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQzt3QkFBRSxPQUFPLEVBQUUsQ0FBQztvQkFDcEYsSUFBSSxDQUFDLDRCQUE0QixFQUFFO3dCQUFFLE9BQU8sRUFBRSxDQUFDO29CQUUvQyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUUxQyxpRkFBaUY7b0JBQ2pGLGNBQWM7b0JBQ2Qsb0JBQW9CLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLENBQUMsdUJBQXVCLENBQ3JFLG9CQUFvQixDQUFDLHFCQUFxQixFQUFFLFNBQVMsQ0FBQyxjQUFjLENBQUMsQ0FBQztvQkFDMUUsTUFBTSxPQUFPLEdBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxhQUFhLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUNsRix3RkFBd0Y7b0JBQ3hGLDBGQUEwRjtvQkFDMUYsMkZBQTJGO29CQUMzRiwwRkFBMEY7b0JBQzFGLDBGQUEwRjtvQkFDMUYsNEZBQTRGO29CQUM1RixzRkFBc0Y7b0JBQ3RGLHlGQUF5RjtvQkFDekYsd0ZBQXdGO29CQUN4RixzRkFBc0Y7b0JBQ3RGLFVBQVU7b0JBQ1YsTUFBTSxJQUFJLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakYsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBQyxDQUFDLENBQUM7b0JBQy9DLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FDN0IsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQ3RDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUNuRSxTQUFTLENBQUMsQ0FBQztvQkFDZixZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQztvQkFDM0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNoQixDQUFDO2dCQUVELHlFQUF5RTtnQkFDekUsU0FBUyxpQkFBaUIsQ0FBQyxPQUFnQixFQUFFLFVBQXlCLEVBQUUsSUFBYTtvQkFDbkYsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDekMsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUN4QixLQUFLLEVBQUUsQ0FBQyxFQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3pGLE9BQU8sQ0FBQyxrQkFBa0IsR0FBRyxLQUFLLENBQUM7b0JBQ25DLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQzlELENBQUM7Z0JBRUQsZ0VBQWdFO2dCQUNoRSxTQUFTLHdCQUF3QixDQUFDLFNBQWlDO29CQUNqRSxNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMzRCxPQUFPLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzVGLENBQUM7Z0JBRUQ7OzttQkFHRztnQkFDSCxTQUFTLHNCQUFzQixDQUFDLE9BQTZCO29CQUMzRCxNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUMvRCxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3pELE9BQU8saUJBQWlCLENBQ3BCLE9BQU8sRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQzFFLENBQUM7Z0JBRUQsU0FBUyxzQkFBc0IsQ0FBQyxVQUFnQztvQkFDOUQsNEZBQTRGO29CQUM1RixxRkFBcUY7b0JBQ3JGLDBDQUEwQztvQkFFMUMsOENBQThDO29CQUM5QyxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVk7d0JBQUUsT0FBTyxVQUFVLENBQUM7b0JBRWhELE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQ3hFLG9GQUFvRjtvQkFDcEYseUZBQXlGO29CQUN6RiwyRkFBMkY7b0JBQzNGLHlGQUF5RjtvQkFDekYseUVBQXlFO29CQUN6RSx3RkFBd0Y7b0JBQ3hGLFlBQVk7b0JBQ1osSUFBSSxDQUFDLEdBQUc7d0JBQUUsT0FBTyxVQUFVLENBQUM7b0JBRTVCLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxpQkFBaUIsQ0FDM0MsRUFBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLG9CQUFvQixFQUFDLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFDOUQsVUFBVSxDQUFDLGVBQW9DLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBRTNELG9CQUFvQixDQUFDLFdBQVcsQ0FDNUIsVUFBVSxFQUFFLEdBQUc7b0JBQ2YscUJBQXFCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzFELE9BQU8sVUFBVSxDQUFDO2dCQUNwQixDQUFDO2dCQUVEOzs7bUJBR0c7Z0JBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxJQUFhO29CQUN2QyxNQUFNLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzFELE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDekIsQ0FBQztnQkFFRCx5RkFBeUY7Z0JBQ3pGLFNBQVMsOEJBQThCLENBQUMsR0FBYztvQkFDcEQsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO3dCQUNwQyxHQUFHLEdBQUcsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO3FCQUN6QztvQkFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTt3QkFDNUMsMEZBQTBGO3dCQUMxRixPQUFPLEtBQUssQ0FBQztxQkFDZDtvQkFDRCxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUU7d0JBQ3pFLE9BQU8sS0FBSyxDQUFDO3FCQUNkO29CQUNELE9BQU8sSUFBSSxDQUFDO2dCQUNkLENBQUM7Z0JBRUQ7OzttQkFHRztnQkFDSCxTQUFTLHNCQUFzQixDQUFDLFVBQWdDO29CQUM5RCxNQUFNLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxlQUFlO3dCQUNuRCxXQUFXLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBRSxDQUFDO29CQUNqRSxJQUFJLG9CQUFvQixFQUFFO3dCQUN4QixxRkFBcUY7d0JBQ3JGLHVEQUF1RDt3QkFDdkQsb0JBQW9CLENBQUMsV0FBVyxDQUMzQixVQUFVLENBQUMsZUFBb0MsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CO3dCQUMzRSxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztxQkFDbEM7b0JBRUQsTUFBTSxhQUFhLEdBQStCLEVBQUUsQ0FBQztvQkFDckQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUU7d0JBQzVCLHNCQUFzQjt3QkFDdEIsb0ZBQW9GO3dCQUVwRiwwRkFBMEY7d0JBQzFGLGdGQUFnRjt3QkFDaEYsTUFBTSxtQkFBbUIsR0FBRyxXQUFXLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUM7d0JBQ3hFLE1BQU0sb0JBQW9CLEdBQUcsbUJBQW1CLElBQUksbUJBQW1CLENBQUMsT0FBTyxDQUFDO3dCQUVoRixJQUFJLENBQUMsb0JBQW9CLEVBQUU7NEJBQ3pCLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQzs0QkFDekUsT0FBTyxVQUFVLENBQUM7eUJBQ25CO3dCQUNELE1BQU0sZUFBZSxHQUFHLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO3dCQUM3RSxNQUFNLGdCQUFnQixHQUF5QixFQUFFLENBQUM7d0JBQ2xELEtBQUssTUFBTSxHQUFHLElBQUksZUFBZSxFQUFFOzRCQUNqQyxJQUFJLG9CQUFvQixJQUFJLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO2dDQUFFLFNBQVM7NEJBQ2hGLGtFQUFrRTs0QkFDbEUsSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztnQ0FBRSxTQUFTOzRCQUNoRCxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNsQyxvRkFBb0Y7NEJBQ3BGLDhFQUE4RTs0QkFDOUUsSUFBSSw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQ0FDdkMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7NkJBQ3RFO2lDQUFNO2dDQUNMLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7NkJBQ3JDO3lCQUNGO3dCQUNELFVBQVUsR0FBRyxFQUFFLENBQUMsdUJBQXVCLENBQ25DLFVBQVUsRUFBRSxVQUFVLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxTQUFTLEVBQ3ZELEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQztxQkFDMUU7eUJBQU07d0JBQ0wsS0FBSyxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRTs0QkFDbEQsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDakUsYUFBYSxDQUFDLElBQUksQ0FDZCxDQUFDLFlBQVksRUFBRSxvQkFBb0IsQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO3lCQUM3RTtxQkFDRjtvQkFDRCxrREFBa0Q7b0JBQ2xELElBQUksSUFBSSxDQUFDLE9BQU87d0JBQUUsT0FBTyxVQUFVLENBQUM7b0JBRXBDLE1BQU0sTUFBTSxHQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ3ZDLEtBQUssTUFBTSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsSUFBSSxhQUFhLEVBQUU7d0JBQy9DLElBQUksYUFBYSxHQUFHLEdBQUcsQ0FBQzt3QkFDeEIsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFOzRCQUNwQyxhQUFhLEdBQUcsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO3lCQUNuRDt3QkFDRCxNQUFNLFdBQVcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDOzRCQUNsRSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN4RixJQUFJLENBQUMsV0FBVzs0QkFBRSxTQUFTO3dCQUMzQixNQUFNLFFBQVEsR0FDVixvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQzt3QkFDeEYsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FDM0IsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO3dCQUMzRSxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLEdBQUcsUUFBUSxFQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNqRSxFQUFFLENBQUMsMkJBQTJCLENBQzFCLElBQUksRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLHVCQUF1QixFQUFFLG9CQUFvQixFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUM3RSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUNuQjtvQkFDRCxPQUFPLE1BQU0sQ0FBQztnQkFDaEIsQ0FBQztnQkFFRDs7O21CQUdHO2dCQUNILFNBQVMseUJBQXlCLENBQUMsSUFBYTtvQkFDOUMsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFO3dCQUNqQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCOzRCQUNsQyxNQUFNLE9BQU8sR0FBRyxJQUE0QixDQUFDOzRCQUM3QyxPQUFPLE9BQU8sQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDMUYsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDO3dCQUN2QyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUM7d0JBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQzt3QkFDeEMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDO3dCQUNwQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUM7d0JBQ3JDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxlQUFlOzRCQUNoQyxNQUFNLElBQUksR0FBRyxJQUEyQixDQUFDOzRCQUN6QyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRTtnQ0FDN0QsTUFBTTs2QkFDUDs0QkFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNyQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsb0JBQW9COzRCQUNyQyxNQUFNLFNBQVMsR0FBRyxJQUErQixDQUFDOzRCQUNsRCxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUMxQjs0QkFDRSxNQUFNO3FCQUNUO29CQUNELG9CQUFvQixDQUFDLEtBQUssQ0FDdEIsSUFBSSxFQUFFLGtDQUFrQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUMzRixPQUFPLEVBQUUsQ0FBQztnQkFDWixDQUFDO2dCQUVEOzs7O21CQUlHO2dCQUNILFNBQVMsb0JBQW9CLENBQUMsSUFBYTtvQkFDekMsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsNEJBQTRCLEVBQUU7d0JBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUVuRSxNQUFNLFNBQVMsR0FBRyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbEQsTUFBTSxNQUFNLEdBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakMsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLEVBQUU7d0JBQzVCLE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUUsQ0FBQzt3QkFDbkQsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQzt3QkFDakQscUZBQXFGO3dCQUNyRix1RkFBdUY7d0JBQ3ZGLHlGQUF5Rjt3QkFDekYsMEZBQTBGO3dCQUMxRixhQUFhO3dCQUNiLGdFQUFnRTt3QkFDaEUsSUFBSSxDQUFDLE9BQU8sRUFBRTs0QkFDWixpREFBaUQ7NEJBQ2pELG9GQUFvRjs0QkFDcEYsdUJBQXVCOzRCQUN2QixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUI7Z0NBQUUsU0FBUzs0QkFDNUQsTUFBTSxXQUFXLEdBQUcsdUNBQXNCLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQzs0QkFDdEUsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUN6RCxNQUFNLElBQUksR0FBRyxFQUFFLENBQUMsZUFBZSxDQUMzQixFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7NEJBQ3ZFLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksV0FBVyxJQUFJLFFBQVEsRUFBRSxFQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUNoRixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3lCQUNuQjtxQkFDRjtvQkFDRCxPQUFPLE1BQU0sQ0FBQztnQkFDaEIsQ0FBQztnQkFFRCxTQUFTLE9BQU8sQ0FBQyxJQUFhO29CQUM1QixJQUFJLGVBQWUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ25DLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLElBQXNCLEVBQUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsRUFBRTs0QkFDckYsT0FBTyxJQUFJLENBQUM7eUJBQ2I7d0JBQ0QsT0FBTyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDbkM7b0JBQ0QsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFO3dCQUNqQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCOzRCQUNsQyxPQUFPLHNCQUFzQixDQUFDLElBQTRCLENBQUMsQ0FBQzt3QkFDOUQsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGlCQUFpQjs0QkFDbEMsT0FBTyxzQkFBc0IsQ0FBQyxJQUE0QixDQUFDLENBQUM7d0JBQzlELEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0I7NEJBQ2pDLE9BQU8scUJBQXFCLENBQUMsSUFBMkIsQ0FBQyxDQUFDO3dCQUM1RCxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsb0JBQW9COzRCQUNyQyxPQUFPLHlCQUF5QixDQUFDLElBQStCLENBQUMsQ0FBQzt3QkFDcEUsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWM7NEJBQy9CLE9BQU8sbUJBQW1CLENBQUMsSUFBeUIsQ0FBQyxDQUFDO3dCQUN4RCxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDO3dCQUNqQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsa0JBQWtCOzRCQUNuQyxzRkFBc0Y7NEJBQ3RGLHVGQUF1Rjs0QkFDdkYsdUZBQXVGOzRCQUN2RixPQUFPLEVBQUUsQ0FBQyxXQUFXLENBQ2pCLDRCQUE0QixDQUFDLElBQWdELENBQUMsQ0FBQyxDQUFDO3dCQUN0RixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUMvQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUM7d0JBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQzt3QkFDckMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQzt3QkFDL0IsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVc7NEJBQzVCLE9BQU8sNEJBQTRCLENBQUMsSUFBa0MsQ0FBQyxDQUFDO3dCQUMxRSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVzs0QkFDNUIsT0FBTyxtQkFBbUIsQ0FBQyxJQUF5QixDQUFDLENBQUM7d0JBQ3hELEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUI7NEJBQ2xDLE9BQU8sc0JBQXNCLENBQUMsSUFBNEIsQ0FBQyxDQUFDO3dCQUM5RCxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUM7d0JBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0I7NEJBQ25DLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUN6QixNQUFNO3dCQUNSLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxTQUFTOzRCQUMxQix3RkFBd0Y7NEJBQ3hGLHdGQUF3Rjs0QkFDeEYsK0RBQStEOzRCQUMvRCwwQ0FBMEM7NEJBQzFDLE1BQU0sU0FBUyxHQUFHLElBQStCLENBQUM7NEJBQ2xELElBQUksZUFBZSxDQUFDLGVBQWUsQ0FDM0IsU0FBUyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMseUJBQXlCLENBQUMsRUFBRTtnQ0FDOUQsRUFBRSxDQUFDLDJCQUEyQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQ0FDOUMsS0FBSyxDQUFDLGtDQUFrQyxDQUFDLFNBQVMsQ0FBQyxDQUFDOzZCQUNyRDs0QkFDRCxNQUFNO3dCQUNSLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0I7NEJBQ3JDLE9BQU8seUJBQXlCLENBQUMsSUFBK0IsQ0FBQyxDQUFDO3dCQUNwRSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO3dCQUNoQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsdUJBQXVCOzRCQUN4QyxPQUFPLHdCQUF3QixDQUFDLElBQXdCLENBQUMsQ0FBQzt3QkFDNUQsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGlCQUFpQjs0QkFDbEMsT0FBTyxzQkFBc0IsQ0FBQyxJQUE0QixDQUFDLENBQUM7d0JBQzlEOzRCQUNFLE1BQU07cUJBQ1Q7b0JBQ0QsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ25ELENBQUM7Z0JBRUQsVUFBVSxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFFN0QsT0FBTyxvQkFBb0IsQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsRSxDQUFDLENBQUM7UUFDSixDQUFDLENBQUM7SUFDSixDQUFDO0lBOWpCRCw0Q0E4akJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcganNkb2NfdHJhbnNmb3JtZXIgY29udGFpbnMgdGhlIGxvZ2ljIHRvIGFkZCBKU0RvYyBjb21tZW50cyB0byBUeXBlU2NyaXB0IGNvZGUuXG4gKlxuICogT25lIG9mIHRzaWNrbGUncyBmZWF0dXJlcyBpcyB0byBhZGQgQ2xvc3VyZSBDb21waWxlciBjb21wYXRpYmxlIEpTRG9jIGNvbW1lbnRzIGNvbnRhaW5pbmcgdHlwZVxuICogYW5ub3RhdGlvbnMsIGluaGVyaXRhbmNlIGluZm9ybWF0aW9uLCBldGMuLCBvbnRvIFR5cGVTY3JpcHQgY29kZS4gVGhpcyBhbGxvd3MgQ2xvc3VyZSBDb21waWxlciB0b1xuICogbWFrZSBiZXR0ZXIgb3B0aW1pemF0aW9uIGRlY2lzaW9ucyBjb21wYXJlZCB0byBhbiB1bnR5cGVkIGNvZGUgYmFzZS5cbiAqXG4gKiBUaGUgZW50cnkgcG9pbnQgdG8gdGhlIGFubm90YXRpb24gb3BlcmF0aW9uIGlzIGpzZG9jVHJhbnNmb3JtZXIgYmVsb3cuIEl0IGFkZHMgc3ludGhldGljIGNvbW1lbnRzXG4gKiB0byBleGlzdGluZyBUeXBlU2NyaXB0IGNvbnN0cnVjdHMsIGZvciBleGFtcGxlOlxuICogICAgIGNvbnN0IHg6IG51bWJlciA9IDE7XG4gKiBNaWdodCBnZXQgdHJhbnNmb3JtZWQgdG86XG4gKiAgICAgLy4uIFxcQHR5cGUge251bWJlcn0gLi9cbiAqICAgICBjb25zdCB4OiBudW1iZXIgPSAxO1xuICogTGF0ZXIgVHlwZVNjcmlwdCBwaGFzZXMgdGhlbiByZW1vdmUgdGhlIHR5cGUgYW5ub3RhdGlvbiwgYW5kIHRoZSBmaW5hbCBlbWl0IGlzIEphdmFTY3JpcHQgdGhhdFxuICogb25seSBjb250YWlucyB0aGUgSlNEb2MgY29tbWVudC5cbiAqXG4gKiBUbyBoYW5kbGUgY2VydGFpbiBjb25zdHJ1Y3RzLCB0aGlzIHRyYW5zZm9ybWVyIGFsc28gcGVyZm9ybXMgQVNUIHRyYW5zZm9ybWF0aW9ucywgZS5nLiBieSBhZGRpbmdcbiAqIENvbW1vbkpTLXN0eWxlIGV4cG9ydHMgZm9yIHR5cGUgY29uc3RydWN0cywgZXhwYW5kaW5nIGBleHBvcnQgKmAsIHBhcmVudGhlc2l6aW5nIGNhc3RzLCBldGMuXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7QW5ub3RhdG9ySG9zdCwgbW9kdWxlTmFtZUFzSWRlbnRpZmllcn0gZnJvbSAnLi9hbm5vdGF0b3JfaG9zdCc7XG5pbXBvcnQge2hhc0V4cG9ydGluZ0RlY29yYXRvcn0gZnJvbSAnLi9kZWNvcmF0b3JzJztcbmltcG9ydCAqIGFzIGdvb2dtb2R1bGUgZnJvbSAnLi9nb29nbW9kdWxlJztcbmltcG9ydCAqIGFzIGpzZG9jIGZyb20gJy4vanNkb2MnO1xuaW1wb3J0IHtNb2R1bGVUeXBlVHJhbnNsYXRvcn0gZnJvbSAnLi9tb2R1bGVfdHlwZV90cmFuc2xhdG9yJztcbmltcG9ydCAqIGFzIHRyYW5zZm9ybWVyVXRpbCBmcm9tICcuL3RyYW5zZm9ybWVyX3V0aWwnO1xuaW1wb3J0IHtpc1ZhbGlkQ2xvc3VyZVByb3BlcnR5TmFtZX0gZnJvbSAnLi90eXBlX3RyYW5zbGF0b3InO1xuXG5mdW5jdGlvbiBhZGRDb21tZW50T24obm9kZTogdHMuTm9kZSwgdGFnczoganNkb2MuVGFnW10sIGVzY2FwZUV4dHJhVGFncz86IFNldDxzdHJpbmc+KSB7XG4gIGNvbnN0IGNvbW1lbnQgPSBqc2RvYy50b1N5bnRoZXNpemVkQ29tbWVudCh0YWdzLCBlc2NhcGVFeHRyYVRhZ3MpO1xuICBjb25zdCBjb21tZW50cyA9IHRzLmdldFN5bnRoZXRpY0xlYWRpbmdDb21tZW50cyhub2RlKSB8fCBbXTtcbiAgY29tbWVudHMucHVzaChjb21tZW50KTtcbiAgdHMuc2V0U3ludGhldGljTGVhZGluZ0NvbW1lbnRzKG5vZGUsIGNvbW1lbnRzKTtcbiAgcmV0dXJuIGNvbW1lbnQ7XG59XG5cbnR5cGUgSGFzVHlwZVBhcmFtZXRlcnMgPVxuICAgIHRzLkludGVyZmFjZURlY2xhcmF0aW9ufHRzLkNsYXNzTGlrZURlY2xhcmF0aW9ufHRzLlR5cGVBbGlhc0RlY2xhcmF0aW9ufHRzLlNpZ25hdHVyZURlY2xhcmF0aW9uO1xuXG4vKiogQWRkcyBhbiBcXEB0ZW1wbGF0ZSBjbGF1c2UgdG8gZG9jVGFncyBpZiBkZWNsIGhhcyB0eXBlIHBhcmFtZXRlcnMuICovXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVBZGRUZW1wbGF0ZUNsYXVzZShkb2NUYWdzOiBqc2RvYy5UYWdbXSwgZGVjbDogSGFzVHlwZVBhcmFtZXRlcnMpIHtcbiAgaWYgKCFkZWNsLnR5cGVQYXJhbWV0ZXJzKSByZXR1cm47XG4gIC8vIENsb3N1cmUgZG9lcyBub3Qgc3VwcG9ydCB0ZW1wbGF0ZSBjb25zdHJhaW50cyAoVCBleHRlbmRzIFgpLCB0aGVzZSBhcmUgaWdub3JlZCBiZWxvdy5cbiAgZG9jVGFncy5wdXNoKHtcbiAgICB0YWdOYW1lOiAndGVtcGxhdGUnLFxuICAgIHRleHQ6IGRlY2wudHlwZVBhcmFtZXRlcnMubWFwKHRwID0+IHRyYW5zZm9ybWVyVXRpbC5nZXRJZGVudGlmaWVyVGV4dCh0cC5uYW1lKSkuam9pbignLCAnKVxuICB9KTtcbn1cblxuLyoqXG4gKiBBZGRzIGhlcml0YWdlIGNsYXVzZXMgKFxcQGV4dGVuZHMsIFxcQGltcGxlbWVudHMpIHRvIHRoZSBnaXZlbiBkb2NUYWdzIGZvciBkZWNsLiBVc2VkIGJ5XG4gKiBqc2RvY190cmFuc2Zvcm1lciBhbmQgZXh0ZXJucyBnZW5lcmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVBZGRIZXJpdGFnZUNsYXVzZXMoXG4gICAgZG9jVGFnczoganNkb2MuVGFnW10sIG10dDogTW9kdWxlVHlwZVRyYW5zbGF0b3IsXG4gICAgZGVjbDogdHMuQ2xhc3NMaWtlRGVjbGFyYXRpb258dHMuSW50ZXJmYWNlRGVjbGFyYXRpb24pIHtcbiAgaWYgKCFkZWNsLmhlcml0YWdlQ2xhdXNlcykgcmV0dXJuO1xuICBjb25zdCBpc0NsYXNzID0gZGVjbC5raW5kID09PSB0cy5TeW50YXhLaW5kLkNsYXNzRGVjbGFyYXRpb247XG4gIGNvbnN0IGhhc0V4dGVuZHMgPSBkZWNsLmhlcml0YWdlQ2xhdXNlcy5zb21lKGMgPT4gYy50b2tlbiA9PT0gdHMuU3ludGF4S2luZC5FeHRlbmRzS2V5d29yZCk7XG4gIGZvciAoY29uc3QgaGVyaXRhZ2Ugb2YgZGVjbC5oZXJpdGFnZUNsYXVzZXMpIHtcbiAgICBjb25zdCBpc0V4dGVuZHMgPSBoZXJpdGFnZS50b2tlbiA9PT0gdHMuU3ludGF4S2luZC5FeHRlbmRzS2V5d29yZDtcbiAgICBpZiAoaXNDbGFzcyAmJiBpc0V4dGVuZHMpIHtcbiAgICAgIC8vIElmIGEgY2xhc3MgaGFzIGFuIFwiZXh0ZW5kc1wiLCB0aGF0IGlzIHByZXNlcnZlZCBpbiB0aGUgRVM2IG91dHB1dFxuICAgICAgLy8gYW5kIHdlIGRvbid0IG5lZWQgdG8gZW1pdCBhbnkgYWRkaXRpb25hbCBqc2RvYy5cbiAgICAgIC8vXG4gICAgICAvLyBIb3dldmVyIGZvciBhbWJpZW50IGRlY2xhcmF0aW9ucywgd2Ugb25seSBlbWl0IGV4dGVybnMsIGFuZCBpbiB0aG9zZSB3ZSBkbyBuZWVkIHRvXG4gICAgICAvLyBhZGQgXCJAZXh0ZW5kcyB7Rm9vfVwiIGFzIHRoZXkgdXNlIEVTNSBzeW50YXguXG4gICAgICBpZiAoIXRyYW5zZm9ybWVyVXRpbC5pc0FtYmllbnQoZGVjbCkpIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSwgaWYgd2UgZ2V0IGhlcmUsIHdlIG5lZWQgdG8gZW1pdCBzb21lIGpzZG9jLlxuICAgIGZvciAoY29uc3QgZXhwciBvZiBoZXJpdGFnZS50eXBlcykge1xuICAgICAgY29uc3QgaGVyaXRhZ2UgPSBoZXJpdGFnZU5hbWUoaXNFeHRlbmRzLCBoYXNFeHRlbmRzLCBleHByKTtcbiAgICAgIC8vIGhlcml0YWdlTmFtZSBtYXkgcmV0dXJuIG51bGwsIGluZGljYXRpbmcgdGhhdCB0aGUgY2xhdXNlIGlzIHNvbWV0aGluZyBpbmV4cHJlc3NpYmxlXG4gICAgICAvLyBpbiBDbG9zdXJlLCBlLmcuIFwiY2xhc3MgRm9vIGltcGxlbWVudHMgUGFydGlhbDxCYXI+XCIuXG4gICAgICBpZiAoaGVyaXRhZ2UpIHtcbiAgICAgICAgZG9jVGFncy5wdXNoKHtcbiAgICAgICAgICB0YWdOYW1lOiBoZXJpdGFnZS50YWdOYW1lLFxuICAgICAgICAgIHR5cGU6IGhlcml0YWdlLnBhcmVudE5hbWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgQ2xvc3VyZSBuYW1lIG9mIGFuIGV4cHJlc3Npb24gb2NjdXJyaW5nIGluIGEgaGVyaXRhZ2UgY2xhdXNlLFxuICAgKiBlLmcuIFwiaW1wbGVtZW50cyBGb29CYXJcIi4gIFdpbGwgcmV0dXJuIG51bGwgaWYgdGhlIGV4cHJlc3Npb24gaXMgaW5leHByZXNzaWJsZVxuICAgKiBpbiBDbG9zdXJlIHNlbWFudGljcy4gIE5vdGUgdGhhdCB3ZSBkb24ndCBuZWVkIHRvIGNvbnNpZGVyIGFsbCBwb3NzaWJsZVxuICAgKiBjb21iaW5hdGlvbnMgb2YgdHlwZXMvdmFsdWVzIGFuZCBleHRlbmRzL2ltcGxlbWVudHMgYmVjYXVzZSBvdXIgaW5wdXQgaXNcbiAgICogYWxyZWFkeSB2ZXJpZmllZCB0byBiZSB2YWxpZCBUeXBlU2NyaXB0LiAgU2VlIHRlc3RfZmlsZXMvY2xhc3MvIGZvciB0aGUgZnVsbFxuICAgKiBjYXJ0ZXNpYW4gcHJvZHVjdCBvZiB0ZXN0IGNhc2VzLlxuICAgKiBAcGFyYW0gaXNFeHRlbmRzIFRydWUgaWYgd2UncmUgaW4gYW4gJ2V4dGVuZHMnLCBmYWxzZSBpbiBhbiAnaW1wbGVtZW50cycuXG4gICAqIEBwYXJhbSBoYXNFeHRlbmRzIFRydWUgaWYgdGhlcmUgYXJlIGFueSAnZXh0ZW5kcycgY2xhdXNlcyBwcmVzZW50IGF0IGFsbC5cbiAgICovXG4gIGZ1bmN0aW9uIGhlcml0YWdlTmFtZShcbiAgICAgIGlzRXh0ZW5kczogYm9vbGVhbiwgaGFzRXh0ZW5kczogYm9vbGVhbixcbiAgICAgIGV4cHI6IHRzLkV4cHJlc3Npb25XaXRoVHlwZUFyZ3VtZW50cyk6IHt0YWdOYW1lOiBzdHJpbmcsIHBhcmVudE5hbWU6IHN0cmluZ318bnVsbCB7XG4gICAgbGV0IHRhZ05hbWUgPSBpc0V4dGVuZHMgPyAnZXh0ZW5kcycgOiAnaW1wbGVtZW50cyc7XG4gICAgbGV0IHN5bSA9IG10dC50eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGV4cHIuZXhwcmVzc2lvbik7XG4gICAgaWYgKCFzeW0pIHtcbiAgICAgIC8vIEl0J3MgcG9zc2libGUgZm9yIGEgY2xhc3MgZGVjbGFyYXRpb24gdG8gZXh0ZW5kIGFuIGV4cHJlc3Npb24gdGhhdFxuICAgICAgLy8gZG9lcyBub3QgaGF2ZSBoYXZlIGEgc3ltYm9sLCBmb3IgZXhhbXBsZSB3aGVuIGEgbWl4aW4gZnVuY3Rpb24gaXNcbiAgICAgIC8vIHVzZWQgdG8gYnVpbGQgYSBiYXNlIGNsYXNzLCBhcyBpbiBgZGVjbGFyZSBNeUNsYXNzIGV4dGVuZHNcbiAgICAgIC8vIE15TWl4aW4oTXlCYXNlQ2xhc3MpYC5cbiAgICAgIC8vXG4gICAgICAvLyBIYW5kbGluZyB0aGlzIGNvcnJlY3RseSBpcyB0cmlja3kuIENsb3N1cmUgdGhyb3dzIG9uIHRoaXNcbiAgICAgIC8vIGBleHRlbmRzIDxleHByZXNzaW9uPmAgc3ludGF4IChzZWVcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb29nbGUvY2xvc3VyZS1jb21waWxlci9pc3N1ZXMvMjE4MikuIFdlIHdvdWxkXG4gICAgICAvLyBwcm9iYWJseSBuZWVkIHRvIGdlbmVyYXRlIGFuIGludGVybWVkaWF0ZSBjbGFzcyBkZWNsYXJhdGlvbiBhbmRcbiAgICAgIC8vIGV4dGVuZCB0aGF0LlxuICAgICAgbXR0LmRlYnVnV2FybihkZWNsLCBgY291bGQgbm90IHJlc29sdmUgc3VwZXJ0eXBlOiAke2V4cHIuZ2V0VGV4dCgpfWApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUmVzb2x2ZSBhbnkgYWxpYXNlcyB0byB0aGUgdW5kZXJseWluZyB0eXBlLlxuICAgIGlmIChzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5UeXBlQWxpYXMpIHtcbiAgICAgIC8vIEl0J3MgaW1wbGVtZW50aW5nIGEgdHlwZSBhbGlhcy4gIEZvbGxvdyB0aGUgdHlwZSBhbGlhcyBiYWNrXG4gICAgICAvLyB0byB0aGUgb3JpZ2luYWwgc3ltYm9sIHRvIGNoZWNrIHdoZXRoZXIgaXQncyBhIHR5cGUgb3IgYSB2YWx1ZS5cbiAgICAgIGNvbnN0IHR5cGUgPSBtdHQudHlwZUNoZWNrZXIuZ2V0RGVjbGFyZWRUeXBlT2ZTeW1ib2woc3ltKTtcbiAgICAgIGlmICghdHlwZS5zeW1ib2wpIHtcbiAgICAgICAgLy8gSXQncyBub3QgY2xlYXIgd2hlbiB0aGlzIGNhbiBoYXBwZW4uXG4gICAgICAgIG10dC5kZWJ1Z1dhcm4oZGVjbCwgYGNvdWxkIG5vdCBnZXQgdHlwZSBvZiBzeW1ib2w6ICR7ZXhwci5nZXRUZXh0KCl9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgc3ltID0gdHlwZS5zeW1ib2w7XG4gICAgfVxuICAgIGlmIChzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgc3ltID0gbXR0LnR5cGVDaGVja2VyLmdldEFsaWFzZWRTeW1ib2woc3ltKTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlVHJhbnNsYXRvciA9IG10dC5uZXdUeXBlVHJhbnNsYXRvcihleHByLmV4cHJlc3Npb24pO1xuICAgIGlmICh0eXBlVHJhbnNsYXRvci5pc0JsYWNrTGlzdGVkKHN5bSkpIHtcbiAgICAgIC8vIERvbid0IGVtaXQgcmVmZXJlbmNlcyB0byBibGFja2xpc3RlZCB0eXBlcy5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5DbGFzcykge1xuICAgICAgaWYgKCFpc0NsYXNzKSB7XG4gICAgICAgIC8vIENsb3N1cmUgaW50ZXJmYWNlcyBjYW5ub3QgZXh0ZW5kIG9yIGltcGxlbWVudHMgY2xhc3Nlcy5cbiAgICAgICAgbXR0LmRlYnVnV2FybihkZWNsLCBgb21pdHRpbmcgaW50ZXJmYWNlIGRlcml2aW5nIGZyb20gY2xhc3M6ICR7ZXhwci5nZXRUZXh0KCl9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKCFpc0V4dGVuZHMpIHtcbiAgICAgICAgaWYgKCFoYXNFeHRlbmRzKSB7XG4gICAgICAgICAgLy8gQSBzcGVjaWFsIGNhc2U6IGZvciBhIGNsYXNzIHRoYXQgaGFzIG5vIGV4aXN0aW5nICdleHRlbmRzJyBjbGF1c2UgYnV0IGRvZXNcbiAgICAgICAgICAvLyBoYXZlIGFuICdpbXBsZW1lbnRzJyBjbGF1c2UgdGhhdCByZWZlcnMgdG8gYW5vdGhlciBjbGFzcywgd2UgY2hhbmdlIGl0IHRvXG4gICAgICAgICAgLy8gaW5zdGVhZCBiZSBhbiAnZXh0ZW5kcycuICBUaGlzIHdhcyBhIHBvb3JseS10aG91Z2h0LW91dCBoYWNrIHRoYXQgbWF5XG4gICAgICAgICAgLy8gYWN0dWFsbHkgY2F1c2UgY29tcGlsZXIgYnVnczpcbiAgICAgICAgICAvLyAgIGh0dHBzOi8vZ2l0aHViLmNvbS9nb29nbGUvY2xvc3VyZS1jb21waWxlci9pc3N1ZXMvMzEyNlxuICAgICAgICAgIC8vIGJ1dCB3ZSBoYXZlIGNvZGUgdGhhdCBub3cgcmVsaWVzIG9uIGl0LCB1Z2guXG4gICAgICAgICAgdGFnTmFtZSA9ICdleHRlbmRzJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBDbG9zdXJlIGNhbiBvbmx5IEBpbXBsZW1lbnRzIGFuIGludGVyZmFjZSwgbm90IGEgY2xhc3MuXG4gICAgICAgICAgbXR0LmRlYnVnV2FybihkZWNsLCBgb21pdHRpbmcgQGltcGxlbWVudHMgb2YgYSBjbGFzczogJHtleHByLmdldFRleHQoKX1gKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3ltLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuVmFsdWUpIHtcbiAgICAgIC8vIElmIGl0J3Mgc29tZXRoaW5nIG90aGVyIHRoYW4gYSBjbGFzcyBpbiB0aGUgdmFsdWUgbmFtZXNwYWNlLCB0aGVuIGl0IHdpbGxcbiAgICAgIC8vIG5vdCBiZSBhIHR5cGUgaW4gdGhlIENsb3N1cmUgb3V0cHV0IChiZWNhdXNlIENsb3N1cmUgY29sbGFwc2VzXG4gICAgICAvLyB0aGUgdHlwZSBhbmQgdmFsdWUgbmFtZXNwYWNlcykuXG4gICAgICBtdHQuZGVidWdXYXJuKFxuICAgICAgICAgIGRlY2wsIGBvbWl0dGluZyBoZXJpdGFnZSByZWZlcmVuY2UgdG8gYSB0eXBlL3ZhbHVlIGNvbmZsaWN0OiAke2V4cHIuZ2V0VGV4dCgpfWApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5UeXBlTGl0ZXJhbCkge1xuICAgICAgLy8gQSB0eXBlIGxpdGVyYWwgaXMgYSB0eXBlIGxpa2UgYHtmb286IHN0cmluZ31gLlxuICAgICAgLy8gVGhlc2UgY2FuIGNvbWUgdXAgYXMgdGhlIG91dHB1dCBvZiBhIG1hcHBlZCB0eXBlLlxuICAgICAgbXR0LmRlYnVnV2FybihkZWNsLCBgb21pdHRpbmcgaGVyaXRhZ2UgcmVmZXJlbmNlIHRvIGEgdHlwZSBsaXRlcmFsOiAke2V4cHIuZ2V0VGV4dCgpfWApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gdHlwZVRvQ2xvc3VyZSBpbmNsdWRlcyBudWxsYWJpbGl0eSBtb2RpZmllcnMsIHNvIGNhbGwgc3ltYm9sVG9TdHJpbmcgZGlyZWN0bHkgaGVyZS5cbiAgICBjb25zdCBwYXJlbnROYW1lID0gdHlwZVRyYW5zbGF0b3Iuc3ltYm9sVG9TdHJpbmcoc3ltKTtcbiAgICBpZiAoIXBhcmVudE5hbWUpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB7dGFnTmFtZSwgcGFyZW50TmFtZX07XG4gIH1cbn1cblxuLyoqXG4gKiBjcmVhdGVNZW1iZXJUeXBlRGVjbGFyYXRpb24gZW1pdHMgdGhlIHR5cGUgYW5ub3RhdGlvbnMgZm9yIG1lbWJlcnMgb2YgYSBjbGFzcy4gSXQncyBuZWNlc3NhcnkgaW5cbiAqIHRoZSBjYXNlIHdoZXJlIFR5cGVTY3JpcHQgc3ludGF4IHNwZWNpZmllcyB0aGVyZSBhcmUgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIG9uIHRoZSBjbGFzcywgYmVjYXVzZVxuICogdG8gZGVjbGFyZSB0aGVzZSBpbiBDbG9zdXJlIHlvdSBtdXN0IGRlY2xhcmUgdGhlc2Ugc2VwYXJhdGVseSBmcm9tIHRoZSBjbGFzcy5cbiAqXG4gKiBjcmVhdGVNZW1iZXJUeXBlRGVjbGFyYXRpb24gcHJvZHVjZXMgYW4gaWYgKGZhbHNlKSBzdGF0ZW1lbnQgY29udGFpbmluZyBwcm9wZXJ0eSBkZWNsYXJhdGlvbnMsIG9yXG4gKiBudWxsIGlmIG5vIGRlY2xhcmF0aW9ucyBjb3VsZCBvciBuZWVkZWQgdG8gYmUgZ2VuZXJhdGVkIChlLmcuIG5vIG1lbWJlcnMsIG9yIGFuIHVubmFtZWQgdHlwZSkuXG4gKiBUaGUgaWYgc3RhdGVtZW50IGlzIHVzZWQgdG8gbWFrZSBzdXJlIHRoZSBjb2RlIGlzIG5vdCBleGVjdXRlZCwgb3RoZXJ3aXNlIHByb3BlcnR5IGFjY2Vzc2VzIGNvdWxkXG4gKiB0cmlnZ2VyIGdldHRlcnMgb24gYSBzdXBlcmNsYXNzLiBTZWUgdGVzdF9maWxlcy9maWVsZHMvZmllbGRzLnRzOkJhc2VUaGF0VGhyb3dzLlxuICovXG5mdW5jdGlvbiBjcmVhdGVNZW1iZXJUeXBlRGVjbGFyYXRpb24oXG4gICAgbXR0OiBNb2R1bGVUeXBlVHJhbnNsYXRvcixcbiAgICB0eXBlRGVjbDogdHMuQ2xhc3NEZWNsYXJhdGlvbnx0cy5JbnRlcmZhY2VEZWNsYXJhdGlvbik6IHRzLklmU3RhdGVtZW50fG51bGwge1xuICAvLyBHYXRoZXIgcGFyYW1ldGVyIHByb3BlcnRpZXMgZnJvbSB0aGUgY29uc3RydWN0b3IsIGlmIGl0IGV4aXN0cy5cbiAgY29uc3QgY3RvcnM6IHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb25bXSA9IFtdO1xuICBsZXQgcGFyYW1Qcm9wczogdHMuUGFyYW1ldGVyRGVjbGFyYXRpb25bXSA9IFtdO1xuICBjb25zdCBub25TdGF0aWNQcm9wczogQXJyYXk8dHMuUHJvcGVydHlEZWNsYXJhdGlvbnx0cy5Qcm9wZXJ0eVNpZ25hdHVyZT4gPSBbXTtcbiAgY29uc3Qgc3RhdGljUHJvcHM6IEFycmF5PHRzLlByb3BlcnR5RGVjbGFyYXRpb258dHMuUHJvcGVydHlTaWduYXR1cmU+ID0gW107XG4gIGNvbnN0IHVuaGFuZGxlZDogdHMuTmFtZWREZWNsYXJhdGlvbltdID0gW107XG4gIGNvbnN0IGFic3RyYWN0TWV0aG9kczogdHMuRnVuY3Rpb25MaWtlRGVjbGFyYXRpb25bXSA9IFtdO1xuICBmb3IgKGNvbnN0IG1lbWJlciBvZiB0eXBlRGVjbC5tZW1iZXJzKSB7XG4gICAgaWYgKG1lbWJlci5raW5kID09PSB0cy5TeW50YXhLaW5kLkNvbnN0cnVjdG9yKSB7XG4gICAgICBjdG9ycy5wdXNoKG1lbWJlciBhcyB0cy5Db25zdHJ1Y3RvckRlY2xhcmF0aW9uKTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzUHJvcGVydHlEZWNsYXJhdGlvbihtZW1iZXIpIHx8IHRzLmlzUHJvcGVydHlTaWduYXR1cmUobWVtYmVyKSkge1xuICAgICAgY29uc3QgaXNTdGF0aWMgPSB0cmFuc2Zvcm1lclV0aWwuaGFzTW9kaWZpZXJGbGFnKG1lbWJlciwgdHMuTW9kaWZpZXJGbGFncy5TdGF0aWMpO1xuICAgICAgaWYgKGlzU3RhdGljKSB7XG4gICAgICAgIHN0YXRpY1Byb3BzLnB1c2gobWVtYmVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vblN0YXRpY1Byb3BzLnB1c2gobWVtYmVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBtZW1iZXIua2luZCA9PT0gdHMuU3ludGF4S2luZC5NZXRob2REZWNsYXJhdGlvbiB8fFxuICAgICAgICBtZW1iZXIua2luZCA9PT0gdHMuU3ludGF4S2luZC5NZXRob2RTaWduYXR1cmUgfHxcbiAgICAgICAgbWVtYmVyLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuR2V0QWNjZXNzb3IgfHwgbWVtYmVyLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuU2V0QWNjZXNzb3IpIHtcbiAgICAgIGlmICh0cmFuc2Zvcm1lclV0aWwuaGFzTW9kaWZpZXJGbGFnKG1lbWJlciwgdHMuTW9kaWZpZXJGbGFncy5BYnN0cmFjdCkgfHxcbiAgICAgICAgICB0cy5pc0ludGVyZmFjZURlY2xhcmF0aW9uKHR5cGVEZWNsKSkge1xuICAgICAgICBhYnN0cmFjdE1ldGhvZHMucHVzaChcbiAgICAgICAgICAgIG1lbWJlciBhcyB0cy5NZXRob2REZWNsYXJhdGlvbiB8IHRzLkdldEFjY2Vzc29yRGVjbGFyYXRpb24gfCB0cy5TZXRBY2Nlc3NvckRlY2xhcmF0aW9uKTtcbiAgICAgIH1cbiAgICAgIC8vIE5vbi1hYnN0cmFjdCBtZXRob2RzIG9ubHkgZXhpc3Qgb24gY2xhc3NlcywgYW5kIGFyZSBoYW5kbGVkIGluIHJlZ3VsYXIgZW1pdC5cbiAgICB9IGVsc2Uge1xuICAgICAgdW5oYW5kbGVkLnB1c2gobWVtYmVyKTtcbiAgICB9XG4gIH1cblxuICBpZiAoY3RvcnMubGVuZ3RoID4gMCkge1xuICAgIC8vIE9ubHkgdGhlIGFjdHVhbCBjb25zdHJ1Y3RvciBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggbXVzdCBiZSBsYXN0IGluIGEgcG90ZW50aWFsIHNlcXVlbmNlIG9mXG4gICAgLy8gb3ZlcmxvYWRlZCBjb25zdHJ1Y3RvcnMsIG1heSBjb250YWluIHBhcmFtZXRlciBwcm9wZXJ0aWVzLlxuICAgIGNvbnN0IGN0b3IgPSBjdG9yc1tjdG9ycy5sZW5ndGggLSAxXTtcbiAgICBwYXJhbVByb3BzID0gY3Rvci5wYXJhbWV0ZXJzLmZpbHRlcihcbiAgICAgICAgcCA9PiB0cmFuc2Zvcm1lclV0aWwuaGFzTW9kaWZpZXJGbGFnKHAsIHRzLk1vZGlmaWVyRmxhZ3MuUGFyYW1ldGVyUHJvcGVydHlNb2RpZmllcikpO1xuICB9XG5cbiAgaWYgKG5vblN0YXRpY1Byb3BzLmxlbmd0aCA9PT0gMCAmJiBwYXJhbVByb3BzLmxlbmd0aCA9PT0gMCAmJiBzdGF0aWNQcm9wcy5sZW5ndGggPT09IDAgJiZcbiAgICAgIGFic3RyYWN0TWV0aG9kcy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBUaGVyZSBhcmUgbm8gbWVtYmVycyBzbyB3ZSBkb24ndCBuZWVkIHRvIGVtaXQgYW55IHR5cGVcbiAgICAvLyBhbm5vdGF0aW9ucyBoZWxwZXIuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBpZiAoIXR5cGVEZWNsLm5hbWUpIHtcbiAgICBtdHQuZGVidWdXYXJuKHR5cGVEZWNsLCAnY2Fubm90IGFkZCB0eXBlcyBvbiB1bm5hbWVkIGRlY2xhcmF0aW9ucycpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgY2xhc3NOYW1lID0gdHJhbnNmb3JtZXJVdGlsLmdldElkZW50aWZpZXJUZXh0KHR5cGVEZWNsLm5hbWUpO1xuICBjb25zdCBzdGF0aWNQcm9wQWNjZXNzID0gdHMuY3JlYXRlSWRlbnRpZmllcihjbGFzc05hbWUpO1xuICBjb25zdCBpbnN0YW5jZVByb3BBY2Nlc3MgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhzdGF0aWNQcm9wQWNjZXNzLCAncHJvdG90eXBlJyk7XG4gIC8vIENsb3N1cmUgQ29tcGlsZXIgd2lsbCByZXBvcnQgY29uZm9ybWFuY2UgZXJyb3JzIGFib3V0IHRoaXMgYmVpbmcgdW5rbm93biB0eXBlIHdoZW4gZW1pdHRpbmdcbiAgLy8gY2xhc3MgcHJvcGVydGllcyBhcyB7P3x1bmRlZmluZWR9LCBpbnN0ZWFkIG9mIGp1c3Qgez99LiBTbyBtYWtlIHN1cmUgdG8gb25seSBlbWl0IHs/fHVuZGVmaW5lZH1cbiAgLy8gb24gaW50ZXJmYWNlcy5cbiAgY29uc3QgaXNJbnRlcmZhY2UgPSB0cy5pc0ludGVyZmFjZURlY2xhcmF0aW9uKHR5cGVEZWNsKTtcbiAgY29uc3QgcHJvcGVydHlEZWNscyA9IHN0YXRpY1Byb3BzLm1hcChcbiAgICAgIHAgPT4gY3JlYXRlQ2xvc3VyZVByb3BlcnR5RGVjbGFyYXRpb24oXG4gICAgICAgICAgbXR0LCBzdGF0aWNQcm9wQWNjZXNzLCBwLCBpc0ludGVyZmFjZSAmJiAhIXAucXVlc3Rpb25Ub2tlbikpO1xuICBwcm9wZXJ0eURlY2xzLnB1c2goLi4uWy4uLm5vblN0YXRpY1Byb3BzLCAuLi5wYXJhbVByb3BzXS5tYXAoXG4gICAgICBwID0+IGNyZWF0ZUNsb3N1cmVQcm9wZXJ0eURlY2xhcmF0aW9uKFxuICAgICAgICAgIG10dCwgaW5zdGFuY2VQcm9wQWNjZXNzLCBwLCBpc0ludGVyZmFjZSAmJiAhIXAucXVlc3Rpb25Ub2tlbikpKTtcbiAgcHJvcGVydHlEZWNscy5wdXNoKC4uLnVuaGFuZGxlZC5tYXAoXG4gICAgICBwID0+IHRyYW5zZm9ybWVyVXRpbC5jcmVhdGVNdWx0aUxpbmVDb21tZW50KFxuICAgICAgICAgIHAsIGBTa2lwcGluZyB1bmhhbmRsZWQgbWVtYmVyOiAke2VzY2FwZUZvckNvbW1lbnQocC5nZXRUZXh0KCkpfWApKSk7XG5cbiAgZm9yIChjb25zdCBmbkRlY2wgb2YgYWJzdHJhY3RNZXRob2RzKSB7XG4gICAgY29uc3QgbmFtZSA9IHByb3BlcnR5TmFtZShmbkRlY2wpO1xuICAgIGlmICghbmFtZSkge1xuICAgICAgbXR0LmVycm9yKGZuRGVjbCwgJ2Fub255bW91cyBhYnN0cmFjdCBmdW5jdGlvbicpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHt0YWdzLCBwYXJhbWV0ZXJOYW1lc30gPSBtdHQuZ2V0RnVuY3Rpb25UeXBlSlNEb2MoW2ZuRGVjbF0sIFtdKTtcbiAgICBpZiAoaGFzRXhwb3J0aW5nRGVjb3JhdG9yKGZuRGVjbCwgbXR0LnR5cGVDaGVja2VyKSkgdGFncy5wdXNoKHt0YWdOYW1lOiAnZXhwb3J0J30pO1xuICAgIC8vIG1lbWJlck5hbWVzcGFjZSBiZWNhdXNlIGFic3RyYWN0IG1ldGhvZHMgY2Fubm90IGJlIHN0YXRpYyBpbiBUeXBlU2NyaXB0LlxuICAgIGNvbnN0IGFic3RyYWN0Rm5EZWNsID0gdHMuY3JlYXRlU3RhdGVtZW50KHRzLmNyZWF0ZUFzc2lnbm1lbnQoXG4gICAgICAgIHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGluc3RhbmNlUHJvcEFjY2VzcywgbmFtZSksXG4gICAgICAgIHRzLmNyZWF0ZUZ1bmN0aW9uRXhwcmVzc2lvbihcbiAgICAgICAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAvKiBhc3RlcmlzayAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAvKiBuYW1lICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHBhcmFtZXRlck5hbWVzLm1hcChcbiAgICAgICAgICAgICAgICBuID0+IHRzLmNyZWF0ZVBhcmFtZXRlcihcbiAgICAgICAgICAgICAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIC8qIGRvdERvdERvdCAqLyB1bmRlZmluZWQsIG4pKSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRzLmNyZWF0ZUJsb2NrKFtdKSxcbiAgICAgICAgICAgICkpKTtcbiAgICB0cy5zZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHMoYWJzdHJhY3RGbkRlY2wsIFtqc2RvYy50b1N5bnRoZXNpemVkQ29tbWVudCh0YWdzKV0pO1xuICAgIHByb3BlcnR5RGVjbHMucHVzaCh0cy5zZXRTb3VyY2VNYXBSYW5nZShhYnN0cmFjdEZuRGVjbCwgZm5EZWNsKSk7XG4gIH1cblxuICAvLyBTZWUgdGVzdF9maWxlcy9maWVsZHMvZmllbGRzLnRzOkJhc2VUaGF0VGhyb3dzIGZvciBhIG5vdGUgb24gdGhpcyB3cmFwcGVyLlxuICByZXR1cm4gdHMuY3JlYXRlSWYodHMuY3JlYXRlTGl0ZXJhbChmYWxzZSksIHRzLmNyZWF0ZUJsb2NrKHByb3BlcnR5RGVjbHMsIHRydWUpKTtcbn1cblxuZnVuY3Rpb24gcHJvcGVydHlOYW1lKHByb3A6IHRzLk5hbWVkRGVjbGFyYXRpb24pOiBzdHJpbmd8bnVsbCB7XG4gIGlmICghcHJvcC5uYW1lKSByZXR1cm4gbnVsbDtcblxuICBzd2l0Y2ggKHByb3AubmFtZS5raW5kKSB7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXI6XG4gICAgICByZXR1cm4gdHJhbnNmb3JtZXJVdGlsLmdldElkZW50aWZpZXJUZXh0KHByb3AubmFtZSBhcyB0cy5JZGVudGlmaWVyKTtcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuU3RyaW5nTGl0ZXJhbDpcbiAgICAgIC8vIEUuZy4gaW50ZXJmYWNlIEZvbyB7ICdiYXInOiBudW1iZXI7IH1cbiAgICAgIC8vIElmICdiYXInIGlzIGEgbmFtZSB0aGF0IGlzIG5vdCB2YWxpZCBpbiBDbG9zdXJlIHRoZW4gdGhlcmUncyBub3RoaW5nIHdlIGNhbiBkby5cbiAgICAgIGNvbnN0IHRleHQgPSAocHJvcC5uYW1lIGFzIHRzLlN0cmluZ0xpdGVyYWwpLnRleHQ7XG4gICAgICBpZiAoIWlzVmFsaWRDbG9zdXJlUHJvcGVydHlOYW1lKHRleHQpKSByZXR1cm4gbnVsbDtcbiAgICAgIHJldHVybiB0ZXh0O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKiogUmVtb3ZlcyBjb21tZW50IG1ldGFjaGFyYWN0ZXJzIGZyb20gYSBzdHJpbmcsIHRvIG1ha2UgaXQgc2FmZSB0byBlbWJlZCBpbiBhIGNvbW1lbnQuICovXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlRm9yQ29tbWVudChzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXFwvXFwqL2csICdfXycpLnJlcGxhY2UoL1xcKlxcLy9nLCAnX18nKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ2xvc3VyZVByb3BlcnR5RGVjbGFyYXRpb24oXG4gICAgbXR0OiBNb2R1bGVUeXBlVHJhbnNsYXRvciwgZXhwcjogdHMuRXhwcmVzc2lvbixcbiAgICBwcm9wOiB0cy5Qcm9wZXJ0eURlY2xhcmF0aW9ufHRzLlByb3BlcnR5U2lnbmF0dXJlfHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uLFxuICAgIG9wdGlvbmFsOiBib29sZWFuKTogdHMuU3RhdGVtZW50IHtcbiAgY29uc3QgbmFtZSA9IHByb3BlcnR5TmFtZShwcm9wKTtcbiAgaWYgKCFuYW1lKSB7XG4gICAgbXR0LmRlYnVnV2Fybihwcm9wLCBgaGFuZGxlIHVubmFtZWQgbWVtYmVyOlxcbiR7ZXNjYXBlRm9yQ29tbWVudChwcm9wLmdldFRleHQoKSl9YCk7XG4gICAgcmV0dXJuIHRyYW5zZm9ybWVyVXRpbC5jcmVhdGVNdWx0aUxpbmVDb21tZW50KFxuICAgICAgICBwcm9wLCBgU2tpcHBpbmcgdW5uYW1lZCBtZW1iZXI6XFxuJHtlc2NhcGVGb3JDb21tZW50KHByb3AuZ2V0VGV4dCgpKX1gKTtcbiAgfVxuXG4gIGxldCB0eXBlID0gbXR0LnR5cGVUb0Nsb3N1cmUocHJvcCk7XG4gIC8vIFdoZW4gYSBwcm9wZXJ0eSBpcyBvcHRpb25hbCwgZS5nLlxuICAvLyAgIGZvbz86IHN0cmluZztcbiAgLy8gVGhlbiB0aGUgVHlwZVNjcmlwdCB0eXBlIG9mIHRoZSBwcm9wZXJ0eSBpcyBzdHJpbmd8dW5kZWZpbmVkLCB0aGVcbiAgLy8gdHlwZVRvQ2xvc3VyZSB0cmFuc2xhdGlvbiBoYW5kbGVzIGl0IGNvcnJlY3RseSwgYW5kIHN0cmluZ3x1bmRlZmluZWQgaXNcbiAgLy8gaG93IHlvdSB3cml0ZSBhbiBvcHRpb25hbCBwcm9wZXJ0eSBpbiBDbG9zdXJlLlxuICAvL1xuICAvLyBCdXQgaW4gdGhlIHNwZWNpYWwgY2FzZSBvZiBhbiBvcHRpb25hbCBwcm9wZXJ0eSB3aXRoIHR5cGUgYW55OlxuICAvLyAgIGZvbz86IGFueTtcbiAgLy8gVGhlIFR5cGVTY3JpcHQgdHlwZSBvZiB0aGUgcHJvcGVydHkgaXMganVzdCBcImFueVwiIChiZWNhdXNlIGFueSBpbmNsdWRlc1xuICAvLyB1bmRlZmluZWQgYXMgd2VsbCkgc28gb3VyIGRlZmF1bHQgdHJhbnNsYXRpb24gb2YgdGhlIHR5cGUgaXMganVzdCBcIj9cIi5cbiAgLy8gVG8gbWFyayB0aGUgcHJvcGVydHkgYXMgb3B0aW9uYWwgaW4gQ2xvc3VyZSBpdCBtdXN0IGhhdmUgXCJ8dW5kZWZpbmVkXCIsXG4gIC8vIHNvIHRoZSBDbG9zdXJlIHR5cGUgbXVzdCBiZSA/fHVuZGVmaW5lZC5cbiAgaWYgKG9wdGlvbmFsICYmIHR5cGUgPT09ICc/JykgdHlwZSArPSAnfHVuZGVmaW5lZCc7XG5cbiAgY29uc3QgdGFncyA9IG10dC5nZXRKU0RvYyhwcm9wLCAvKiByZXBvcnRXYXJuaW5ncyAqLyB0cnVlKTtcbiAgdGFncy5wdXNoKHt0YWdOYW1lOiAndHlwZScsIHR5cGV9KTtcbiAgY29uc3QgZmxhZ3MgPSB0cy5nZXRDb21iaW5lZE1vZGlmaWVyRmxhZ3MocHJvcCk7XG4gIGlmIChmbGFncyAmIHRzLk1vZGlmaWVyRmxhZ3MuUHJvdGVjdGVkKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiAncHJvdGVjdGVkJ30pO1xuICB9IGVsc2UgaWYgKGZsYWdzICYgdHMuTW9kaWZpZXJGbGFncy5Qcml2YXRlKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiAncHJpdmF0ZSd9KTtcbiAgfVxuICBpZiAoaGFzRXhwb3J0aW5nRGVjb3JhdG9yKHByb3AsIG10dC50eXBlQ2hlY2tlcikpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6ICdleHBvcnQnfSk7XG4gIH1cbiAgY29uc3QgZGVjbFN0bXQgPVxuICAgICAgdHMuc2V0U291cmNlTWFwUmFuZ2UodHMuY3JlYXRlU3RhdGVtZW50KHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGV4cHIsIG5hbWUpKSwgcHJvcCk7XG4gIC8vIEF2b2lkIHByaW50aW5nIGFubm90YXRpb25zIHRoYXQgY2FuIGNvbmZsaWN0IHdpdGggQHR5cGVcbiAgLy8gVGhpcyBhdm9pZHMgQ2xvc3VyZSdzIGVycm9yIFwidHlwZSBhbm5vdGF0aW9uIGluY29tcGF0aWJsZSB3aXRoIG90aGVyIGFubm90YXRpb25zXCJcbiAgYWRkQ29tbWVudE9uKGRlY2xTdG10LCB0YWdzLCBqc2RvYy5UQUdTX0NPTkZMSUNUSU5HX1dJVEhfVFlQRSk7XG4gIHJldHVybiBkZWNsU3RtdDtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIGFueSB0eXBlIGFzc2VydGlvbnMgYW5kIG5vbi1udWxsIGV4cHJlc3Npb25zIGZyb20gdGhlIEFTVCBiZWZvcmUgVHlwZVNjcmlwdCBwcm9jZXNzaW5nLlxuICpcbiAqIElkZWFsbHksIHRoZSBjb2RlIGluIGpzZG9jX3RyYW5zZm9ybWVyIGJlbG93IHNob3VsZCBqdXN0IHJlbW92ZSB0aGUgY2FzdCBleHByZXNzaW9uIGFuZFxuICogcmVwbGFjZSBpdCB3aXRoIHRoZSBDbG9zdXJlIGVxdWl2YWxlbnQuIEhvd2V2ZXIgQW5ndWxhcidzIGNvbXBpbGVyIGlzIGZyYWdpbGUgdG8gQVNUXG4gKiBub2RlcyBiZWluZyByZW1vdmVkIG9yIGNoYW5naW5nIHR5cGUsIHNvIHRoZSBjb2RlIG11c3QgcmV0YWluIHRoZSB0eXBlIGFzc2VydGlvblxuICogZXhwcmVzc2lvbiwgc2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy8yNDg5NS5cbiAqXG4gKiB0c2lja2xlIGFsc28gY2Fubm90IGp1c3QgZ2VuZXJhdGUgYW5kIGtlZXAgYSBgKC8uLiBAdHlwZSB7U29tZVR5cGV9IC4vIChleHByIGFzIFNvbWVUeXBlKSlgXG4gKiBiZWNhdXNlIFR5cGVTY3JpcHQgcmVtb3ZlcyB0aGUgcGFyZW50aGVzaXplZCBleHByZXNzaW9ucyBpbiB0aGF0IHN5bnRheCwgKHJlYXNvbmFibHkpIGJlbGlldmluZ1xuICogdGhleSB3ZXJlIG9ubHkgYWRkZWQgZm9yIHRoZSBUUyBjYXN0LlxuICpcbiAqIFRoZSBmaW5hbCB3b3JrYXJvdW5kIGlzIHRoZW4gdG8ga2VlcCB0aGUgVHlwZVNjcmlwdCB0eXBlIGFzc2VydGlvbnMsIGFuZCBoYXZlIGEgcG9zdC1Bbmd1bGFyXG4gKiBwcm9jZXNzaW5nIHN0ZXAgdGhhdCByZW1vdmVzIHRoZSBhc3NlcnRpb25zIGJlZm9yZSBUeXBlU2NyaXB0IHNlZXMgdGhlbS5cbiAqXG4gKiBUT0RPKG1hcnRpbnByb2JzdCk6IHJlbW92ZSBvbmNlIHRoZSBBbmd1bGFyIGlzc3VlIGlzIGZpeGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlVHlwZUFzc2VydGlvbnMoKTogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+IHtcbiAgcmV0dXJuIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpID0+IHtcbiAgICByZXR1cm4gKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHtcbiAgICAgIGZ1bmN0aW9uIHZpc2l0b3Iobm9kZTogdHMuTm9kZSk6IHRzLk5vZGUge1xuICAgICAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UeXBlQXNzZXJ0aW9uRXhwcmVzc2lvbjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQXNFeHByZXNzaW9uOlxuICAgICAgICAgICAgcmV0dXJuIHRzLnZpc2l0Tm9kZSgobm9kZSBhcyB0cy5Bc3NlcnRpb25FeHByZXNzaW9uKS5leHByZXNzaW9uLCB2aXNpdG9yKTtcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTm9uTnVsbEV4cHJlc3Npb246XG4gICAgICAgICAgICByZXR1cm4gdHMudmlzaXROb2RlKChub2RlIGFzIHRzLk5vbk51bGxFeHByZXNzaW9uKS5leHByZXNzaW9uLCB2aXNpdG9yKTtcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0b3IsIGNvbnRleHQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmlzaXRvcihzb3VyY2VGaWxlKSBhcyB0cy5Tb3VyY2VGaWxlO1xuICAgIH07XG4gIH07XG59XG5cbi8qKlxuICoganNkb2NUcmFuc2Zvcm1lciByZXR1cm5zIGEgdHJhbnNmb3JtZXIgZmFjdG9yeSB0aGF0IGNvbnZlcnRzIFR5cGVTY3JpcHQgdHlwZXMgaW50byB0aGUgZXF1aXZhbGVudFxuICogSlNEb2MgYW5ub3RhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBqc2RvY1RyYW5zZm9ybWVyKFxuICAgIGhvc3Q6IEFubm90YXRvckhvc3QsIHRzT3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zLFxuICAgIG1vZHVsZVJlc29sdXRpb25Ib3N0OiB0cy5Nb2R1bGVSZXNvbHV0aW9uSG9zdCwgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLFxuICAgIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10pOiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PlxuICAgIHRzLlRyYW5zZm9ybWVyPHRzLlNvdXJjZUZpbGU+IHtcbiAgcmV0dXJuIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpOiB0cy5UcmFuc2Zvcm1lcjx0cy5Tb3VyY2VGaWxlPiA9PiB7XG4gICAgcmV0dXJuIChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB7XG4gICAgICBjb25zdCBtb2R1bGVUeXBlVHJhbnNsYXRvciA9IG5ldyBNb2R1bGVUeXBlVHJhbnNsYXRvcihcbiAgICAgICAgICBzb3VyY2VGaWxlLCB0eXBlQ2hlY2tlciwgaG9zdCwgZGlhZ25vc3RpY3MsIC8qaXNGb3JFeHRlcm5zKi8gZmFsc2UpO1xuICAgICAgLyoqXG4gICAgICAgKiBUaGUgc2V0IG9mIGFsbCBuYW1lcyBleHBvcnRlZCBmcm9tIGFuIGV4cG9ydCAqIGluIHRoZSBjdXJyZW50IG1vZHVsZS4gVXNlZCB0byBwcmV2ZW50XG4gICAgICAgKiBlbWl0dGluZyBkdXBsaWNhdGVkIGV4cG9ydHMuIFRoZSBmaXJzdCBleHBvcnQgKiB0YWtlcyBwcmVjZWRlbmNlIGluIEVTNi5cbiAgICAgICAqL1xuICAgICAgY29uc3QgZXhwYW5kZWRTdGFySW1wb3J0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgICAvKipcbiAgICAgICAqIFdoaWxlIENsb3N1cmUgY29tcGlsZXIgc3VwcG9ydHMgcGFyYW1ldGVyaXplZCB0eXBlcywgaW5jbHVkaW5nIHBhcmFtZXRlcml6ZWQgYHRoaXNgIG9uXG4gICAgICAgKiBtZXRob2RzLCBpdCBkb2VzIG5vdCBzdXBwb3J0IGNvbnN0cmFpbnRzIG9uIHRoZW0uIFRoYXQgbWVhbnMgdGhhdCBhbiBgXFxAdGVtcGxhdGVgZCB0eXBlIGlzXG4gICAgICAgKiBhbHdheXMgY29uc2lkZXJlZCB0byBiZSBgdW5rbm93bmAgd2l0aGluIHRoZSBtZXRob2QsIGluY2x1ZGluZyBgVEhJU2AuXG4gICAgICAgKlxuICAgICAgICogVG8gaGVscCBDbG9zdXJlIENvbXBpbGVyLCB3ZSBrZWVwIHRyYWNrIG9mIGFueSB0ZW1wbGF0ZWQgdGhpcyByZXR1cm4gdHlwZSwgYW5kIHN1YnN0aXR1dGVcbiAgICAgICAqIGV4cGxpY2l0IGNhc3RzIHRvIHRoZSB0ZW1wbGF0ZWQgdHlwZS5cbiAgICAgICAqXG4gICAgICAgKiBUaGlzIGlzIGFuIGluY29tcGxldGUgc29sdXRpb24gYW5kIHdvcmtzIGFyb3VuZCBhIHNwZWNpZmljIHByb2JsZW0gd2l0aCB3YXJuaW5ncyBvbiB1bmtub3duXG4gICAgICAgKiB0aGlzIGFjY2Vzc2VzLiBNb3JlIGdlbmVyYWxseSwgQ2xvc3VyZSBhbHNvIGNhbm5vdCBpbmZlciBjb25zdHJhaW50cyBmb3IgYW55IG90aGVyXG4gICAgICAgKiB0ZW1wbGF0ZWQgdHlwZXMsIGJ1dCB0aGF0IG1pZ2h0IHJlcXVpcmUgYSBtb3JlIGdlbmVyYWwgc29sdXRpb24gaW4gQ2xvc3VyZSBDb21waWxlci5cbiAgICAgICAqL1xuICAgICAgbGV0IGNvbnRleHRUaGlzVHlwZTogdHMuVHlwZXxudWxsID0gbnVsbDtcblxuICAgICAgZnVuY3Rpb24gdmlzaXRDbGFzc0RlY2xhcmF0aW9uKGNsYXNzRGVjbDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IHRzLlN0YXRlbWVudFtdIHtcbiAgICAgICAgY29uc3QgY29udGV4dFRoaXNUeXBlQmFja3VwID0gY29udGV4dFRoaXNUeXBlO1xuXG4gICAgICAgIGNvbnN0IG1qc2RvYyA9IG1vZHVsZVR5cGVUcmFuc2xhdG9yLmdldE11dGFibGVKU0RvYyhjbGFzc0RlY2wpO1xuICAgICAgICBpZiAodHJhbnNmb3JtZXJVdGlsLmhhc01vZGlmaWVyRmxhZyhjbGFzc0RlY2wsIHRzLk1vZGlmaWVyRmxhZ3MuQWJzdHJhY3QpKSB7XG4gICAgICAgICAgbWpzZG9jLnRhZ3MucHVzaCh7dGFnTmFtZTogJ2Fic3RyYWN0J30pO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF5YmVBZGRUZW1wbGF0ZUNsYXVzZShtanNkb2MudGFncywgY2xhc3NEZWNsKTtcbiAgICAgICAgaWYgKCFob3N0LnVudHlwZWQpIHtcbiAgICAgICAgICBtYXliZUFkZEhlcml0YWdlQ2xhdXNlcyhtanNkb2MudGFncywgbW9kdWxlVHlwZVRyYW5zbGF0b3IsIGNsYXNzRGVjbCk7XG4gICAgICAgIH1cbiAgICAgICAgbWpzZG9jLnVwZGF0ZUNvbW1lbnQoKTtcbiAgICAgICAgY29uc3QgZGVjbHM6IHRzLlN0YXRlbWVudFtdID0gW107XG4gICAgICAgIGNvbnN0IG1lbWJlckRlY2wgPSBjcmVhdGVNZW1iZXJUeXBlRGVjbGFyYXRpb24obW9kdWxlVHlwZVRyYW5zbGF0b3IsIGNsYXNzRGVjbCk7XG4gICAgICAgIC8vIFdBUk5JTkc6IG9yZGVyIGlzIHNpZ25pZmljYW50OyB3ZSBtdXN0IGNyZWF0ZSB0aGUgbWVtYmVyIGRlY2wgYmVmb3JlIHRyYW5zZm9ybWluZyBhd2F5XG4gICAgICAgIC8vIHBhcmFtZXRlciBwcm9wZXJ0eSBjb21tZW50cyB3aGVuIHZpc2l0aW5nIHRoZSBjb25zdHJ1Y3Rvci5cbiAgICAgICAgZGVjbHMucHVzaCh0cy52aXNpdEVhY2hDaGlsZChjbGFzc0RlY2wsIHZpc2l0b3IsIGNvbnRleHQpKTtcbiAgICAgICAgaWYgKG1lbWJlckRlY2wpIGRlY2xzLnB1c2gobWVtYmVyRGVjbCk7XG4gICAgICAgIGNvbnRleHRUaGlzVHlwZSA9IGNvbnRleHRUaGlzVHlwZUJhY2t1cDtcbiAgICAgICAgcmV0dXJuIGRlY2xzO1xuICAgICAgfVxuXG4gICAgICAvKipcbiAgICAgICAqIHZpc2l0SGVyaXRhZ2VDbGF1c2Ugd29ya3MgYXJvdW5kIGEgQ2xvc3VyZSBDb21waWxlciBpc3N1ZSwgd2hlcmUgdGhlIGV4cHJlc3Npb24gaW4gYW5cbiAgICAgICAqIFwiZXh0ZW5kc1wiIGNsYXVzZSBtdXN0IGJlIGEgc2ltcGxlIGlkZW50aWZpZXIsIGFuZCBpbiBwYXJ0aWN1bGFyIG11c3Qgbm90IGJlIGEgcGFyZW50aGVzaXplZFxuICAgICAgICogZXhwcmVzc2lvbi5cbiAgICAgICAqXG4gICAgICAgKiBUaGlzIGlzIHRyaWdnZXJlZCB3aGVuIFRTIGNvZGUgd3JpdGVzIFwiY2xhc3MgWCBleHRlbmRzIChGb28gYXMgQmFyKSB7IC4uLiB9XCIsIGNvbW1vbmx5IGRvbmVcbiAgICAgICAqIHRvIHN1cHBvcnQgbWl4aW5zLiBGb3IgZXh0ZW5kcyBjbGF1c2VzIGluIGNsYXNzZXMsIHRoZSBjb2RlIGJlbG93IGRyb3BzIHRoZSBjYXN0IGFuZCBhbnlcbiAgICAgICAqIHBhcmVudGhldGljYWxzLCBsZWF2aW5nIGp1c3QgdGhlIG9yaWdpbmFsIGV4cHJlc3Npb24uXG4gICAgICAgKlxuICAgICAgICogVGhpcyBpcyBhbiBpbmNvbXBsZXRlIHdvcmthcm91bmQsIGFzIENsb3N1cmUgd2lsbCBzdGlsbCBiYWlsIG9uIG90aGVyIHN1cGVyIGV4cHJlc3Npb25zLFxuICAgICAgICogYnV0IHJldGFpbnMgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBwcmV2aW91cyBlbWl0IHRoYXQgKGFjY2lkZW50YWxseSkgZHJvcHBlZCB0aGUgY2FzdFxuICAgICAgICogZXhwcmVzc2lvbi5cbiAgICAgICAqXG4gICAgICAgKiBUT0RPKG1hcnRpbnByb2JzdCk6IHJlbW92ZSB0aGlzIG9uY2UgdGhlIENsb3N1cmUgc2lkZSBpc3N1ZSBoYXMgYmVlbiByZXNvbHZlZC5cbiAgICAgICAqL1xuICAgICAgZnVuY3Rpb24gdmlzaXRIZXJpdGFnZUNsYXVzZShoZXJpdGFnZUNsYXVzZTogdHMuSGVyaXRhZ2VDbGF1c2UpIHtcbiAgICAgICAgaWYgKGhlcml0YWdlQ2xhdXNlLnRva2VuICE9PSB0cy5TeW50YXhLaW5kLkV4dGVuZHNLZXl3b3JkIHx8ICFoZXJpdGFnZUNsYXVzZS5wYXJlbnQgfHxcbiAgICAgICAgICAgIGhlcml0YWdlQ2xhdXNlLnBhcmVudC5raW5kID09PSB0cy5TeW50YXhLaW5kLkludGVyZmFjZURlY2xhcmF0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKGhlcml0YWdlQ2xhdXNlLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyaXRhZ2VDbGF1c2UudHlwZXMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IuZXJyb3IoXG4gICAgICAgICAgICAgIGhlcml0YWdlQ2xhdXNlLCBgZXhwZWN0ZWQgZXhhY3RseSBvbmUgdHlwZSBpbiBjbGFzcyBleHRlbnNpb24gY2xhdXNlYCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdHlwZSA9IGhlcml0YWdlQ2xhdXNlLnR5cGVzWzBdO1xuICAgICAgICBsZXQgZXhwcjogdHMuRXhwcmVzc2lvbiA9IHR5cGUuZXhwcmVzc2lvbjtcbiAgICAgICAgd2hpbGUgKHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24oZXhwcikgfHwgdHMuaXNOb25OdWxsRXhwcmVzc2lvbihleHByKSB8fFxuICAgICAgICAgICAgICAgdHMuaXNBc3NlcnRpb25FeHByZXNzaW9uKGV4cHIpKSB7XG4gICAgICAgICAgZXhwciA9IGV4cHIuZXhwcmVzc2lvbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHMudXBkYXRlSGVyaXRhZ2VDbGF1c2UoaGVyaXRhZ2VDbGF1c2UsIFt0cy51cGRhdGVFeHByZXNzaW9uV2l0aFR5cGVBcmd1bWVudHMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUsIHR5cGUudHlwZUFyZ3VtZW50cyB8fCBbXSwgZXhwcildKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdmlzaXRJbnRlcmZhY2VEZWNsYXJhdGlvbihpZmFjZTogdHMuSW50ZXJmYWNlRGVjbGFyYXRpb24pOiB0cy5TdGF0ZW1lbnRbXSB7XG4gICAgICAgIGNvbnN0IHN5bSA9IHR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oaWZhY2UubmFtZSk7XG4gICAgICAgIGlmICghc3ltKSB7XG4gICAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IuZXJyb3IoaWZhY2UsICdpbnRlcmZhY2Ugd2l0aCBubyBzeW1ib2wnKTtcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgdGhpcyBzeW1ib2wgaXMgYm90aCBhIHR5cGUgYW5kIGEgdmFsdWUsIHdlIGNhbm5vdCBlbWl0IGJvdGggaW50byBDbG9zdXJlJ3NcbiAgICAgICAgLy8gc2luZ2xlIG5hbWVzcGFjZS5cbiAgICAgICAgaWYgKHN5bS5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLlZhbHVlKSB7XG4gICAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IuZGVidWdXYXJuKFxuICAgICAgICAgICAgICBpZmFjZSwgYHR5cGUvc3ltYm9sIGNvbmZsaWN0IGZvciAke3N5bS5uYW1lfSwgdXNpbmcgez99IGZvciBub3dgKTtcbiAgICAgICAgICByZXR1cm4gW3RyYW5zZm9ybWVyVXRpbC5jcmVhdGVTaW5nbGVMaW5lQ29tbWVudChcbiAgICAgICAgICAgICAgaWZhY2UsICdXQVJOSU5HOiBpbnRlcmZhY2UgaGFzIGJvdGggYSB0eXBlIGFuZCBhIHZhbHVlLCBza2lwcGluZyBlbWl0JyldO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFncyA9IG1vZHVsZVR5cGVUcmFuc2xhdG9yLmdldEpTRG9jKGlmYWNlLCAvKiByZXBvcnRXYXJuaW5ncyAqLyB0cnVlKSB8fCBbXTtcbiAgICAgICAgdGFncy5wdXNoKHt0YWdOYW1lOiAncmVjb3JkJ30pO1xuICAgICAgICBtYXliZUFkZFRlbXBsYXRlQ2xhdXNlKHRhZ3MsIGlmYWNlKTtcbiAgICAgICAgaWYgKCFob3N0LnVudHlwZWQpIHtcbiAgICAgICAgICBtYXliZUFkZEhlcml0YWdlQ2xhdXNlcyh0YWdzLCBtb2R1bGVUeXBlVHJhbnNsYXRvciwgaWZhY2UpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0cmFuc2Zvcm1lclV0aWwuZ2V0SWRlbnRpZmllclRleHQoaWZhY2UubmFtZSk7XG4gICAgICAgIGNvbnN0IG1vZGlmaWVycyA9IHRyYW5zZm9ybWVyVXRpbC5oYXNNb2RpZmllckZsYWcoaWZhY2UsIHRzLk1vZGlmaWVyRmxhZ3MuRXhwb3J0KSA/XG4gICAgICAgICAgICBbdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5FeHBvcnRLZXl3b3JkKV0gOlxuICAgICAgICAgICAgdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBkZWNsID0gdHMuc2V0U291cmNlTWFwUmFuZ2UoXG4gICAgICAgICAgICB0cy5jcmVhdGVGdW5jdGlvbkRlY2xhcmF0aW9uKFxuICAgICAgICAgICAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIG1vZGlmaWVycyxcbiAgICAgICAgICAgICAgICAvKiBhc3RlcmlzayAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICAvKiB0eXBlUGFyYW1ldGVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgLyogcGFyYW1ldGVycyAqL1tdLFxuICAgICAgICAgICAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIC8qIGJvZHkgKi8gdHMuY3JlYXRlQmxvY2soW10pLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICBpZmFjZSk7XG4gICAgICAgIGFkZENvbW1lbnRPbihkZWNsLCB0YWdzKTtcbiAgICAgICAgY29uc3QgbWVtYmVyRGVjbCA9IGNyZWF0ZU1lbWJlclR5cGVEZWNsYXJhdGlvbihtb2R1bGVUeXBlVHJhbnNsYXRvciwgaWZhY2UpO1xuICAgICAgICByZXR1cm4gbWVtYmVyRGVjbCA/IFtkZWNsLCBtZW1iZXJEZWNsXSA6IFtkZWNsXTtcbiAgICAgIH1cblxuICAgICAgLyoqIEZ1bmN0aW9uIGRlY2xhcmF0aW9ucyBhcmUgZW1pdHRlZCBhcyB0aGV5IGFyZSwgd2l0aCBvbmx5IEpTRG9jIGFkZGVkLiAqL1xuICAgICAgZnVuY3Rpb24gdmlzaXRGdW5jdGlvbkxpa2VEZWNsYXJhdGlvbjxUIGV4dGVuZHMgdHMuRnVuY3Rpb25MaWtlRGVjbGFyYXRpb24+KGZuRGVjbDogVCk6IFQge1xuICAgICAgICBpZiAoIWZuRGVjbC5ib2R5KSB7XG4gICAgICAgICAgLy8gVHdvIGNhc2VzOiBhYnN0cmFjdCBtZXRob2RzIGFuZCBvdmVybG9hZGVkIG1ldGhvZHMvZnVuY3Rpb25zLlxuICAgICAgICAgIC8vIEFic3RyYWN0IG1ldGhvZHMgYXJlIGhhbmRsZWQgaW4gZW1pdFR5cGVBbm5vdGF0aW9uc0hhbmRsZXIuXG4gICAgICAgICAgLy8gT3ZlcmxvYWRzIGFyZSB1bmlvbi1pemVkIGludG8gdGhlIHNoYXJlZCB0eXBlIGluIEZ1bmN0aW9uVHlwZS5cbiAgICAgICAgICByZXR1cm4gdHMudmlzaXRFYWNoQ2hpbGQoZm5EZWNsLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBleHRyYVRhZ3MgPSBbXTtcbiAgICAgICAgaWYgKGhhc0V4cG9ydGluZ0RlY29yYXRvcihmbkRlY2wsIHR5cGVDaGVja2VyKSkgZXh0cmFUYWdzLnB1c2goe3RhZ05hbWU6ICdleHBvcnQnfSk7XG5cbiAgICAgICAgY29uc3Qge3RhZ3MsIHRoaXNSZXR1cm5UeXBlfSA9XG4gICAgICAgICAgICBtb2R1bGVUeXBlVHJhbnNsYXRvci5nZXRGdW5jdGlvblR5cGVKU0RvYyhbZm5EZWNsXSwgZXh0cmFUYWdzKTtcbiAgICAgICAgY29uc3QgbWpzZG9jID0gbW9kdWxlVHlwZVRyYW5zbGF0b3IuZ2V0TXV0YWJsZUpTRG9jKGZuRGVjbCk7XG4gICAgICAgIG1qc2RvYy50YWdzID0gdGFncztcbiAgICAgICAgbWpzZG9jLnVwZGF0ZUNvbW1lbnQoKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0VGhpc1R5cGVCYWNrdXAgPSBjb250ZXh0VGhpc1R5cGU7XG4gICAgICAgIC8vIEFycm93IGZ1bmN0aW9ucyByZXRhaW4gdGhlaXIgY29udGV4dCBgdGhpc2AgdHlwZS4gQWxsIG90aGVycyByZXNldCB0aGUgdGhpcyB0eXBlIHRvXG4gICAgICAgIC8vIGVpdGhlciBub25lIChpZiBub3Qgc3BlY2lmaWVkKSBvciB0aGUgdHlwZSBnaXZlbiBpbiBhIGZuKHRoaXM6IFQsIC4uLikgZGVjbGFyYXRpb24uXG4gICAgICAgIGlmICghdHMuaXNBcnJvd0Z1bmN0aW9uKGZuRGVjbCkpIGNvbnRleHRUaGlzVHlwZSA9IHRoaXNSZXR1cm5UeXBlO1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0cy52aXNpdEVhY2hDaGlsZChmbkRlY2wsIHZpc2l0b3IsIGNvbnRleHQpO1xuICAgICAgICBjb250ZXh0VGhpc1R5cGUgPSBjb250ZXh0VGhpc1R5cGVCYWNrdXA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogSW4gbWV0aG9kcyB3aXRoIGEgdGVtcGxhdGVkIHRoaXMgdHlwZSwgYWRkcyBleHBsaWNpdCBjYXN0cyB0byBhY2Nlc3NlcyBvbiB0aGlzLlxuICAgICAgICpcbiAgICAgICAqIEBzZWUgY29udGV4dFRoaXNUeXBlXG4gICAgICAgKi9cbiAgICAgIGZ1bmN0aW9uIHZpc2l0VGhpc0V4cHJlc3Npb24obm9kZTogdHMuVGhpc0V4cHJlc3Npb24pIHtcbiAgICAgICAgaWYgKCFjb250ZXh0VGhpc1R5cGUpIHJldHVybiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUNsb3N1cmVDYXN0KG5vZGUsIG5vZGUsIGNvbnRleHRUaGlzVHlwZSk7XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogdmlzaXRWYXJpYWJsZVN0YXRlbWVudCBmbGF0dGVucyB2YXJpYWJsZSBkZWNsYXJhdGlvbiBsaXN0cyAoYHZhciBhLCBiO2AgdG8gYHZhciBhOyB2YXJcbiAgICAgICAqIGI7YCksIGFuZCBhdHRhY2hlcyBKU0RvYyBjb21tZW50cyB0byBlYWNoIHZhcmlhYmxlLiBKU0RvYyBjb21tZW50cyBwcmVjZWRpbmcgdGhlXG4gICAgICAgKiBvcmlnaW5hbCB2YXJpYWJsZSBhcmUgYXR0YWNoZWQgdG8gdGhlIGZpcnN0IG5ld2x5IGNyZWF0ZWQgb25lLlxuICAgICAgICovXG4gICAgICBmdW5jdGlvbiB2aXNpdFZhcmlhYmxlU3RhdGVtZW50KHZhclN0bXQ6IHRzLlZhcmlhYmxlU3RhdGVtZW50KTogdHMuU3RhdGVtZW50W10ge1xuICAgICAgICBjb25zdCBzdG10czogdHMuU3RhdGVtZW50W10gPSBbXTtcblxuICAgICAgICAvLyBcImNvbnN0XCIsIFwibGV0XCIsIGV0YyBhcmUgc3RvcmVkIGluIG5vZGUgZmxhZ3Mgb24gdGhlIGRlY2xhcmF0aW9uTGlzdC5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSB0cy5nZXRDb21iaW5lZE5vZGVGbGFncyh2YXJTdG10LmRlY2xhcmF0aW9uTGlzdCk7XG5cbiAgICAgICAgbGV0IHRhZ3M6IGpzZG9jLlRhZ1tdfG51bGwgPVxuICAgICAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IuZ2V0SlNEb2ModmFyU3RtdCwgLyogcmVwb3J0V2FybmluZ3MgKi8gdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGxlYWRpbmcgPSB0cy5nZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHModmFyU3RtdCk7XG4gICAgICAgIGlmIChsZWFkaW5nKSB7XG4gICAgICAgICAgLy8gQXR0YWNoIG5vbi1KU0RvYyBjb21tZW50cyB0byBhIG5vdCBlbWl0dGVkIHN0YXRlbWVudC5cbiAgICAgICAgICBjb25zdCBjb21tZW50SG9sZGVyID0gdHMuY3JlYXRlTm90RW1pdHRlZFN0YXRlbWVudCh2YXJTdG10KTtcbiAgICAgICAgICB0cy5zZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHMoY29tbWVudEhvbGRlciwgbGVhZGluZy5maWx0ZXIoYyA9PiBjLnRleHRbMF0gIT09ICcqJykpO1xuICAgICAgICAgIHN0bXRzLnB1c2goY29tbWVudEhvbGRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNsTGlzdCA9IHRzLnZpc2l0Tm9kZSh2YXJTdG10LmRlY2xhcmF0aW9uTGlzdCwgdmlzaXRvcik7XG4gICAgICAgIGZvciAoY29uc3QgZGVjbCBvZiBkZWNsTGlzdC5kZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgICBjb25zdCBsb2NhbFRhZ3M6IGpzZG9jLlRhZ1tdID0gW107XG4gICAgICAgICAgaWYgKHRhZ3MpIHtcbiAgICAgICAgICAgIC8vIEFkZCBhbnkgdGFncyBhbmQgZG9jcyBwcmVjZWRpbmcgdGhlIGVudGlyZSBzdGF0ZW1lbnQgdG8gdGhlIGZpcnN0IHZhcmlhYmxlLlxuICAgICAgICAgICAgbG9jYWxUYWdzLnB1c2goLi4udGFncyk7XG4gICAgICAgICAgICB0YWdzID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gQWRkIGFuIEB0eXBlIGZvciBwbGFpbiBpZGVudGlmaWVycywgYnV0IG5vdCBmb3IgYmluZGluZ3MgcGF0dGVybnMgKGkuZS4gb2JqZWN0IG9yIGFycmF5XG4gICAgICAgICAgLy8gZGVzdHJ1Y3R1cmluZyAtIHRob3NlIGRvIG5vdCBoYXZlIGEgc3ludGF4IGluIENsb3N1cmUpIG9yIEBkZWZpbmVzLCB3aGljaCBhbHJlYWR5XG4gICAgICAgICAgLy8gZGVjbGFyZSB0aGVpciB0eXBlLlxuICAgICAgICAgIGlmICh0cy5pc0lkZW50aWZpZXIoZGVjbC5uYW1lKSkge1xuICAgICAgICAgICAgLy8gRm9yIHZhcmlhYmxlcyB0aGF0IGFyZSBpbml0aWFsaXplZCBhbmQgdXNlIGEgYmxhY2tsaXN0ZWQgdHlwZSwgZG8gbm90IGVtaXQgYSB0eXBlIGF0XG4gICAgICAgICAgICAvLyBhbGwuIENsb3N1cmUgQ29tcGlsZXIgbWlnaHQgYmUgYWJsZSB0byBpbmZlciBhIGJldHRlciB0eXBlIGZyb20gdGhlIGluaXRpYWxpemVyIHRoYW5cbiAgICAgICAgICAgIC8vIHRoZSBgP2AgdGhlIGNvZGUgYmVsb3cgd291bGQgZW1pdC5cbiAgICAgICAgICAgIC8vIFRPRE8obWFydGlucHJvYnN0KTogY29uc2lkZXIgZG9pbmcgdGhpcyBmb3IgYWxsIHR5cGVzIHRoYXQgZ2V0IGVtaXR0ZWQgYXMgPywgbm90IGp1c3RcbiAgICAgICAgICAgIC8vIGZvciBibGFja2xpc3RlZCBvbmVzLlxuICAgICAgICAgICAgY29uc3QgYmxhY2tMaXN0ZWRJbml0aWFsaXplZCA9XG4gICAgICAgICAgICAgICAgISFkZWNsLmluaXRpYWxpemVyICYmIG1vZHVsZVR5cGVUcmFuc2xhdG9yLmlzQmxhY2tMaXN0ZWQoZGVjbCk7XG4gICAgICAgICAgICBpZiAoIWJsYWNrTGlzdGVkSW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgLy8gZ2V0T3JpZ2luYWxOb2RlKGRlY2wpIGlzIHJlcXVpcmVkIGJlY2F1c2UgdGhlIHR5cGUgY2hlY2tlciBjYW5ub3QgdHlwZSBjaGVja1xuICAgICAgICAgICAgICAvLyBzeW50aGVzaXplZCBub2Rlcy5cbiAgICAgICAgICAgICAgY29uc3QgdHlwZVN0ciA9IG1vZHVsZVR5cGVUcmFuc2xhdG9yLnR5cGVUb0Nsb3N1cmUodHMuZ2V0T3JpZ2luYWxOb2RlKGRlY2wpKTtcbiAgICAgICAgICAgICAgLy8gSWYgQGRlZmluZSBpcyBwcmVzZW50IHRoZW4gYWRkIHRoZSB0eXBlIHRvIGl0LCByYXRoZXIgdGhhbiBhZGRpbmcgYSBub3JtYWwgQHR5cGUuXG4gICAgICAgICAgICAgIGNvbnN0IGRlZmluZVRhZyA9IGxvY2FsVGFncy5maW5kKCh7dGFnTmFtZX0pID0+IHRhZ05hbWUgPT09ICdkZWZpbmUnKTtcbiAgICAgICAgICAgICAgaWYgKGRlZmluZVRhZykge1xuICAgICAgICAgICAgICAgIGRlZmluZVRhZy50eXBlID0gdHlwZVN0cjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2NhbFRhZ3MucHVzaCh7dGFnTmFtZTogJ3R5cGUnLCB0eXBlOiB0eXBlU3RyfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgbmV3U3RtdCA9IHRzLmNyZWF0ZVZhcmlhYmxlU3RhdGVtZW50KFxuICAgICAgICAgICAgICB2YXJTdG10Lm1vZGlmaWVycywgdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbkxpc3QoW2RlY2xdLCBmbGFncykpO1xuICAgICAgICAgIGlmIChsb2NhbFRhZ3MubGVuZ3RoKSBhZGRDb21tZW50T24obmV3U3RtdCwgbG9jYWxUYWdzLCBqc2RvYy5UQUdTX0NPTkZMSUNUSU5HX1dJVEhfVFlQRSk7XG4gICAgICAgICAgc3RtdHMucHVzaChuZXdTdG10KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdG10cztcbiAgICAgIH1cblxuICAgICAgLyoqXG4gICAgICAgKiBzaG91bGRFbWl0RXhwb3J0c0Fzc2lnbm1lbnRzIHJldHVybnMgdHJ1ZSBpZiB0c2lja2xlIHNob3VsZCBlbWl0IGBleHBvcnRzLkZvbyA9IC4uLmAgc3R5bGVcbiAgICAgICAqIGV4cG9ydCBzdGF0ZW1lbnRzLlxuICAgICAgICpcbiAgICAgICAqIFR5cGVTY3JpcHQgbW9kdWxlcyBjYW4gZXhwb3J0IHR5cGVzLiBCZWNhdXNlIHR5cGVzIGFyZSBwdXJlIGRlc2lnbi10aW1lIGNvbnN0cnVjdHMgaW5cbiAgICAgICAqIFR5cGVTY3JpcHQsIGl0IGRvZXMgbm90IGVtaXQgYW55IGFjdHVhbCBleHBvcnRlZCBzeW1ib2xzIGZvciB0aGVzZS4gQnV0IHRzaWNrbGUgaGFzIHRvIGVtaXRcbiAgICAgICAqIGFuIGV4cG9ydCwgc28gdGhhdCBkb3duc3RyZWFtIENsb3N1cmUgY29kZSAoaW5jbHVkaW5nIHRzaWNrbGUtY29udmVydGVkIENsb3N1cmUgY29kZSkgY2FuXG4gICAgICAgKiBpbXBvcnQgdXBzdHJlYW0gdHlwZXMuIHRzaWNrbGUgaGFzIHRvIHBpY2sgYSBtb2R1bGUgZm9ybWF0IGZvciB0aGF0LCBiZWNhdXNlIHRoZSBwdXJlIEVTNlxuICAgICAgICogZXhwb3J0IHdvdWxkIGdldCBzdHJpcHBlZCBieSBUeXBlU2NyaXB0LlxuICAgICAgICpcbiAgICAgICAqIHRzaWNrbGUgdXNlcyBDb21tb25KUyB0byBlbWl0IGdvb2dtb2R1bGUsIGFuZCBjb2RlIG5vdCB1c2luZyBnb29nbW9kdWxlIGRvZXNuJ3QgY2FyZSBhYm91dFxuICAgICAgICogdGhlIENsb3N1cmUgYW5ub3RhdGlvbnMgYW55d2F5LCBzbyB0c2lja2xlIHNraXBzIGVtaXR0aW5nIGV4cG9ydHMgaWYgdGhlIG1vZHVsZSB0YXJnZXRcbiAgICAgICAqIGlzbid0IGNvbW1vbmpzLlxuICAgICAgICovXG4gICAgICBmdW5jdGlvbiBzaG91bGRFbWl0RXhwb3J0c0Fzc2lnbm1lbnRzKCkge1xuICAgICAgICByZXR1cm4gdHNPcHRpb25zLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5Db21tb25KUztcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdmlzaXRUeXBlQWxpYXNEZWNsYXJhdGlvbih0eXBlQWxpYXM6IHRzLlR5cGVBbGlhc0RlY2xhcmF0aW9uKTogdHMuU3RhdGVtZW50W10ge1xuICAgICAgICAvLyBJZiB0aGUgdHlwZSBpcyBhbHNvIGRlZmluZWQgYXMgYSB2YWx1ZSwgc2tpcCBlbWl0dGluZyBpdC4gQ2xvc3VyZSBjb2xsYXBzZXMgdHlwZSAmIHZhbHVlXG4gICAgICAgIC8vIG5hbWVzcGFjZXMsIHRoZSB0d28gZW1pdHMgd291bGQgY29uZmxpY3QgaWYgdHNpY2tsZSBlbWl0dGVkIGJvdGguXG4gICAgICAgIGNvbnN0IHN5bSA9IG1vZHVsZVR5cGVUcmFuc2xhdG9yLm11c3RHZXRTeW1ib2xBdExvY2F0aW9uKHR5cGVBbGlhcy5uYW1lKTtcbiAgICAgICAgaWYgKHN5bS5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLlZhbHVlKSByZXR1cm4gW107XG4gICAgICAgIC8vIFR5cGUgYWxpYXNlcyBhcmUgYWx3YXlzIGVtaXR0ZWQgYXMgdGhlIHJlc29sdmVkIHVuZGVybHlpbmcgdHlwZSwgc28gdGhlcmUgaXMgbm8gbmVlZCB0b1xuICAgICAgICAvLyBlbWl0IGFueXRoaW5nLCBleGNlcHQgZm9yIGV4cG9ydGVkIHR5cGVzLlxuICAgICAgICBpZiAoIXRyYW5zZm9ybWVyVXRpbC5oYXNNb2RpZmllckZsYWcodHlwZUFsaWFzLCB0cy5Nb2RpZmllckZsYWdzLkV4cG9ydCkpIHJldHVybiBbXTtcbiAgICAgICAgaWYgKCFzaG91bGRFbWl0RXhwb3J0c0Fzc2lnbm1lbnRzKCkpIHJldHVybiBbXTtcblxuICAgICAgICBjb25zdCB0eXBlTmFtZSA9IHR5cGVBbGlhcy5uYW1lLmdldFRleHQoKTtcblxuICAgICAgICAvLyBCbGFja2xpc3QgYW55IHR5cGUgcGFyYW1ldGVycywgQ2xvc3VyZSBkb2VzIG5vdCBzdXBwb3J0IHR5cGUgYWxpYXNlcyB3aXRoIHR5cGVcbiAgICAgICAgLy8gcGFyYW1ldGVycy5cbiAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IubmV3VHlwZVRyYW5zbGF0b3IodHlwZUFsaWFzKS5ibGFja2xpc3RUeXBlUGFyYW1ldGVycyhcbiAgICAgICAgICAgIG1vZHVsZVR5cGVUcmFuc2xhdG9yLnN5bWJvbHNUb0FsaWFzZWROYW1lcywgdHlwZUFsaWFzLnR5cGVQYXJhbWV0ZXJzKTtcbiAgICAgICAgY29uc3QgdHlwZVN0ciA9XG4gICAgICAgICAgICBob3N0LnVudHlwZWQgPyAnPycgOiBtb2R1bGVUeXBlVHJhbnNsYXRvci50eXBlVG9DbG9zdXJlKHR5cGVBbGlhcywgdW5kZWZpbmVkKTtcbiAgICAgICAgLy8gSW4gdGhlIGNhc2Ugb2YgYW4gZXhwb3J0LCB3ZSBjYW5ub3QgZW1pdCBhIGBleHBvcnQgdmFyIGZvbztgIGJlY2F1c2UgVHlwZVNjcmlwdCBkcm9wc1xuICAgICAgICAvLyBleHBvcnRzIHRoYXQgYXJlIG5ldmVyIGFzc2lnbmVkIHZhbHVlcywgYW5kIENsb3N1cmUgcmVxdWlyZXMgdXMgdG8gbm90IGFzc2lnbiB2YWx1ZXMgdG9cbiAgICAgICAgLy8gdHlwZWRlZiBleHBvcnRzLiBJbnRyb2R1Y2luZyBhIG5ldyBsb2NhbCB2YXJpYWJsZSBhbmQgZXhwb3J0aW5nIGl0IGNhbiBjYXVzZSBidWdzIGR1ZSB0b1xuICAgICAgICAvLyBuYW1lIHNoYWRvd2luZyBhbmQgY29uZnVzaW5nIFR5cGVTY3JpcHQncyBsb2dpYyBvbiB3aGF0IHN5bWJvbHMgYW5kIHR5cGVzIHZzIHZhbHVlcyBhcmVcbiAgICAgICAgLy8gZXhwb3J0ZWQuIE1hbmdsaW5nIHRoZSBuYW1lIHRvIGF2b2lkIHRoZSBjb25mbGljdHMgd291bGQgYmUgcmVhc29uYWJseSBjbGVhbiwgYnV0IHdvdWxkXG4gICAgICAgIC8vIHJlcXVpcmUgYSB0d28gcGFzcyBlbWl0IHRvIGZpcnN0IGZpbmQgYWxsIHR5cGUgYWxpYXMgbmFtZXMsIG1hbmdsZSB0aGVtLCBhbmQgZW1pdCB0aGUgdXNlXG4gICAgICAgIC8vIHNpdGVzIG9ubHkgbGF0ZXIuIFdpdGggdGhhdCwgdGhlIGZpeCBoZXJlIGlzIHRvIG5ldmVyIGVtaXQgdHlwZSBhbGlhc2VzLCBidXQgYWx3YXlzXG4gICAgICAgIC8vIHJlc29sdmUgdGhlIGFsaWFzIGFuZCBlbWl0IHRoZSB1bmRlcmx5aW5nIHR5cGUgKGZpeGluZyByZWZlcmVuY2VzIGluIHRoZSBsb2NhbCBtb2R1bGUsXG4gICAgICAgIC8vIGFuZCBhbHNvIGFjcm9zcyBtb2R1bGVzKS4gRm9yIGRvd25zdHJlYW0gSmF2YVNjcmlwdCBjb2RlIHRoYXQgaW1wb3J0cyB0aGUgdHlwZWRlZiwgd2VcbiAgICAgICAgLy8gZW1pdCBhbiBcImV4cG9ydC5Gb287XCIgdGhhdCBkZWNsYXJlcyBhbmQgZXhwb3J0cyB0aGUgdHlwZSwgYW5kIGZvciBUeXBlU2NyaXB0IGhhcyBub1xuICAgICAgICAvLyBpbXBhY3QuXG4gICAgICAgIGNvbnN0IHRhZ3MgPSBtb2R1bGVUeXBlVHJhbnNsYXRvci5nZXRKU0RvYyh0eXBlQWxpYXMsIC8qIHJlcG9ydFdhcm5pbmdzICovIHRydWUpO1xuICAgICAgICB0YWdzLnB1c2goe3RhZ05hbWU6ICd0eXBlZGVmJywgdHlwZTogdHlwZVN0cn0pO1xuICAgICAgICBjb25zdCBkZWNsID0gdHMuc2V0U291cmNlTWFwUmFuZ2UoXG4gICAgICAgICAgICB0cy5jcmVhdGVTdGF0ZW1lbnQodHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoXG4gICAgICAgICAgICAgICAgdHMuY3JlYXRlSWRlbnRpZmllcignZXhwb3J0cycpLCB0cy5jcmVhdGVJZGVudGlmaWVyKHR5cGVOYW1lKSkpLFxuICAgICAgICAgICAgdHlwZUFsaWFzKTtcbiAgICAgICAgYWRkQ29tbWVudE9uKGRlY2wsIHRhZ3MsIGpzZG9jLlRBR1NfQ09ORkxJQ1RJTkdfV0lUSF9UWVBFKTtcbiAgICAgICAgcmV0dXJuIFtkZWNsXTtcbiAgICAgIH1cblxuICAgICAgLyoqIEVtaXRzIGEgcGFyZW50aGVzaXplZCBDbG9zdXJlIGNhc3Q6IGAoLyoqIFxcQHR5cGUgLi4uICogLyAoZXhwcikpYC4gKi9cbiAgICAgIGZ1bmN0aW9uIGNyZWF0ZUNsb3N1cmVDYXN0KGNvbnRleHQ6IHRzLk5vZGUsIGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24sIHR5cGU6IHRzLlR5cGUpIHtcbiAgICAgICAgY29uc3QgaW5uZXIgPSB0cy5jcmVhdGVQYXJlbihleHByZXNzaW9uKTtcbiAgICAgICAgY29uc3QgY29tbWVudCA9IGFkZENvbW1lbnRPbihcbiAgICAgICAgICAgIGlubmVyLCBbe3RhZ05hbWU6ICd0eXBlJywgdHlwZTogbW9kdWxlVHlwZVRyYW5zbGF0b3IudHlwZVRvQ2xvc3VyZShjb250ZXh0LCB0eXBlKX1dKTtcbiAgICAgICAgY29tbWVudC5oYXNUcmFpbGluZ05ld0xpbmUgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRzLnNldFNvdXJjZU1hcFJhbmdlKHRzLmNyZWF0ZVBhcmVuKGlubmVyKSwgY29udGV4dCk7XG4gICAgICB9XG5cbiAgICAgIC8qKiBDb252ZXJ0cyBhIFR5cGVTY3JpcHQgdHlwZSBhc3NlcnRpb24gaW50byBhIENsb3N1cmUgQ2FzdC4gKi9cbiAgICAgIGZ1bmN0aW9uIHZpc2l0QXNzZXJ0aW9uRXhwcmVzc2lvbihhc3NlcnRpb246IHRzLkFzc2VydGlvbkV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3QgdHlwZSA9IHR5cGVDaGVja2VyLmdldFR5cGVBdExvY2F0aW9uKGFzc2VydGlvbi50eXBlKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUNsb3N1cmVDYXN0KGFzc2VydGlvbiwgdHMudmlzaXRFYWNoQ2hpbGQoYXNzZXJ0aW9uLCB2aXNpdG9yLCBjb250ZXh0KSwgdHlwZSk7XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogQ29udmVydHMgYSBUeXBlU2NyaXB0IG5vbi1udWxsIGFzc2VydGlvbiBpbnRvIGEgQ2xvc3VyZSBDYXN0LCBieSBzdHJpcHBpbmcgfG51bGwgYW5kXG4gICAgICAgKiB8dW5kZWZpbmVkIGZyb20gYSB1bmlvbiB0eXBlLlxuICAgICAgICovXG4gICAgICBmdW5jdGlvbiB2aXNpdE5vbk51bGxFeHByZXNzaW9uKG5vbk51bGw6IHRzLk5vbk51bGxFeHByZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSB0eXBlQ2hlY2tlci5nZXRUeXBlQXRMb2NhdGlvbihub25OdWxsLmV4cHJlc3Npb24pO1xuICAgICAgICBjb25zdCBub25OdWxsVHlwZSA9IHR5cGVDaGVja2VyLmdldE5vbk51bGxhYmxlVHlwZSh0eXBlKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUNsb3N1cmVDYXN0KFxuICAgICAgICAgICAgbm9uTnVsbCwgdHMudmlzaXRFYWNoQ2hpbGQobm9uTnVsbCwgdmlzaXRvciwgY29udGV4dCksIG5vbk51bGxUeXBlKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdmlzaXRJbXBvcnREZWNsYXJhdGlvbihpbXBvcnREZWNsOiB0cy5JbXBvcnREZWNsYXJhdGlvbikge1xuICAgICAgICAvLyBGb3IgZWFjaCBpbXBvcnQsIGluc2VydCBhIGdvb2cucmVxdWlyZVR5cGUgZm9yIHRoZSBtb2R1bGUsIHNvIHRoYXQgaWYgVHlwZVNjcmlwdCBkb2VzIG5vdFxuICAgICAgICAvLyBlbWl0IHRoZSBtb2R1bGUgYmVjYXVzZSBpdCdzIG9ubHkgdXNlZCBpbiB0eXBlIHBvc2l0aW9ucywgdGhlIEpTRG9jIGNvbW1lbnRzIHN0aWxsXG4gICAgICAgIC8vIHJlZmVyZW5jZSBhIHZhbGlkIENsb3N1cmUgbGV2ZWwgc3ltYm9sLlxuXG4gICAgICAgIC8vIE5vIG5lZWQgdG8gcmVxdWlyZVR5cGUgc2lkZSBlZmZlY3QgaW1wb3J0cy5cbiAgICAgICAgaWYgKCFpbXBvcnREZWNsLmltcG9ydENsYXVzZSkgcmV0dXJuIGltcG9ydERlY2w7XG5cbiAgICAgICAgY29uc3Qgc3ltID0gdHlwZUNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihpbXBvcnREZWNsLm1vZHVsZVNwZWNpZmllcik7XG4gICAgICAgIC8vIFNjcmlwdHMgZG8gbm90IGhhdmUgYSBzeW1ib2wsIGFuZCBuZWl0aGVyIGRvIHVudXNlZCBtb2R1bGVzLiBTY3JpcHRzIGNhbiBzdGlsbCBiZVxuICAgICAgICAvLyBpbXBvcnRlZCwgZWl0aGVyIGFzIHNpZGUgZWZmZWN0IGltcG9ydHMgb3Igd2l0aCBhbiBlbXB0eSBpbXBvcnQgc2V0IChcInt9XCIpLiBUeXBlU2NyaXB0XG4gICAgICAgIC8vIGRvZXMgbm90IGVtaXQgYSBydW50aW1lIGxvYWQgZm9yIGFuIGltcG9ydCB3aXRoIGFuIGVtcHR5IGxpc3Qgb2Ygc3ltYm9scywgYnV0IHRoZSBpbXBvcnRcbiAgICAgICAgLy8gZm9yY2VzIGFueSBnbG9iYWwgZGVjbGFyYXRpb25zIGZyb20gdGhlIGxpYnJhcnkgdG8gYmUgdmlzaWJsZSwgd2hpY2ggaXMgd2hhdCB1c2VycyB1c2VcbiAgICAgICAgLy8gdGhpcyBmb3IuIE5vIHN5bWJvbHMgZnJvbSB0aGUgc2NyaXB0IG5lZWQgcmVxdWlyZVR5cGUsIHNvIGp1c3QgcmV0dXJuLlxuICAgICAgICAvLyBUT0RPKGV2bWFyKTogcmV2aXNpdCB0aGlzLiAgSWYgVFMgbmVlZHMgdG8gc2VlIHRoZSBtb2R1bGUgaW1wb3J0LCBpdCdzIGxpa2VseSBDbG9zdXJlXG4gICAgICAgIC8vIGRvZXMgdG9vLlxuICAgICAgICBpZiAoIXN5bSkgcmV0dXJuIGltcG9ydERlY2w7XG5cbiAgICAgICAgY29uc3QgaW1wb3J0UGF0aCA9IGdvb2dtb2R1bGUucmVzb2x2ZU1vZHVsZU5hbWUoXG4gICAgICAgICAgICB7b3B0aW9uczogdHNPcHRpb25zLCBtb2R1bGVSZXNvbHV0aW9uSG9zdH0sIHNvdXJjZUZpbGUuZmlsZU5hbWUsXG4gICAgICAgICAgICAoaW1wb3J0RGVjbC5tb2R1bGVTcGVjaWZpZXIgYXMgdHMuU3RyaW5nTGl0ZXJhbCkudGV4dCk7XG5cbiAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IucmVxdWlyZVR5cGUoXG4gICAgICAgICAgICBpbXBvcnRQYXRoLCBzeW0sXG4gICAgICAgICAgICAvKiBkZWZhdWx0IGltcG9ydD8gKi8gISFpbXBvcnREZWNsLmltcG9ydENsYXVzZS5uYW1lKTtcbiAgICAgICAgcmV0dXJuIGltcG9ydERlY2w7XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogQ2xvc3VyZSBDb21waWxlciB3aWxsIGZhaWwgd2hlbiBpdCBmaW5kcyBpbmNvcnJlY3QgSlNEb2MgdGFncyBvbiBub2Rlcy4gVGhpcyBmdW5jdGlvblxuICAgICAgICogcGFyc2VzIGFuZCB0aGVuIHJlLXNlcmlhbGl6ZXMgSlNEb2MgY29tbWVudHMsIGVzY2FwaW5nIG9yIHJlbW92aW5nIGlsbGVnYWwgdGFncy5cbiAgICAgICAqL1xuICAgICAgZnVuY3Rpb24gZXNjYXBlSWxsZWdhbEpTRG9jKG5vZGU6IHRzLk5vZGUpIHtcbiAgICAgICAgY29uc3QgbWpzZG9jID0gbW9kdWxlVHlwZVRyYW5zbGF0b3IuZ2V0TXV0YWJsZUpTRG9jKG5vZGUpO1xuICAgICAgICBtanNkb2MudXBkYXRlQ29tbWVudCgpO1xuICAgICAgfVxuXG4gICAgICAvKiogUmV0dXJucyB0cnVlIGlmIGEgdmFsdWUgZXhwb3J0IHNob3VsZCBiZSBlbWl0dGVkIGZvciB0aGUgZ2l2ZW4gc3ltYm9sIGluIGV4cG9ydCAqLiAqL1xuICAgICAgZnVuY3Rpb24gc2hvdWxkRW1pdFZhbHVlRXhwb3J0Rm9yU3ltYm9sKHN5bTogdHMuU3ltYm9sKTogYm9vbGVhbiB7XG4gICAgICAgIGlmIChzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgICAgIHN5bSA9IHR5cGVDaGVja2VyLmdldEFsaWFzZWRTeW1ib2woc3ltKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKHN5bS5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLlZhbHVlKSA9PT0gMCkge1xuICAgICAgICAgIC8vIE5vdGU6IFdlIGNyZWF0ZSBleHBsaWNpdCBleHBvcnRzIG9mIHR5cGUgc3ltYm9scyBmb3IgY2xvc3VyZSBpbiB2aXNpdEV4cG9ydERlY2xhcmF0aW9uLlxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRzT3B0aW9ucy5wcmVzZXJ2ZUNvbnN0RW51bXMgJiYgc3ltLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQ29uc3RFbnVtKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvKipcbiAgICAgICAqIHZpc2l0RXhwb3J0RGVjbGFyYXRpb24gcmVxdWlyZVR5cGVzIGV4cG9ydGVkIG1vZHVsZXMgYW5kIGVtaXRzIGV4cGxpY2l0IGV4cG9ydHMgZm9yXG4gICAgICAgKiB0eXBlcyAod2hpY2ggbm9ybWFsbHkgZG8gbm90IGdldCBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQpLlxuICAgICAgICovXG4gICAgICBmdW5jdGlvbiB2aXNpdEV4cG9ydERlY2xhcmF0aW9uKGV4cG9ydERlY2w6IHRzLkV4cG9ydERlY2xhcmF0aW9uKTogdHMuTm9kZXx0cy5Ob2RlW10ge1xuICAgICAgICBjb25zdCBpbXBvcnRlZE1vZHVsZVN5bWJvbCA9IGV4cG9ydERlY2wubW9kdWxlU3BlY2lmaWVyICYmXG4gICAgICAgICAgICB0eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGV4cG9ydERlY2wubW9kdWxlU3BlY2lmaWVyKSE7XG4gICAgICAgIGlmIChpbXBvcnRlZE1vZHVsZVN5bWJvbCkge1xuICAgICAgICAgIC8vIHJlcXVpcmVUeXBlIGFsbCBleHBsaWNpdGx5IGltcG9ydGVkIG1vZHVsZXMsIHNvIHRoYXQgc3ltYm9scyBjYW4gYmUgcmVmZXJlbmNlZCBhbmRcbiAgICAgICAgICAvLyB0eXBlIG9ubHkgbW9kdWxlcyBhcmUgdXNhYmxlIGZyb20gdHlwZSBkZWNsYXJhdGlvbnMuXG4gICAgICAgICAgbW9kdWxlVHlwZVRyYW5zbGF0b3IucmVxdWlyZVR5cGUoXG4gICAgICAgICAgICAgIChleHBvcnREZWNsLm1vZHVsZVNwZWNpZmllciBhcyB0cy5TdHJpbmdMaXRlcmFsKS50ZXh0LCBpbXBvcnRlZE1vZHVsZVN5bWJvbCxcbiAgICAgICAgICAgICAgLyogZGVmYXVsdCBpbXBvcnQ/ICovIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHR5cGVzVG9FeHBvcnQ6IEFycmF5PFtzdHJpbmcsIHRzLlN5bWJvbF0+ID0gW107XG4gICAgICAgIGlmICghZXhwb3J0RGVjbC5leHBvcnRDbGF1c2UpIHtcbiAgICAgICAgICAvLyBleHBvcnQgKiBmcm9tICcuLi4nXG4gICAgICAgICAgLy8gUmVzb2x2ZSB0aGUgKiBpbnRvIGFsbCB2YWx1ZSBzeW1ib2xzIGV4cG9ydGVkLCBhbmQgdXBkYXRlIHRoZSBleHBvcnQgZGVjbGFyYXRpb24uXG5cbiAgICAgICAgICAvLyBFeHBsaWNpdGx5IHNwZWxsZWQgb3V0IGV4cG9ydHMgKGkuZS4gdGhlIGV4cG9ydHMgb2YgdGhlIGN1cnJlbnQgbW9kdWxlKSB0YWtlIHByZWNlZGVuY2VcbiAgICAgICAgICAvLyBvdmVyIGltcGxpY2l0IG9uZXMgZnJvbSBleHBvcnQgKi4gVXNlIHRoZSBjdXJyZW50IG1vZHVsZSdzIGV4cG9ydHMgdG8gZmlsdGVyLlxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRNb2R1bGVTeW1ib2wgPSB0eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHNvdXJjZUZpbGUpO1xuICAgICAgICAgIGNvbnN0IGN1cnJlbnRNb2R1bGVFeHBvcnRzID0gY3VycmVudE1vZHVsZVN5bWJvbCAmJiBjdXJyZW50TW9kdWxlU3ltYm9sLmV4cG9ydHM7XG5cbiAgICAgICAgICBpZiAoIWltcG9ydGVkTW9kdWxlU3ltYm9sKSB7XG4gICAgICAgICAgICBtb2R1bGVUeXBlVHJhbnNsYXRvci5lcnJvcihleHBvcnREZWNsLCBgZXhwb3J0ICogd2l0aG91dCBtb2R1bGUgc3ltYm9sYCk7XG4gICAgICAgICAgICByZXR1cm4gZXhwb3J0RGVjbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZXhwb3J0ZWRTeW1ib2xzID0gdHlwZUNoZWNrZXIuZ2V0RXhwb3J0c09mTW9kdWxlKGltcG9ydGVkTW9kdWxlU3ltYm9sKTtcbiAgICAgICAgICBjb25zdCBleHBvcnRTcGVjaWZpZXJzOiB0cy5FeHBvcnRTcGVjaWZpZXJbXSA9IFtdO1xuICAgICAgICAgIGZvciAoY29uc3Qgc3ltIG9mIGV4cG9ydGVkU3ltYm9scykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2R1bGVFeHBvcnRzICYmIGN1cnJlbnRNb2R1bGVFeHBvcnRzLmhhcyhzeW0uZXNjYXBlZE5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgIC8vIFdlIG1pZ2h0IGhhdmUgYWxyZWFkeSBnZW5lcmF0ZWQgYW4gZXhwb3J0IGZvciB0aGUgZ2l2ZW4gc3ltYm9sLlxuICAgICAgICAgICAgaWYgKGV4cGFuZGVkU3RhckltcG9ydHMuaGFzKHN5bS5uYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICBleHBhbmRlZFN0YXJJbXBvcnRzLmFkZChzeW0ubmFtZSk7XG4gICAgICAgICAgICAvLyBPbmx5IGNyZWF0ZSBhbiBleHBvcnQgc3BlY2lmaWVyIGZvciB2YWx1ZXMgdGhhdCBhcmUgZXhwb3J0ZWQuIEZvciB0eXBlcywgdGhlIGNvZGVcbiAgICAgICAgICAgIC8vIGJlbG93IGNyZWF0ZXMgc3BlY2lmaWMgZXhwb3J0IHN0YXRlbWVudHMgdGhhdCBtYXRjaCBDbG9zdXJlJ3MgZXhwZWN0YXRpb25zLlxuICAgICAgICAgICAgaWYgKHNob3VsZEVtaXRWYWx1ZUV4cG9ydEZvclN5bWJvbChzeW0pKSB7XG4gICAgICAgICAgICAgIGV4cG9ydFNwZWNpZmllcnMucHVzaCh0cy5jcmVhdGVFeHBvcnRTcGVjaWZpZXIodW5kZWZpbmVkLCBzeW0ubmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdHlwZXNUb0V4cG9ydC5wdXNoKFtzeW0ubmFtZSwgc3ltXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGV4cG9ydERlY2wgPSB0cy51cGRhdGVFeHBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgZXhwb3J0RGVjbCwgZXhwb3J0RGVjbC5kZWNvcmF0b3JzLCBleHBvcnREZWNsLm1vZGlmaWVycyxcbiAgICAgICAgICAgICAgdHMuY3JlYXRlTmFtZWRFeHBvcnRzKGV4cG9ydFNwZWNpZmllcnMpLCBleHBvcnREZWNsLm1vZHVsZVNwZWNpZmllcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yIChjb25zdCBleHAgb2YgZXhwb3J0RGVjbC5leHBvcnRDbGF1c2UuZWxlbWVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4cG9ydGVkTmFtZSA9IHRyYW5zZm9ybWVyVXRpbC5nZXRJZGVudGlmaWVyVGV4dChleHAubmFtZSk7XG4gICAgICAgICAgICB0eXBlc1RvRXhwb3J0LnB1c2goXG4gICAgICAgICAgICAgICAgW2V4cG9ydGVkTmFtZSwgbW9kdWxlVHlwZVRyYW5zbGF0b3IubXVzdEdldFN5bWJvbEF0TG9jYXRpb24oZXhwLm5hbWUpXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIERvIG5vdCBlbWl0IHR5cGVkZWYgcmUtZXhwb3J0cyBpbiB1bnR5cGVkIG1vZGUuXG4gICAgICAgIGlmIChob3N0LnVudHlwZWQpIHJldHVybiBleHBvcnREZWNsO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdDogdHMuTm9kZVtdID0gW2V4cG9ydERlY2xdO1xuICAgICAgICBmb3IgKGNvbnN0IFtleHBvcnRlZE5hbWUsIHN5bV0gb2YgdHlwZXNUb0V4cG9ydCkge1xuICAgICAgICAgIGxldCBhbGlhc2VkU3ltYm9sID0gc3ltO1xuICAgICAgICAgIGlmIChzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgICAgICAgYWxpYXNlZFN5bWJvbCA9IHR5cGVDaGVja2VyLmdldEFsaWFzZWRTeW1ib2woc3ltKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgaXNUeXBlQWxpYXMgPSAoYWxpYXNlZFN5bWJvbC5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLlZhbHVlKSA9PT0gMCAmJlxuICAgICAgICAgICAgICAoYWxpYXNlZFN5bWJvbC5mbGFncyAmICh0cy5TeW1ib2xGbGFncy5UeXBlQWxpYXMgfCB0cy5TeW1ib2xGbGFncy5JbnRlcmZhY2UpKSAhPT0gMDtcbiAgICAgICAgICBpZiAoIWlzVHlwZUFsaWFzKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCB0eXBlTmFtZSA9XG4gICAgICAgICAgICAgIG1vZHVsZVR5cGVUcmFuc2xhdG9yLnN5bWJvbHNUb0FsaWFzZWROYW1lcy5nZXQoYWxpYXNlZFN5bWJvbCkgfHwgYWxpYXNlZFN5bWJvbC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHN0bXQgPSB0cy5jcmVhdGVTdGF0ZW1lbnQoXG4gICAgICAgICAgICAgIHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHRzLmNyZWF0ZUlkZW50aWZpZXIoJ2V4cG9ydHMnKSwgZXhwb3J0ZWROYW1lKSk7XG4gICAgICAgICAgYWRkQ29tbWVudE9uKHN0bXQsIFt7dGFnTmFtZTogJ3R5cGVkZWYnLCB0eXBlOiAnIScgKyB0eXBlTmFtZX1dKTtcbiAgICAgICAgICB0cy5hZGRTeW50aGV0aWNUcmFpbGluZ0NvbW1lbnQoXG4gICAgICAgICAgICAgIHN0bXQsIHRzLlN5bnRheEtpbmQuU2luZ2xlTGluZUNvbW1lbnRUcml2aWEsICcgcmUtZXhwb3J0IHR5cGVkZWYnLCB0cnVlKTtcbiAgICAgICAgICByZXN1bHQucHVzaChzdG10KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHVybnMgdGhlIGlkZW50aWZpZXJzIGV4cG9ydGVkIGluIGEgc2luZ2xlIGV4cG9ydGVkIHN0YXRlbWVudCAtIHR5cGljYWxseSBqdXN0IG9uZVxuICAgICAgICogaWRlbnRpZmllciAoZS5nLiBmb3IgYGV4cG9ydCBmdW5jdGlvbiBmb28oKWApLCBidXQgbXVsdGlwbGUgZm9yIGBleHBvcnQgZGVjbGFyZSB2YXIgYSwgYmAuXG4gICAgICAgKi9cbiAgICAgIGZ1bmN0aW9uIGdldEV4cG9ydERlY2xhcmF0aW9uTmFtZXMobm9kZTogdHMuTm9kZSk6IHRzLklkZW50aWZpZXJbXSB7XG4gICAgICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlZhcmlhYmxlU3RhdGVtZW50OlxuICAgICAgICAgICAgY29uc3QgdmFyRGVjbCA9IG5vZGUgYXMgdHMuVmFyaWFibGVTdGF0ZW1lbnQ7XG4gICAgICAgICAgICByZXR1cm4gdmFyRGVjbC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zLm1hcCgoZCkgPT4gZ2V0RXhwb3J0RGVjbGFyYXRpb25OYW1lcyhkKVswXSk7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlZhcmlhYmxlRGVjbGFyYXRpb246XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkZ1bmN0aW9uRGVjbGFyYXRpb246XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkludGVyZmFjZURlY2xhcmF0aW9uOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbGFzc0RlY2xhcmF0aW9uOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Nb2R1bGVEZWNsYXJhdGlvbjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRW51bURlY2xhcmF0aW9uOlxuICAgICAgICAgICAgY29uc3QgZGVjbCA9IG5vZGUgYXMgdHMuTmFtZWREZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIGlmICghZGVjbC5uYW1lIHx8IGRlY2wubmFtZS5raW5kICE9PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gW2RlY2wubmFtZV07XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlR5cGVBbGlhc0RlY2xhcmF0aW9uOlxuICAgICAgICAgICAgY29uc3QgdHlwZUFsaWFzID0gbm9kZSBhcyB0cy5UeXBlQWxpYXNEZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIHJldHVybiBbdHlwZUFsaWFzLm5hbWVdO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBtb2R1bGVUeXBlVHJhbnNsYXRvci5lcnJvcihcbiAgICAgICAgICAgIG5vZGUsIGB1bnN1cHBvcnRlZCBleHBvcnQgZGVjbGFyYXRpb24gJHt0cy5TeW50YXhLaW5kW25vZGUua2luZF19OiAke25vZGUuZ2V0VGV4dCgpfWApO1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogQW1iaWVudCBkZWNsYXJhdGlvbnMgZGVjbGFyZSB0eXBlcyBmb3IgVHlwZVNjcmlwdCdzIGJlbmVmaXQsIGFuZCB3aWxsIGJlIHJlbW92ZWRlIGJ5XG4gICAgICAgKiBUeXBlU2NyaXB0IGR1cmluZyBpdHMgZW1pdCBwaGFzZS4gRG93bnN0cmVhbSBDbG9zdXJlIGNvZGUgaG93ZXZlciBtaWdodCBiZSBpbXBvcnRpbmdcbiAgICAgICAqIHN5bWJvbHMgZnJvbSB0aGlzIG1vZHVsZSwgc28gdHNpY2tsZSBtdXN0IGVtaXQgYSBDbG9zdXJlLWNvbXBhdGlibGUgZXhwb3J0cyBkZWNsYXJhdGlvbi5cbiAgICAgICAqL1xuICAgICAgZnVuY3Rpb24gdmlzaXRFeHBvcnRlZEFtYmllbnQobm9kZTogdHMuTm9kZSk6IHRzLk5vZGVbXSB7XG4gICAgICAgIGlmIChob3N0LnVudHlwZWQgfHwgIXNob3VsZEVtaXRFeHBvcnRzQXNzaWdubWVudHMoKSkgcmV0dXJuIFtub2RlXTtcblxuICAgICAgICBjb25zdCBkZWNsTmFtZXMgPSBnZXRFeHBvcnREZWNsYXJhdGlvbk5hbWVzKG5vZGUpO1xuICAgICAgICBjb25zdCByZXN1bHQ6IHRzLk5vZGVbXSA9IFtub2RlXTtcbiAgICAgICAgZm9yIChjb25zdCBkZWNsIG9mIGRlY2xOYW1lcykge1xuICAgICAgICAgIGNvbnN0IHN5bSA9IHR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oZGVjbCkhO1xuICAgICAgICAgIGNvbnN0IGlzVmFsdWUgPSBzeW0uZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5WYWx1ZTtcbiAgICAgICAgICAvLyBOb24tdmFsdWUgb2JqZWN0cyBkbyBub3QgZXhpc3QgYXQgcnVudGltZSwgc28gd2UgY2Fubm90IGFjY2VzcyB0aGUgc3ltYm9sIChpdCBvbmx5XG4gICAgICAgICAgLy8gZXhpc3RzIGluIGV4dGVybnMpLiBFeHBvcnQgdGhlbSBhcyBhIHR5cGVkZWYsIHdoaWNoIGZvcndhcmRzIHRvIHRoZSB0eXBlIGluIGV4dGVybnMuXG4gICAgICAgICAgLy8gTm90ZTogVHlwZVNjcmlwdCBlbWl0cyBvZGQgY29kZSBmb3IgZXhwb3J0ZWQgYW1iaWVudHMgKGV4cG9ydHMueCBmb3IgdmFyaWFibGVzLCBqdXN0IHhcbiAgICAgICAgICAvLyBmb3IgZXZlcnl0aGluZyBlbHNlKS4gVGhhdCBzZWVtcyBidWdneSwgYW5kIGluIGVpdGhlciBjYXNlIHRoaXMgY29kZSBzaG91bGQgbm90IGF0dGVtcHRcbiAgICAgICAgICAvLyB0byBmaXggaXQuXG4gICAgICAgICAgLy8gU2VlIGFsc28gaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy84MDE1LlxuICAgICAgICAgIGlmICghaXNWYWx1ZSkge1xuICAgICAgICAgICAgLy8gRG8gbm90IGVtaXQgcmUtZXhwb3J0cyBmb3IgTW9kdWxlRGVjbGFyYXRpb25zLlxuICAgICAgICAgICAgLy8gQW1iaWVudCBNb2R1bGVEZWNsYXJhdGlvbnMgYXJlIGFsd2F5cyByZWZlcmVuY2VkIGFzIGdsb2JhbCBzeW1ib2xzLCBzbyB0aGV5IGRvbid0XG4gICAgICAgICAgICAvLyBuZWVkIHRvIGJlIGV4cG9ydGVkLlxuICAgICAgICAgICAgaWYgKG5vZGUua2luZCA9PT0gdHMuU3ludGF4S2luZC5Nb2R1bGVEZWNsYXJhdGlvbikgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBtYW5nbGVkTmFtZSA9IG1vZHVsZU5hbWVBc0lkZW50aWZpZXIoaG9zdCwgc291cmNlRmlsZS5maWxlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkZWNsTmFtZSA9IHRyYW5zZm9ybWVyVXRpbC5nZXRJZGVudGlmaWVyVGV4dChkZWNsKTtcbiAgICAgICAgICAgIGNvbnN0IHN0bXQgPSB0cy5jcmVhdGVTdGF0ZW1lbnQoXG4gICAgICAgICAgICAgICAgdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHMuY3JlYXRlSWRlbnRpZmllcignZXhwb3J0cycpLCBkZWNsTmFtZSkpO1xuICAgICAgICAgICAgYWRkQ29tbWVudE9uKHN0bXQsIFt7dGFnTmFtZTogJ3R5cGVkZWYnLCB0eXBlOiBgISR7bWFuZ2xlZE5hbWV9LiR7ZGVjbE5hbWV9YH1dKTtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHN0bXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiB2aXNpdG9yKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlfHRzLk5vZGVbXSB7XG4gICAgICAgIGlmICh0cmFuc2Zvcm1lclV0aWwuaXNBbWJpZW50KG5vZGUpKSB7XG4gICAgICAgICAgaWYgKCF0cmFuc2Zvcm1lclV0aWwuaGFzTW9kaWZpZXJGbGFnKG5vZGUgYXMgdHMuRGVjbGFyYXRpb24sIHRzLk1vZGlmaWVyRmxhZ3MuRXhwb3J0KSkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB2aXNpdEV4cG9ydGVkQW1iaWVudChub2RlKTtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5JbXBvcnREZWNsYXJhdGlvbjpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdEltcG9ydERlY2xhcmF0aW9uKG5vZGUgYXMgdHMuSW1wb3J0RGVjbGFyYXRpb24pO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FeHBvcnREZWNsYXJhdGlvbjpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdEV4cG9ydERlY2xhcmF0aW9uKG5vZGUgYXMgdHMuRXhwb3J0RGVjbGFyYXRpb24pO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbGFzc0RlY2xhcmF0aW9uOlxuICAgICAgICAgICAgcmV0dXJuIHZpc2l0Q2xhc3NEZWNsYXJhdGlvbihub2RlIGFzIHRzLkNsYXNzRGVjbGFyYXRpb24pO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5JbnRlcmZhY2VEZWNsYXJhdGlvbjpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdEludGVyZmFjZURlY2xhcmF0aW9uKG5vZGUgYXMgdHMuSW50ZXJmYWNlRGVjbGFyYXRpb24pO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5IZXJpdGFnZUNsYXVzZTpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdEhlcml0YWdlQ2xhdXNlKG5vZGUgYXMgdHMuSGVyaXRhZ2VDbGF1c2UpO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5BcnJvd0Z1bmN0aW9uOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvbkV4cHJlc3Npb246XG4gICAgICAgICAgICAvLyBJbnNlcnRpbmcgYSBjb21tZW50IGJlZm9yZSBhbiBleHByZXNzaW9uIGNhbiB0cmlnZ2VyIGF1dG9tYXRpYyBzZW1pY29sb24gaW5zZXJ0aW9uLFxuICAgICAgICAgICAgLy8gZS5nLiBpZiB0aGUgZnVuY3Rpb24gYmVsb3cgaXMgdGhlIGV4cHJlc3Npb24gaW4gYSBgcmV0dXJuYCBzdGF0ZW1lbnQuIFBhcmVudGhlc2l6aW5nXG4gICAgICAgICAgICAvLyBwcmV2ZW50cyBBU0ksIGFzIGxvbmcgYXMgdGhlIG9wZW5pbmcgcGFyZW4gcmVtYWlucyBvbiB0aGUgc2FtZSBsaW5lICh3aGljaCBpdCBkb2VzKS5cbiAgICAgICAgICAgIHJldHVybiB0cy5jcmVhdGVQYXJlbihcbiAgICAgICAgICAgICAgICB2aXNpdEZ1bmN0aW9uTGlrZURlY2xhcmF0aW9uKG5vZGUgYXMgdHMuQXJyb3dGdW5jdGlvbiB8IHRzLkZ1bmN0aW9uRXhwcmVzc2lvbikpO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Db25zdHJ1Y3RvcjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRnVuY3Rpb25EZWNsYXJhdGlvbjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTWV0aG9kRGVjbGFyYXRpb246XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkdldEFjY2Vzc29yOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5TZXRBY2Nlc3NvcjpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdEZ1bmN0aW9uTGlrZURlY2xhcmF0aW9uKG5vZGUgYXMgdHMuRnVuY3Rpb25MaWtlRGVjbGFyYXRpb24pO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UaGlzS2V5d29yZDpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdFRoaXNFeHByZXNzaW9uKG5vZGUgYXMgdHMuVGhpc0V4cHJlc3Npb24pO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5WYXJpYWJsZVN0YXRlbWVudDpcbiAgICAgICAgICAgIHJldHVybiB2aXNpdFZhcmlhYmxlU3RhdGVtZW50KG5vZGUgYXMgdHMuVmFyaWFibGVTdGF0ZW1lbnQpO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Qcm9wZXJ0eURlY2xhcmF0aW9uOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Qcm9wZXJ0eUFzc2lnbm1lbnQ6XG4gICAgICAgICAgICBlc2NhcGVJbGxlZ2FsSlNEb2Mobm9kZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuUGFyYW1ldGVyOlxuICAgICAgICAgICAgLy8gUGFyYW1ldGVyIHByb3BlcnRpZXMgKGUuZy4gYGNvbnN0cnVjdG9yKC8qKiBkb2NzICovIHByaXZhdGUgZm9vOiBzdHJpbmcpYCkgbWlnaHQgaGF2ZVxuICAgICAgICAgICAgLy8gSlNEb2MgY29tbWVudHMsIGluY2x1ZGluZyBKU0RvYyB0YWdzIHJlY29nbml6ZWQgYnkgQ2xvc3VyZSBDb21waWxlci4gUHJldmVudCBlbWl0dGluZ1xuICAgICAgICAgICAgLy8gYW55IGNvbW1lbnRzIG9uIHRoZW0sIHNvIHRoYXQgQ2xvc3VyZSBkb2Vzbid0IGVycm9yIG9uIHRoZW0uXG4gICAgICAgICAgICAvLyBTZWUgdGVzdF9maWxlcy9wYXJhbWV0ZXJfcHJvcGVydGllcy50cy5cbiAgICAgICAgICAgIGNvbnN0IHBhcmFtRGVjbCA9IG5vZGUgYXMgdHMuUGFyYW1ldGVyRGVjbGFyYXRpb247XG4gICAgICAgICAgICBpZiAodHJhbnNmb3JtZXJVdGlsLmhhc01vZGlmaWVyRmxhZyhcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1EZWNsLCB0cy5Nb2RpZmllckZsYWdzLlBhcmFtZXRlclByb3BlcnR5TW9kaWZpZXIpKSB7XG4gICAgICAgICAgICAgIHRzLnNldFN5bnRoZXRpY0xlYWRpbmdDb21tZW50cyhwYXJhbURlY2wsIFtdKTtcbiAgICAgICAgICAgICAganNkb2Muc3VwcHJlc3NMZWFkaW5nQ29tbWVudHNSZWN1cnNpdmVseShwYXJhbURlY2wpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlR5cGVBbGlhc0RlY2xhcmF0aW9uOlxuICAgICAgICAgICAgcmV0dXJuIHZpc2l0VHlwZUFsaWFzRGVjbGFyYXRpb24obm9kZSBhcyB0cy5UeXBlQWxpYXNEZWNsYXJhdGlvbik7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkFzRXhwcmVzc2lvbjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVHlwZUFzc2VydGlvbkV4cHJlc3Npb246XG4gICAgICAgICAgICByZXR1cm4gdmlzaXRBc3NlcnRpb25FeHByZXNzaW9uKG5vZGUgYXMgdHMuVHlwZUFzc2VydGlvbik7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk5vbk51bGxFeHByZXNzaW9uOlxuICAgICAgICAgICAgcmV0dXJuIHZpc2l0Tm9uTnVsbEV4cHJlc3Npb24obm9kZSBhcyB0cy5Ob25OdWxsRXhwcmVzc2lvbik7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgIH1cblxuICAgICAgc291cmNlRmlsZSA9IHRzLnZpc2l0RWFjaENoaWxkKHNvdXJjZUZpbGUsIHZpc2l0b3IsIGNvbnRleHQpO1xuXG4gICAgICByZXR1cm4gbW9kdWxlVHlwZVRyYW5zbGF0b3IuaW5zZXJ0QWRkaXRpb25hbEltcG9ydHMoc291cmNlRmlsZSk7XG4gICAgfTtcbiAgfTtcbn1cbiJdfQ==