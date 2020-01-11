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
        define("tsickle/src/decorator_downlevel_transformer", ["require", "exports", "typescript", "tsickle/src/decorators", "tsickle/src/transformer_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * @fileoverview Decorator downleveling support. tsickle can optionally convert decorator calls
     * into annotations. For example, a decorator application on a method:
     *   class X {
     *     @Foo(1, 2)
     *     bar() { ... }
     *   }
     * Will get converted to:
     *   class X {
     *     bar() { ... }
     *     static propDecorators = {
     *       bar: {type: Foo, args: [1, 2]}
     *     }
     *   }
     * Similarly for decorators on the class (property 'decorators') and decorators on the constructor
     * (property 'ctorParameters', including the types of all arguments of the constructor).
     *
     * This is used by, among other software, Angular in its "non-AoT" mode to inspect decorator
     * invocations.
     */
    const ts = require("typescript");
    const decorators_1 = require("tsickle/src/decorators");
    const transformer_util_1 = require("tsickle/src/transformer_util");
    /**
     * Returns true if the given decorator should be downleveled.
     *
     * Decorators that have JSDoc on them including the `@Annotation` tag are downleveled and converted
     * into properties on the class by this pass.
     */
    function shouldLower(decorator, typeChecker) {
        for (const d of decorators_1.getDecoratorDeclarations(decorator, typeChecker)) {
            // TODO(lucassloan):
            // Switch to the TS JSDoc parser in the future to avoid false positives here.
            // For example using '@Annotation' in a true comment.
            // However, a new TS API would be needed, track at
            // https://github.com/Microsoft/TypeScript/issues/7393.
            let commentNode = d;
            // Not handling PropertyAccess expressions here, because they are
            // filtered earlier.
            if (commentNode.kind === ts.SyntaxKind.VariableDeclaration) {
                if (!commentNode.parent)
                    continue;
                commentNode = commentNode.parent;
            }
            // Go up one more level to VariableDeclarationStatement, where usually
            // the comment lives. If the declaration has an 'export', the
            // VDList.getFullText will not contain the comment.
            if (commentNode.kind === ts.SyntaxKind.VariableDeclarationList) {
                if (!commentNode.parent)
                    continue;
                commentNode = commentNode.parent;
            }
            const range = transformer_util_1.getAllLeadingComments(commentNode);
            if (!range)
                continue;
            for (const { text } of range) {
                if (text.includes('@Annotation'))
                    return true;
            }
        }
        return false;
    }
    exports.shouldLower = shouldLower;
    /**
     * Creates the AST for the decorator field type annotation, which has the form
     *     { type: Function, args?: any[] }[]
     */
    function createDecoratorInvocationType() {
        const typeElements = [];
        typeElements.push(ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('Function'), undefined), undefined));
        typeElements.push(ts.createPropertySignature(undefined, 'args', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)), undefined));
        return ts.createArrayTypeNode(ts.createTypeLiteralNode(typeElements));
    }
    /**
     * Extracts the type of the decorator (the function or expression invoked), as well as all the
     * arguments passed to the decorator. Returns an AST with the form:
     *
     *     // For @decorator(arg1, arg2)
     *     { type: decorator, args: [arg1, arg2] }
     */
    function extractMetadataFromSingleDecorator(decorator, diagnostics) {
        const metadataProperties = [];
        const expr = decorator.expression;
        switch (expr.kind) {
            case ts.SyntaxKind.Identifier:
                // The decorator was a plain @Foo.
                metadataProperties.push(ts.createPropertyAssignment('type', expr));
                break;
            case ts.SyntaxKind.CallExpression:
                // The decorator was a call, like @Foo(bar).
                const call = expr;
                metadataProperties.push(ts.createPropertyAssignment('type', call.expression));
                if (call.arguments.length) {
                    const args = [];
                    for (const arg of call.arguments) {
                        args.push(arg);
                    }
                    const argsArrayLiteral = ts.createArrayLiteral(args);
                    argsArrayLiteral.elements.hasTrailingComma = true;
                    metadataProperties.push(ts.createPropertyAssignment('args', argsArrayLiteral));
                }
                break;
            default:
                diagnostics.push({
                    file: decorator.getSourceFile(),
                    start: decorator.getStart(),
                    length: decorator.getEnd() - decorator.getStart(),
                    messageText: `${ts.SyntaxKind[decorator.kind]} not implemented in gathering decorator metadata`,
                    category: ts.DiagnosticCategory.Error,
                    code: 0,
                });
                break;
        }
        return ts.createObjectLiteral(metadataProperties);
    }
    /**
     * Takes a list of decorator metadata object ASTs and produces an AST for a
     * static class property of an array of those metadata objects.
     */
    function createDecoratorClassProperty(decoratorList) {
        const modifier = ts.createToken(ts.SyntaxKind.StaticKeyword);
        const type = createDecoratorInvocationType();
        const initializer = ts.createArrayLiteral(decoratorList, true);
        initializer.elements.hasTrailingComma = true;
        const prop = ts.createProperty(undefined, [modifier], 'decorators', undefined, type, initializer);
        // NB: the .decorators property does not get a @nocollapse property. There is
        // no good reason why - it means .decorators is not runtime accessible if you
        // compile with collapse properties, whereas propDecorators is, which doesn't
        // follow any stringent logic. However this has been the case previously, and
        // adding it back in leads to substantial code size increases as Closure fails
        // to tree shake these props without @nocollapse.
        return prop;
    }
    /**
     * Creates the AST for the 'ctorParameters' field type annotation:
     *   () => ({ type: any, decorators?: {type: Function, args?: any[]}[] }|null)[]
     */
    function createCtorParametersClassPropertyType() {
        // Sorry about this. Try reading just the string literals below.
        const typeElements = [];
        typeElements.push(ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('any'), undefined), undefined));
        typeElements.push(ts.createPropertySignature(undefined, 'decorators', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createTypeLiteralNode([
            ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('Function'), undefined), undefined),
            ts.createPropertySignature(undefined, 'args', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createTypeReferenceNode(ts.createIdentifier('any'), undefined)), undefined),
        ])), undefined));
        return ts.createFunctionTypeNode(undefined, [], ts.createArrayTypeNode(ts.createUnionTypeNode([ts.createTypeLiteralNode(typeElements), ts.createNull()])));
    }
    /**
     * Sets a Closure \@nocollapse synthetic comment on the given node. This prevents Closure Compiler
     * from collapsing the apparently static property, which would make it impossible to find for code
     * trying to detect it at runtime.
     */
    function addNoCollapseComment(n) {
        ts.setSyntheticLeadingComments(n, [{
                kind: ts.SyntaxKind.MultiLineCommentTrivia,
                text: '* @nocollapse ',
                pos: -1,
                end: -1,
                hasTrailingNewLine: true
            }]);
    }
    /**
     * createCtorParametersClassProperty creates a static 'ctorParameters' property containing
     * downleveled decorator information.
     *
     * The property contains an arrow function that returns an array of object literals of the shape:
     *     static ctorParameters = () => [{
     *       type: SomeClass|undefined,  // the type of the param that's decorated, if it's a value.
     *       decorators: [{
     *         type: DecoratorFn,  // the type of the decorator that's invoked.
     *         args: [ARGS],       // the arguments passed to the decorator.
     *       }]
     *     }];
     */
    function createCtorParametersClassProperty(diagnostics, entityNameToExpression, ctorParameters) {
        const params = [];
        for (const ctorParam of ctorParameters) {
            if (!ctorParam.type && ctorParam.decorators.length === 0) {
                params.push(ts.createNull());
                continue;
            }
            const paramType = ctorParam.type ?
                typeReferenceToExpression(entityNameToExpression, ctorParam.type) :
                undefined;
            const members = [ts.createPropertyAssignment('type', paramType || ts.createIdentifier('undefined'))];
            const decorators = [];
            for (const deco of ctorParam.decorators) {
                decorators.push(extractMetadataFromSingleDecorator(deco, diagnostics));
            }
            if (decorators.length) {
                members.push(ts.createPropertyAssignment('decorators', ts.createArrayLiteral(decorators)));
            }
            params.push(ts.createObjectLiteral(members));
        }
        const initializer = ts.createArrowFunction(undefined, undefined, [], undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.createArrayLiteral(params, true));
        const type = createCtorParametersClassPropertyType();
        const ctorProp = ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], 'ctorParameters', undefined, type, initializer);
        addNoCollapseComment(ctorProp);
        return ctorProp;
    }
    /**
     * createPropDecoratorsClassProperty creates a static 'propDecorators' property containing type
     * information for every property that has a decorator applied.
     *
     *     static propDecorators: {[key: string]: {type: Function, args?: any[]}[]} = {
     *       propA: [{type: MyDecorator, args: [1, 2]}, ...],
     *       ...
     *     };
     */
    function createPropDecoratorsClassProperty(diagnostics, properties) {
        //  `static propDecorators: {[key: string]: ` + {type: Function, args?: any[]}[] + `} = {\n`);
        const entries = [];
        for (const [name, decorators] of properties.entries()) {
            entries.push(ts.createPropertyAssignment(name, ts.createArrayLiteral(decorators.map(deco => extractMetadataFromSingleDecorator(deco, diagnostics)))));
        }
        const initializer = ts.createObjectLiteral(entries, true);
        const type = ts.createTypeLiteralNode([ts.createIndexSignature(undefined, undefined, [ts.createParameter(undefined, undefined, undefined, 'key', undefined, ts.createTypeReferenceNode('string', undefined), undefined)], createDecoratorInvocationType())]);
        return ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], 'propDecorators', undefined, type, initializer);
    }
    function isNameEqual(classMember, name) {
        if (classMember.name === undefined) {
            return false;
        }
        const id = classMember.name;
        return id.text === name;
    }
    /**
     * Returns an expression representing the (potentially) value part for the given node.
     *
     * This is a partial re-implementation of TypeScript's serializeTypeReferenceNode. This is a
     * workaround for https://github.com/Microsoft/TypeScript/issues/17516 (serializeTypeReferenceNode
     * not being exposed). In practice this implementation is sufficient for Angular's use of type
     * metadata.
     */
    function typeReferenceToExpression(entityNameToExpression, node) {
        let kind = node.kind;
        if (ts.isLiteralTypeNode(node)) {
            // Treat literal types like their base type (boolean, string, number).
            kind = node.literal.kind;
        }
        switch (kind) {
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
                return ts.createIdentifier('Function');
            case ts.SyntaxKind.ArrayType:
            case ts.SyntaxKind.TupleType:
                return ts.createIdentifier('Array');
            case ts.SyntaxKind.TypePredicate:
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.BooleanKeyword:
                return ts.createIdentifier('Boolean');
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.StringKeyword:
                return ts.createIdentifier('String');
            case ts.SyntaxKind.ObjectKeyword:
                return ts.createIdentifier('Object');
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.NumericLiteral:
                return ts.createIdentifier('Number');
            case ts.SyntaxKind.TypeReference:
                const typeRef = node;
                // Ignore any generic types, just return the base type.
                return entityNameToExpression(typeRef.typeName);
            default:
                return undefined;
        }
    }
    /**
     * Transformer factory for the decorator downlevel transformer. See fileoverview for details.
     */
    function decoratorDownlevelTransformer(typeChecker, diagnostics) {
        return (context) => {
            /** A map from symbols to the identifier of an import, reset per SourceFile. */
            let importNamesBySymbol = new Map();
            /**
             * Converts an EntityName (from a type annotation) to an expression (accessing a value).
             *
             * For a given ts.EntityName, this walks depth first to find the leftmost ts.Identifier, then
             * converts the path into property accesses.
             *
             * This generally works, but TypeScript's emit pipeline does not serialize identifiers that are
             * only used in a type location (such as identifiers in a TypeNode), even if the identifier
             * itself points to a value (e.g. a class). To avoid that problem, this method finds the symbol
             * representing the identifier (using typeChecker), then looks up where it was imported (using
             * importNamesBySymbol), and then uses the imported name instead of the identifier from the type
             * expression, if any. Otherwise it'll use the identifier unchanged. This makes sure the
             * identifier is not marked as stemming from a "type only" expression, causing it to be emitted
             * and causing the import to be retained.
             */
            function entityNameToExpression(name) {
                const sym = typeChecker.getSymbolAtLocation(name);
                if (!sym)
                    return undefined;
                // Check if the entity name references a symbol that is an actual value. If it is not, it
                // cannot be referenced by an expression, so return undefined.
                let symToCheck = sym;
                if (symToCheck.flags & ts.SymbolFlags.Alias) {
                    symToCheck = typeChecker.getAliasedSymbol(symToCheck);
                }
                if (!(symToCheck.flags & ts.SymbolFlags.Value))
                    return undefined;
                if (ts.isIdentifier(name)) {
                    // If there's a known import name for this symbol, use it so that the import will be
                    // retained and the value can be referenced.
                    if (importNamesBySymbol.has(sym))
                        return importNamesBySymbol.get(sym);
                    // Otherwise this will be a locally declared name, just return that.
                    return name;
                }
                const ref = entityNameToExpression(name.left);
                if (!ref)
                    return undefined;
                return ts.createPropertyAccess(ref, name.right);
            }
            /**
             * Transforms a class element. Returns a three tuple of name, transformed element, and
             * decorators found. Returns an undefined name if there are no decorators to lower on the
             * element, or the element has an exotic name.
             */
            function transformClassElement(element) {
                element = ts.visitEachChild(element, visitor, context);
                const decoratorsToKeep = [];
                const toLower = [];
                for (const decorator of element.decorators || []) {
                    if (!shouldLower(decorator, typeChecker)) {
                        decoratorsToKeep.push(decorator);
                        continue;
                    }
                    toLower.push(decorator);
                }
                if (!toLower.length)
                    return [undefined, element, []];
                if (!element.name || element.name.kind !== ts.SyntaxKind.Identifier) {
                    // Method has a weird name, e.g.
                    //   [Symbol.foo]() {...}
                    diagnostics.push({
                        file: element.getSourceFile(),
                        start: element.getStart(),
                        length: element.getEnd() - element.getStart(),
                        messageText: `cannot process decorators on strangely named method`,
                        category: ts.DiagnosticCategory.Error,
                        code: 0,
                    });
                    return [undefined, element, []];
                }
                const name = element.name.text;
                const mutable = ts.getMutableClone(element);
                mutable.decorators = decoratorsToKeep.length ?
                    ts.setTextRange(ts.createNodeArray(decoratorsToKeep), mutable.decorators) :
                    undefined;
                return [name, mutable, toLower];
            }
            /**
             * Transforms a constructor. Returns the transformed constructor and the list of parameter
             * information collected, consisting of decorators and optional type.
             */
            function transformConstructor(ctor) {
                ctor = ts.visitEachChild(ctor, visitor, context);
                const newParameters = [];
                const oldParameters = ts.visitParameterList(ctor.parameters, visitor, context);
                const parametersInfo = [];
                for (const param of oldParameters) {
                    const decoratorsToKeep = [];
                    const paramInfo = { decorators: [], type: null };
                    for (const decorator of param.decorators || []) {
                        if (!shouldLower(decorator, typeChecker)) {
                            decoratorsToKeep.push(decorator);
                            continue;
                        }
                        paramInfo.decorators.push(decorator);
                    }
                    if (param.type) {
                        // param has a type provided, e.g. "foo: Bar".
                        // The type will be emitted as a value expression in entityNameToExpression, which takes
                        // care not to emit anything for types that cannot be expressed as a value (e.g.
                        // interfaces).
                        paramInfo.type = param.type;
                    }
                    parametersInfo.push(paramInfo);
                    const newParam = ts.updateParameter(param, 
                    // Must pass 'undefined' to avoid emitting decorator metadata.
                    decoratorsToKeep.length ? decoratorsToKeep : undefined, param.modifiers, param.dotDotDotToken, param.name, param.questionToken, param.type, param.initializer);
                    newParameters.push(newParam);
                }
                const updated = ts.updateConstructor(ctor, ctor.decorators, ctor.modifiers, newParameters, ts.visitFunctionBody(ctor.body, visitor, context));
                return [updated, parametersInfo];
            }
            /**
             * Transforms a single class declaration:
             * - dispatches to strip decorators on members
             * - converts decorators on the class to annotations
             * - creates a ctorParameters property
             * - creates a propDecorators property
             */
            function transformClassDeclaration(classDecl) {
                classDecl = ts.getMutableClone(classDecl);
                const newMembers = [];
                const decoratedProperties = new Map();
                let classParameters = null;
                for (const member of classDecl.members) {
                    switch (member.kind) {
                        case ts.SyntaxKind.PropertyDeclaration:
                        case ts.SyntaxKind.GetAccessor:
                        case ts.SyntaxKind.SetAccessor:
                        case ts.SyntaxKind.MethodDeclaration: {
                            const [name, newMember, decorators] = transformClassElement(member);
                            newMembers.push(newMember);
                            if (name)
                                decoratedProperties.set(name, decorators);
                            continue;
                        }
                        case ts.SyntaxKind.Constructor: {
                            const ctor = member;
                            if (!ctor.body)
                                break;
                            const [newMember, parametersInfo] = transformConstructor(member);
                            classParameters = parametersInfo;
                            newMembers.push(newMember);
                            continue;
                        }
                        default:
                            break;
                    }
                    newMembers.push(ts.visitEachChild(member, visitor, context));
                }
                const decorators = classDecl.decorators || [];
                const decoratorsToLower = [];
                const decoratorsToKeep = [];
                for (const decorator of decorators) {
                    if (shouldLower(decorator, typeChecker)) {
                        decoratorsToLower.push(extractMetadataFromSingleDecorator(decorator, diagnostics));
                    }
                    else {
                        decoratorsToKeep.push(decorator);
                    }
                }
                const newClassDeclaration = ts.getMutableClone(classDecl);
                if (decoratorsToLower.length) {
                    newMembers.push(createDecoratorClassProperty(decoratorsToLower));
                }
                if (classParameters) {
                    if ((decoratorsToLower.length) || classParameters.some(p => !!p.decorators.length)) {
                        // emit ctorParameters if the class was decoratored at all, or if any of its ctors
                        // were classParameters
                        newMembers.push(createCtorParametersClassProperty(diagnostics, entityNameToExpression, classParameters));
                    }
                }
                if (decoratedProperties.size) {
                    newMembers.push(createPropDecoratorsClassProperty(diagnostics, decoratedProperties));
                }
                newClassDeclaration.members = ts.setTextRange(ts.createNodeArray(newMembers, newClassDeclaration.members.hasTrailingComma), classDecl.members);
                newClassDeclaration.decorators =
                    decoratorsToKeep.length ? ts.createNodeArray(decoratorsToKeep) : undefined;
                return newClassDeclaration;
            }
            function visitor(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.SourceFile: {
                        importNamesBySymbol = new Map();
                        return ts.visitEachChild(node, visitor, context);
                    }
                    case ts.SyntaxKind.ImportDeclaration: {
                        const impDecl = node;
                        if (impDecl.importClause) {
                            const importClause = impDecl.importClause;
                            const names = [];
                            if (importClause.name) {
                                names.push(importClause.name);
                            }
                            if (importClause.namedBindings &&
                                importClause.namedBindings.kind === ts.SyntaxKind.NamedImports) {
                                const namedImports = importClause.namedBindings;
                                names.push(...namedImports.elements.map(e => e.name));
                            }
                            for (const name of names) {
                                const sym = typeChecker.getSymbolAtLocation(name);
                                importNamesBySymbol.set(sym, name);
                            }
                        }
                        return ts.visitEachChild(node, visitor, context);
                    }
                    case ts.SyntaxKind.ClassDeclaration: {
                        return transformClassDeclaration(node);
                    }
                    default:
                        return transformer_util_1.visitEachChild(node, visitor, context);
                }
            }
            return (sf) => visitor(sf);
        };
    }
    exports.decoratorDownlevelTransformer = decoratorDownlevelTransformer;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9yX2Rvd25sZXZlbF90cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9kZWNvcmF0b3JfZG93bmxldmVsX3RyYW5zZm9ybWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FtQkc7SUFFSCxpQ0FBaUM7SUFFakMsdURBQXNEO0lBQ3RELG1FQUF5RTtJQUV6RTs7Ozs7T0FLRztJQUNILFNBQWdCLFdBQVcsQ0FBQyxTQUF1QixFQUFFLFdBQTJCO1FBQzlFLEtBQUssTUFBTSxDQUFDLElBQUkscUNBQXdCLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxFQUFFO1lBQ2hFLG9CQUFvQjtZQUNwQiw2RUFBNkU7WUFDN0UscURBQXFEO1lBQ3JELGtEQUFrRDtZQUNsRCx1REFBdUQ7WUFDdkQsSUFBSSxXQUFXLEdBQVksQ0FBQyxDQUFDO1lBQzdCLGlFQUFpRTtZQUNqRSxvQkFBb0I7WUFDcEIsSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLEVBQUU7Z0JBQzFELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTTtvQkFBRSxTQUFTO2dCQUNsQyxXQUFXLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQzthQUNsQztZQUNELHNFQUFzRTtZQUN0RSw2REFBNkQ7WUFDN0QsbURBQW1EO1lBQ25ELElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLHVCQUF1QixFQUFFO2dCQUM5RCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU07b0JBQUUsU0FBUztnQkFDbEMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7YUFDbEM7WUFDRCxNQUFNLEtBQUssR0FBRyx3Q0FBcUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNqRCxJQUFJLENBQUMsS0FBSztnQkFBRSxTQUFTO1lBQ3JCLEtBQUssTUFBTSxFQUFDLElBQUksRUFBQyxJQUFJLEtBQUssRUFBRTtnQkFDMUIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQztvQkFBRSxPQUFPLElBQUksQ0FBQzthQUMvQztTQUNGO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBNUJELGtDQTRCQztJQUVEOzs7T0FHRztJQUNILFNBQVMsNkJBQTZCO1FBQ3BDLE1BQU0sWUFBWSxHQUFxQixFQUFFLENBQUM7UUFDMUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQ3hDLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUM1QixFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDeEYsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQ3hDLFNBQVMsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxFQUM5RCxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQzVGLE9BQU8sRUFBRSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxTQUFTLGtDQUFrQyxDQUN2QyxTQUF1QixFQUFFLFdBQTRCO1FBQ3ZELE1BQU0sa0JBQWtCLEdBQWtDLEVBQUUsQ0FBQztRQUM3RCxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDO1FBQ2xDLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNqQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVTtnQkFDM0Isa0NBQWtDO2dCQUNsQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNuRSxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWM7Z0JBQy9CLDRDQUE0QztnQkFDNUMsTUFBTSxJQUFJLEdBQUcsSUFBeUIsQ0FBQztnQkFDdkMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQzlFLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUU7b0JBQ3pCLE1BQU0sSUFBSSxHQUFvQixFQUFFLENBQUM7b0JBQ2pDLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTt3QkFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztxQkFDaEI7b0JBQ0QsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3JELGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7b0JBQ2xELGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsd0JBQXdCLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztpQkFDaEY7Z0JBQ0QsTUFBTTtZQUNSO2dCQUNFLFdBQVcsQ0FBQyxJQUFJLENBQUM7b0JBQ2YsSUFBSSxFQUFFLFNBQVMsQ0FBQyxhQUFhLEVBQUU7b0JBQy9CLEtBQUssRUFBRSxTQUFTLENBQUMsUUFBUSxFQUFFO29CQUMzQixNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxRQUFRLEVBQUU7b0JBQ2pELFdBQVcsRUFDUCxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxrREFBa0Q7b0JBQ3RGLFFBQVEsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSztvQkFDckMsSUFBSSxFQUFFLENBQUM7aUJBQ1IsQ0FBQyxDQUFDO2dCQUNILE1BQU07U0FDVDtRQUNELE9BQU8sRUFBRSxDQUFDLG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsNEJBQTRCLENBQUMsYUFBMkM7UUFDL0UsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzdELE1BQU0sSUFBSSxHQUFHLDZCQUE2QixFQUFFLENBQUM7UUFDN0MsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvRCxXQUFXLENBQUMsUUFBUSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztRQUM3QyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2xHLDZFQUE2RTtRQUM3RSw2RUFBNkU7UUFDN0UsNkVBQTZFO1FBQzdFLDZFQUE2RTtRQUM3RSw4RUFBOEU7UUFDOUUsaURBQWlEO1FBQ2pELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMscUNBQXFDO1FBQzVDLGdFQUFnRTtRQUNoRSxNQUFNLFlBQVksR0FBcUIsRUFBRSxDQUFDO1FBQzFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHVCQUF1QixDQUN4QyxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFDNUIsRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ25GLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHVCQUF1QixDQUN4QyxTQUFTLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsRUFDcEUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztZQUM5QyxFQUFFLENBQUMsdUJBQXVCLENBQ3RCLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUM1QixFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxFQUFFLFNBQVMsQ0FBQztZQUN0RixFQUFFLENBQUMsdUJBQXVCLENBQ3RCLFNBQVMsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxFQUM5RCxFQUFFLENBQUMsbUJBQW1CLENBQ2xCLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsRUFDdEUsU0FBUyxDQUFDO1NBQ2YsQ0FBQyxDQUFDLEVBQ0gsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUNoQixPQUFPLEVBQUUsQ0FBQyxzQkFBc0IsQ0FDNUIsU0FBUyxFQUFFLEVBQUUsRUFDYixFQUFFLENBQUMsbUJBQW1CLENBQ2xCLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5RixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFNBQVMsb0JBQW9CLENBQUMsQ0FBVTtRQUN0QyxFQUFFLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ0YsSUFBSSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCO2dCQUMxQyxJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixHQUFHLEVBQUUsQ0FBQyxDQUFDO2dCQUNQLEdBQUcsRUFBRSxDQUFDLENBQUM7Z0JBQ1Asa0JBQWtCLEVBQUUsSUFBSTthQUN6QixDQUFDLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7OztPQVlHO0lBQ0gsU0FBUyxpQ0FBaUMsQ0FDdEMsV0FBNEIsRUFDNUIsc0JBQXVFLEVBRXZFLGNBQXlDO1FBQzNDLE1BQU0sTUFBTSxHQUFvQixFQUFFLENBQUM7UUFFbkMsS0FBSyxNQUFNLFNBQVMsSUFBSSxjQUFjLEVBQUU7WUFDdEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUN4RCxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO2dCQUM3QixTQUFTO2FBQ1Y7WUFFRCxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzlCLHlCQUF5QixDQUFDLHNCQUFzQixFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNuRSxTQUFTLENBQUM7WUFDZCxNQUFNLE9BQU8sR0FDVCxDQUFDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLEVBQUUsU0FBUyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekYsTUFBTSxVQUFVLEdBQWlDLEVBQUUsQ0FBQztZQUNwRCxLQUFLLE1BQU0sSUFBSSxJQUFJLFNBQVMsQ0FBQyxVQUFVLEVBQUU7Z0JBQ3ZDLFVBQVUsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7YUFDeEU7WUFDRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3JCLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzVGO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUM5QztRQUVELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FDdEMsU0FBUyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUN6RixFQUFFLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDekMsTUFBTSxJQUFJLEdBQUcscUNBQXFDLEVBQUUsQ0FBQztRQUNyRCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsY0FBYyxDQUM5QixTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUMzRixXQUFXLENBQUMsQ0FBQztRQUNqQixvQkFBb0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMvQixPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCxTQUFTLGlDQUFpQyxDQUN0QyxXQUE0QixFQUFFLFVBQXVDO1FBQ3ZFLDhGQUE4RjtRQUM5RixNQUFNLE9BQU8sR0FBa0MsRUFBRSxDQUFDO1FBQ2xELEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDckQsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsd0JBQXdCLENBQ3BDLElBQUksRUFDSixFQUFFLENBQUMsa0JBQWtCLENBQ2pCLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUMxRjtRQUNELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUMxRCxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FDZixTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUNqRCxFQUFFLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQ3RGLDZCQUE2QixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkMsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUNwQixTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUMzRixXQUFXLENBQUMsQ0FBQztJQUNuQixDQUFDO0lBRUQsU0FBUyxXQUFXLENBQUMsV0FBNEIsRUFBRSxJQUFZO1FBQzdELElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDbEMsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUNELE1BQU0sRUFBRSxHQUFHLFdBQVcsQ0FBQyxJQUFxQixDQUFDO1FBQzdDLE9BQU8sRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUM7SUFDMUIsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSCxTQUFTLHlCQUF5QixDQUM5QixzQkFBdUUsRUFDdkUsSUFBaUI7UUFDbkIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNyQixJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM5QixzRUFBc0U7WUFDdEUsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1NBQzFCO1FBQ0QsUUFBUSxJQUFJLEVBQUU7WUFDWixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO1lBQ2hDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxlQUFlO2dCQUNoQyxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUN6QyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO1lBQzdCLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxTQUFTO2dCQUMxQixPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN0QyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDO1lBQ2pDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDL0IsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUNoQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYztnQkFDL0IsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDeEMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQztZQUNqQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYTtnQkFDOUIsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdkMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWE7Z0JBQzlCLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUM7WUFDakMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWM7Z0JBQy9CLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhO2dCQUM5QixNQUFNLE9BQU8sR0FBRyxJQUE0QixDQUFDO2dCQUM3Qyx1REFBdUQ7Z0JBQ3ZELE9BQU8sc0JBQXNCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xEO2dCQUNFLE9BQU8sU0FBUyxDQUFDO1NBQ3BCO0lBQ0gsQ0FBQztJQWFEOztPQUVHO0lBQ0gsU0FBZ0IsNkJBQTZCLENBQ3pDLFdBQTJCLEVBQUUsV0FBNEI7UUFFM0QsT0FBTyxDQUFDLE9BQWlDLEVBQUUsRUFBRTtZQUMzQywrRUFBK0U7WUFDL0UsSUFBSSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBNEIsQ0FBQztZQUU5RDs7Ozs7Ozs7Ozs7Ozs7ZUFjRztZQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBbUI7Z0JBQ2pELE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLEdBQUc7b0JBQUUsT0FBTyxTQUFTLENBQUM7Z0JBQzNCLHlGQUF5RjtnQkFDekYsOERBQThEO2dCQUM5RCxJQUFJLFVBQVUsR0FBRyxHQUFHLENBQUM7Z0JBQ3JCLElBQUksVUFBVSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRTtvQkFDM0MsVUFBVSxHQUFHLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztpQkFDdkQ7Z0JBQ0QsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztvQkFBRSxPQUFPLFNBQVMsQ0FBQztnQkFFakUsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN6QixvRkFBb0Y7b0JBQ3BGLDRDQUE0QztvQkFDNUMsSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO3dCQUFFLE9BQU8sbUJBQW1CLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO29CQUN2RSxvRUFBb0U7b0JBQ3BFLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUNELE1BQU0sR0FBRyxHQUFHLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDOUMsSUFBSSxDQUFDLEdBQUc7b0JBQUUsT0FBTyxTQUFTLENBQUM7Z0JBQzNCLE9BQU8sRUFBRSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEQsQ0FBQztZQUVEOzs7O2VBSUc7WUFDSCxTQUFTLHFCQUFxQixDQUFDLE9BQXdCO2dCQUVyRCxPQUFPLEdBQUcsRUFBRSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN2RCxNQUFNLGdCQUFnQixHQUFtQixFQUFFLENBQUM7Z0JBQzVDLE1BQU0sT0FBTyxHQUFtQixFQUFFLENBQUM7Z0JBQ25DLEtBQUssTUFBTSxTQUFTLElBQUksT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFLEVBQUU7b0JBQ2hELElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxFQUFFO3dCQUN4QyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQ2pDLFNBQVM7cUJBQ1Y7b0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDekI7Z0JBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNO29CQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUVyRCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRTtvQkFDbkUsZ0NBQWdDO29CQUNoQyx5QkFBeUI7b0JBQ3pCLFdBQVcsQ0FBQyxJQUFJLENBQUM7d0JBQ2YsSUFBSSxFQUFFLE9BQU8sQ0FBQyxhQUFhLEVBQUU7d0JBQzdCLEtBQUssRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFO3dCQUN6QixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUU7d0JBQzdDLFdBQVcsRUFBRSxxREFBcUQ7d0JBQ2xFLFFBQVEsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSzt3QkFDckMsSUFBSSxFQUFFLENBQUM7cUJBQ1IsQ0FBQyxDQUFDO29CQUNILE9BQU8sQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2lCQUNqQztnQkFFRCxNQUFNLElBQUksR0FBSSxPQUFPLENBQUMsSUFBc0IsQ0FBQyxJQUFJLENBQUM7Z0JBQ2xELE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzVDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUMzRSxTQUFTLENBQUM7Z0JBQ2QsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUVEOzs7ZUFHRztZQUNILFNBQVMsb0JBQW9CLENBQUMsSUFBK0I7Z0JBRTNELElBQUksR0FBRyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBRWpELE1BQU0sYUFBYSxHQUE4QixFQUFFLENBQUM7Z0JBQ3BELE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDL0UsTUFBTSxjQUFjLEdBQThCLEVBQUUsQ0FBQztnQkFDckQsS0FBSyxNQUFNLEtBQUssSUFBSSxhQUFhLEVBQUU7b0JBQ2pDLE1BQU0sZ0JBQWdCLEdBQW1CLEVBQUUsQ0FBQztvQkFDNUMsTUFBTSxTQUFTLEdBQTRCLEVBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLENBQUM7b0JBRXhFLEtBQUssTUFBTSxTQUFTLElBQUksS0FBSyxDQUFDLFVBQVUsSUFBSSxFQUFFLEVBQUU7d0JBQzlDLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxFQUFFOzRCQUN4QyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7NEJBQ2pDLFNBQVM7eUJBQ1Y7d0JBQ0QsU0FBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7cUJBQ3ZDO29CQUNELElBQUksS0FBSyxDQUFDLElBQUksRUFBRTt3QkFDZCw4Q0FBOEM7d0JBQzlDLHdGQUF3Rjt3QkFDeEYsZ0ZBQWdGO3dCQUNoRixlQUFlO3dCQUNmLFNBQVUsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztxQkFDOUI7b0JBQ0QsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDL0IsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FDL0IsS0FBSztvQkFDTCw4REFBOEQ7b0JBQzlELGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUyxFQUN2RSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztvQkFDMUYsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztpQkFDOUI7Z0JBQ0QsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFDcEQsRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZELE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDbkMsQ0FBQztZQUVEOzs7Ozs7ZUFNRztZQUNILFNBQVMseUJBQXlCLENBQUMsU0FBOEI7Z0JBQy9ELFNBQVMsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUUxQyxNQUFNLFVBQVUsR0FBc0IsRUFBRSxDQUFDO2dCQUN6QyxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO2dCQUM5RCxJQUFJLGVBQWUsR0FBbUMsSUFBSSxDQUFDO2dCQUUzRCxLQUFLLE1BQU0sTUFBTSxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUU7b0JBQ3RDLFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRTt3QkFDbkIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDO3dCQUN2QyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUMvQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUMvQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQzs0QkFDcEMsTUFBTSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLEdBQUcscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7NEJBQ3BFLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7NEJBQzNCLElBQUksSUFBSTtnQ0FBRSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDOzRCQUNwRCxTQUFTO3lCQUNWO3dCQUNELEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQzs0QkFDOUIsTUFBTSxJQUFJLEdBQUcsTUFBbUMsQ0FBQzs0QkFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO2dDQUFFLE1BQU07NEJBQ3RCLE1BQU0sQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLEdBQzdCLG9CQUFvQixDQUFDLE1BQW1DLENBQUMsQ0FBQzs0QkFDOUQsZUFBZSxHQUFHLGNBQWMsQ0FBQzs0QkFDakMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzs0QkFDM0IsU0FBUzt5QkFDVjt3QkFDRDs0QkFDRSxNQUFNO3FCQUNUO29CQUNELFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQzlEO2dCQUNELE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO2dCQUU5QyxNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxnQkFBZ0IsR0FBbUIsRUFBRSxDQUFDO2dCQUM1QyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtvQkFDbEMsSUFBSSxXQUFXLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxFQUFFO3dCQUN2QyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7cUJBQ3BGO3lCQUFNO3dCQUNMLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztxQkFDbEM7aUJBQ0Y7Z0JBRUQsTUFBTSxtQkFBbUIsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUUxRCxJQUFJLGlCQUFpQixDQUFDLE1BQU0sRUFBRTtvQkFDNUIsVUFBVSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7aUJBQ2xFO2dCQUNELElBQUksZUFBZSxFQUFFO29CQUNuQixJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFO3dCQUNsRixrRkFBa0Y7d0JBQ2xGLHVCQUF1Qjt3QkFDdkIsVUFBVSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FDN0MsV0FBVyxFQUFFLHNCQUFzQixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7cUJBQzVEO2lCQUNGO2dCQUNELElBQUksbUJBQW1CLENBQUMsSUFBSSxFQUFFO29CQUM1QixVQUFVLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7aUJBQ3RGO2dCQUNELG1CQUFtQixDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsWUFBWSxDQUN6QyxFQUFFLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFDNUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2QixtQkFBbUIsQ0FBQyxVQUFVO29CQUMxQixnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUMvRSxPQUFPLG1CQUFtQixDQUFDO1lBQzdCLENBQUM7WUFFRCxTQUFTLE9BQU8sQ0FBQyxJQUFhO2dCQUM1QixRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7b0JBQ2pCLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQzt3QkFDN0IsbUJBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7d0JBQzFELE9BQU8sRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUNsRDtvQkFDRCxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQzt3QkFDcEMsTUFBTSxPQUFPLEdBQUcsSUFBNEIsQ0FBQzt3QkFDN0MsSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFOzRCQUN4QixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDOzRCQUMxQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7NEJBQ2pCLElBQUksWUFBWSxDQUFDLElBQUksRUFBRTtnQ0FDckIsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7NkJBQy9COzRCQUNELElBQUksWUFBWSxDQUFDLGFBQWE7Z0NBQzFCLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxFQUFFO2dDQUNsRSxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsYUFBZ0MsQ0FBQztnQ0FDbkUsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7NkJBQ3ZEOzRCQUNELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO2dDQUN4QixNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFFLENBQUM7Z0NBQ25ELG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7NkJBQ3BDO3lCQUNGO3dCQUNELE9BQU8sRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUNsRDtvQkFDRCxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzt3QkFDbkMsT0FBTyx5QkFBeUIsQ0FBQyxJQUEyQixDQUFDLENBQUM7cUJBQy9EO29CQUNEO3dCQUNFLE9BQU8saUNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2lCQUNqRDtZQUNILENBQUM7WUFFRCxPQUFPLENBQUMsRUFBaUIsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBa0IsQ0FBQztRQUM3RCxDQUFDLENBQUM7SUFDSixDQUFDO0lBaFBELHNFQWdQQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IERlY29yYXRvciBkb3dubGV2ZWxpbmcgc3VwcG9ydC4gdHNpY2tsZSBjYW4gb3B0aW9uYWxseSBjb252ZXJ0IGRlY29yYXRvciBjYWxsc1xuICogaW50byBhbm5vdGF0aW9ucy4gRm9yIGV4YW1wbGUsIGEgZGVjb3JhdG9yIGFwcGxpY2F0aW9uIG9uIGEgbWV0aG9kOlxuICogICBjbGFzcyBYIHtcbiAqICAgICBARm9vKDEsIDIpXG4gKiAgICAgYmFyKCkgeyAuLi4gfVxuICogICB9XG4gKiBXaWxsIGdldCBjb252ZXJ0ZWQgdG86XG4gKiAgIGNsYXNzIFgge1xuICogICAgIGJhcigpIHsgLi4uIH1cbiAqICAgICBzdGF0aWMgcHJvcERlY29yYXRvcnMgPSB7XG4gKiAgICAgICBiYXI6IHt0eXBlOiBGb28sIGFyZ3M6IFsxLCAyXX1cbiAqICAgICB9XG4gKiAgIH1cbiAqIFNpbWlsYXJseSBmb3IgZGVjb3JhdG9ycyBvbiB0aGUgY2xhc3MgKHByb3BlcnR5ICdkZWNvcmF0b3JzJykgYW5kIGRlY29yYXRvcnMgb24gdGhlIGNvbnN0cnVjdG9yXG4gKiAocHJvcGVydHkgJ2N0b3JQYXJhbWV0ZXJzJywgaW5jbHVkaW5nIHRoZSB0eXBlcyBvZiBhbGwgYXJndW1lbnRzIG9mIHRoZSBjb25zdHJ1Y3RvcikuXG4gKlxuICogVGhpcyBpcyB1c2VkIGJ5LCBhbW9uZyBvdGhlciBzb2Z0d2FyZSwgQW5ndWxhciBpbiBpdHMgXCJub24tQW9UXCIgbW9kZSB0byBpbnNwZWN0IGRlY29yYXRvclxuICogaW52b2NhdGlvbnMuXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Z2V0RGVjb3JhdG9yRGVjbGFyYXRpb25zfSBmcm9tICcuL2RlY29yYXRvcnMnO1xuaW1wb3J0IHtnZXRBbGxMZWFkaW5nQ29tbWVudHMsIHZpc2l0RWFjaENoaWxkfSBmcm9tICcuL3RyYW5zZm9ybWVyX3V0aWwnO1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gZGVjb3JhdG9yIHNob3VsZCBiZSBkb3dubGV2ZWxlZC5cbiAqXG4gKiBEZWNvcmF0b3JzIHRoYXQgaGF2ZSBKU0RvYyBvbiB0aGVtIGluY2x1ZGluZyB0aGUgYEBBbm5vdGF0aW9uYCB0YWcgYXJlIGRvd25sZXZlbGVkIGFuZCBjb252ZXJ0ZWRcbiAqIGludG8gcHJvcGVydGllcyBvbiB0aGUgY2xhc3MgYnkgdGhpcyBwYXNzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkTG93ZXIoZGVjb3JhdG9yOiB0cy5EZWNvcmF0b3IsIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcikge1xuICBmb3IgKGNvbnN0IGQgb2YgZ2V0RGVjb3JhdG9yRGVjbGFyYXRpb25zKGRlY29yYXRvciwgdHlwZUNoZWNrZXIpKSB7XG4gICAgLy8gVE9ETyhsdWNhc3Nsb2FuKTpcbiAgICAvLyBTd2l0Y2ggdG8gdGhlIFRTIEpTRG9jIHBhcnNlciBpbiB0aGUgZnV0dXJlIHRvIGF2b2lkIGZhbHNlIHBvc2l0aXZlcyBoZXJlLlxuICAgIC8vIEZvciBleGFtcGxlIHVzaW5nICdAQW5ub3RhdGlvbicgaW4gYSB0cnVlIGNvbW1lbnQuXG4gICAgLy8gSG93ZXZlciwgYSBuZXcgVFMgQVBJIHdvdWxkIGJlIG5lZWRlZCwgdHJhY2sgYXRcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzczOTMuXG4gICAgbGV0IGNvbW1lbnROb2RlOiB0cy5Ob2RlID0gZDtcbiAgICAvLyBOb3QgaGFuZGxpbmcgUHJvcGVydHlBY2Nlc3MgZXhwcmVzc2lvbnMgaGVyZSwgYmVjYXVzZSB0aGV5IGFyZVxuICAgIC8vIGZpbHRlcmVkIGVhcmxpZXIuXG4gICAgaWYgKGNvbW1lbnROb2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuVmFyaWFibGVEZWNsYXJhdGlvbikge1xuICAgICAgaWYgKCFjb21tZW50Tm9kZS5wYXJlbnQpIGNvbnRpbnVlO1xuICAgICAgY29tbWVudE5vZGUgPSBjb21tZW50Tm9kZS5wYXJlbnQ7XG4gICAgfVxuICAgIC8vIEdvIHVwIG9uZSBtb3JlIGxldmVsIHRvIFZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQsIHdoZXJlIHVzdWFsbHlcbiAgICAvLyB0aGUgY29tbWVudCBsaXZlcy4gSWYgdGhlIGRlY2xhcmF0aW9uIGhhcyBhbiAnZXhwb3J0JywgdGhlXG4gICAgLy8gVkRMaXN0LmdldEZ1bGxUZXh0IHdpbGwgbm90IGNvbnRhaW4gdGhlIGNvbW1lbnQuXG4gICAgaWYgKGNvbW1lbnROb2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuVmFyaWFibGVEZWNsYXJhdGlvbkxpc3QpIHtcbiAgICAgIGlmICghY29tbWVudE5vZGUucGFyZW50KSBjb250aW51ZTtcbiAgICAgIGNvbW1lbnROb2RlID0gY29tbWVudE5vZGUucGFyZW50O1xuICAgIH1cbiAgICBjb25zdCByYW5nZSA9IGdldEFsbExlYWRpbmdDb21tZW50cyhjb21tZW50Tm9kZSk7XG4gICAgaWYgKCFyYW5nZSkgY29udGludWU7XG4gICAgZm9yIChjb25zdCB7dGV4dH0gb2YgcmFuZ2UpIHtcbiAgICAgIGlmICh0ZXh0LmluY2x1ZGVzKCdAQW5ub3RhdGlvbicpKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIEFTVCBmb3IgdGhlIGRlY29yYXRvciBmaWVsZCB0eXBlIGFubm90YXRpb24sIHdoaWNoIGhhcyB0aGUgZm9ybVxuICogICAgIHsgdHlwZTogRnVuY3Rpb24sIGFyZ3M/OiBhbnlbXSB9W11cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVjb3JhdG9ySW52b2NhdGlvblR5cGUoKTogdHMuVHlwZU5vZGUge1xuICBjb25zdCB0eXBlRWxlbWVudHM6IHRzLlR5cGVFbGVtZW50W10gPSBbXTtcbiAgdHlwZUVsZW1lbnRzLnB1c2godHMuY3JlYXRlUHJvcGVydHlTaWduYXR1cmUoXG4gICAgICB1bmRlZmluZWQsICd0eXBlJywgdW5kZWZpbmVkLFxuICAgICAgdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUodHMuY3JlYXRlSWRlbnRpZmllcignRnVuY3Rpb24nKSwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkKSk7XG4gIHR5cGVFbGVtZW50cy5wdXNoKHRzLmNyZWF0ZVByb3BlcnR5U2lnbmF0dXJlKFxuICAgICAgdW5kZWZpbmVkLCAnYXJncycsIHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuUXVlc3Rpb25Ub2tlbiksXG4gICAgICB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKSwgdW5kZWZpbmVkKSk7XG4gIHJldHVybiB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZSh0eXBlRWxlbWVudHMpKTtcbn1cblxuLyoqXG4gKiBFeHRyYWN0cyB0aGUgdHlwZSBvZiB0aGUgZGVjb3JhdG9yICh0aGUgZnVuY3Rpb24gb3IgZXhwcmVzc2lvbiBpbnZva2VkKSwgYXMgd2VsbCBhcyBhbGwgdGhlXG4gKiBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBkZWNvcmF0b3IuIFJldHVybnMgYW4gQVNUIHdpdGggdGhlIGZvcm06XG4gKlxuICogICAgIC8vIEZvciBAZGVjb3JhdG9yKGFyZzEsIGFyZzIpXG4gKiAgICAgeyB0eXBlOiBkZWNvcmF0b3IsIGFyZ3M6IFthcmcxLCBhcmcyXSB9XG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RNZXRhZGF0YUZyb21TaW5nbGVEZWNvcmF0b3IoXG4gICAgZGVjb3JhdG9yOiB0cy5EZWNvcmF0b3IsIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10pOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbiB7XG4gIGNvbnN0IG1ldGFkYXRhUHJvcGVydGllczogdHMuT2JqZWN0TGl0ZXJhbEVsZW1lbnRMaWtlW10gPSBbXTtcbiAgY29uc3QgZXhwciA9IGRlY29yYXRvci5leHByZXNzaW9uO1xuICBzd2l0Y2ggKGV4cHIua2luZCkge1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5JZGVudGlmaWVyOlxuICAgICAgLy8gVGhlIGRlY29yYXRvciB3YXMgYSBwbGFpbiBARm9vLlxuICAgICAgbWV0YWRhdGFQcm9wZXJ0aWVzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KCd0eXBlJywgZXhwcikpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkNhbGxFeHByZXNzaW9uOlxuICAgICAgLy8gVGhlIGRlY29yYXRvciB3YXMgYSBjYWxsLCBsaWtlIEBGb28oYmFyKS5cbiAgICAgIGNvbnN0IGNhbGwgPSBleHByIGFzIHRzLkNhbGxFeHByZXNzaW9uO1xuICAgICAgbWV0YWRhdGFQcm9wZXJ0aWVzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KCd0eXBlJywgY2FsbC5leHByZXNzaW9uKSk7XG4gICAgICBpZiAoY2FsbC5hcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGFyZ3M6IHRzLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGFyZyBvZiBjYWxsLmFyZ3VtZW50cykge1xuICAgICAgICAgIGFyZ3MucHVzaChhcmcpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFyZ3NBcnJheUxpdGVyYWwgPSB0cy5jcmVhdGVBcnJheUxpdGVyYWwoYXJncyk7XG4gICAgICAgIGFyZ3NBcnJheUxpdGVyYWwuZWxlbWVudHMuaGFzVHJhaWxpbmdDb21tYSA9IHRydWU7XG4gICAgICAgIG1ldGFkYXRhUHJvcGVydGllcy5wdXNoKHRzLmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudCgnYXJncycsIGFyZ3NBcnJheUxpdGVyYWwpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKHtcbiAgICAgICAgZmlsZTogZGVjb3JhdG9yLmdldFNvdXJjZUZpbGUoKSxcbiAgICAgICAgc3RhcnQ6IGRlY29yYXRvci5nZXRTdGFydCgpLFxuICAgICAgICBsZW5ndGg6IGRlY29yYXRvci5nZXRFbmQoKSAtIGRlY29yYXRvci5nZXRTdGFydCgpLFxuICAgICAgICBtZXNzYWdlVGV4dDpcbiAgICAgICAgICAgIGAke3RzLlN5bnRheEtpbmRbZGVjb3JhdG9yLmtpbmRdfSBub3QgaW1wbGVtZW50ZWQgaW4gZ2F0aGVyaW5nIGRlY29yYXRvciBtZXRhZGF0YWAsXG4gICAgICAgIGNhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsXG4gICAgICAgIGNvZGU6IDAsXG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHJldHVybiB0cy5jcmVhdGVPYmplY3RMaXRlcmFsKG1ldGFkYXRhUHJvcGVydGllcyk7XG59XG5cbi8qKlxuICogVGFrZXMgYSBsaXN0IG9mIGRlY29yYXRvciBtZXRhZGF0YSBvYmplY3QgQVNUcyBhbmQgcHJvZHVjZXMgYW4gQVNUIGZvciBhXG4gKiBzdGF0aWMgY2xhc3MgcHJvcGVydHkgb2YgYW4gYXJyYXkgb2YgdGhvc2UgbWV0YWRhdGEgb2JqZWN0cy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVjb3JhdG9yQ2xhc3NQcm9wZXJ0eShkZWNvcmF0b3JMaXN0OiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IG1vZGlmaWVyID0gdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZURlY29yYXRvckludm9jYXRpb25UeXBlKCk7XG4gIGNvbnN0IGluaXRpYWxpemVyID0gdHMuY3JlYXRlQXJyYXlMaXRlcmFsKGRlY29yYXRvckxpc3QsIHRydWUpO1xuICBpbml0aWFsaXplci5lbGVtZW50cy5oYXNUcmFpbGluZ0NvbW1hID0gdHJ1ZTtcbiAgY29uc3QgcHJvcCA9IHRzLmNyZWF0ZVByb3BlcnR5KHVuZGVmaW5lZCwgW21vZGlmaWVyXSwgJ2RlY29yYXRvcnMnLCB1bmRlZmluZWQsIHR5cGUsIGluaXRpYWxpemVyKTtcbiAgLy8gTkI6IHRoZSAuZGVjb3JhdG9ycyBwcm9wZXJ0eSBkb2VzIG5vdCBnZXQgYSBAbm9jb2xsYXBzZSBwcm9wZXJ0eS4gVGhlcmUgaXNcbiAgLy8gbm8gZ29vZCByZWFzb24gd2h5IC0gaXQgbWVhbnMgLmRlY29yYXRvcnMgaXMgbm90IHJ1bnRpbWUgYWNjZXNzaWJsZSBpZiB5b3VcbiAgLy8gY29tcGlsZSB3aXRoIGNvbGxhcHNlIHByb3BlcnRpZXMsIHdoZXJlYXMgcHJvcERlY29yYXRvcnMgaXMsIHdoaWNoIGRvZXNuJ3RcbiAgLy8gZm9sbG93IGFueSBzdHJpbmdlbnQgbG9naWMuIEhvd2V2ZXIgdGhpcyBoYXMgYmVlbiB0aGUgY2FzZSBwcmV2aW91c2x5LCBhbmRcbiAgLy8gYWRkaW5nIGl0IGJhY2sgaW4gbGVhZHMgdG8gc3Vic3RhbnRpYWwgY29kZSBzaXplIGluY3JlYXNlcyBhcyBDbG9zdXJlIGZhaWxzXG4gIC8vIHRvIHRyZWUgc2hha2UgdGhlc2UgcHJvcHMgd2l0aG91dCBAbm9jb2xsYXBzZS5cbiAgcmV0dXJuIHByb3A7XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgQVNUIGZvciB0aGUgJ2N0b3JQYXJhbWV0ZXJzJyBmaWVsZCB0eXBlIGFubm90YXRpb246XG4gKiAgICgpID0+ICh7IHR5cGU6IGFueSwgZGVjb3JhdG9ycz86IHt0eXBlOiBGdW5jdGlvbiwgYXJncz86IGFueVtdfVtdIH18bnVsbClbXVxuICovXG5mdW5jdGlvbiBjcmVhdGVDdG9yUGFyYW1ldGVyc0NsYXNzUHJvcGVydHlUeXBlKCk6IHRzLlR5cGVOb2RlIHtcbiAgLy8gU29ycnkgYWJvdXQgdGhpcy4gVHJ5IHJlYWRpbmcganVzdCB0aGUgc3RyaW5nIGxpdGVyYWxzIGJlbG93LlxuICBjb25zdCB0eXBlRWxlbWVudHM6IHRzLlR5cGVFbGVtZW50W10gPSBbXTtcbiAgdHlwZUVsZW1lbnRzLnB1c2godHMuY3JlYXRlUHJvcGVydHlTaWduYXR1cmUoXG4gICAgICB1bmRlZmluZWQsICd0eXBlJywgdW5kZWZpbmVkLFxuICAgICAgdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUodHMuY3JlYXRlSWRlbnRpZmllcignYW55JyksIHVuZGVmaW5lZCksIHVuZGVmaW5lZCkpO1xuICB0eXBlRWxlbWVudHMucHVzaCh0cy5jcmVhdGVQcm9wZXJ0eVNpZ25hdHVyZShcbiAgICAgIHVuZGVmaW5lZCwgJ2RlY29yYXRvcnMnLCB0cy5jcmVhdGVUb2tlbih0cy5TeW50YXhLaW5kLlF1ZXN0aW9uVG9rZW4pLFxuICAgICAgdHMuY3JlYXRlQXJyYXlUeXBlTm9kZSh0cy5jcmVhdGVUeXBlTGl0ZXJhbE5vZGUoW1xuICAgICAgICB0cy5jcmVhdGVQcm9wZXJ0eVNpZ25hdHVyZShcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgJ3R5cGUnLCB1bmRlZmluZWQsXG4gICAgICAgICAgICB0cy5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZSh0cy5jcmVhdGVJZGVudGlmaWVyKCdGdW5jdGlvbicpLCB1bmRlZmluZWQpLCB1bmRlZmluZWQpLFxuICAgICAgICB0cy5jcmVhdGVQcm9wZXJ0eVNpZ25hdHVyZShcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgJ2FyZ3MnLCB0cy5jcmVhdGVUb2tlbih0cy5TeW50YXhLaW5kLlF1ZXN0aW9uVG9rZW4pLFxuICAgICAgICAgICAgdHMuY3JlYXRlQXJyYXlUeXBlTm9kZShcbiAgICAgICAgICAgICAgICB0cy5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZSh0cy5jcmVhdGVJZGVudGlmaWVyKCdhbnknKSwgdW5kZWZpbmVkKSksXG4gICAgICAgICAgICB1bmRlZmluZWQpLFxuICAgICAgXSkpLFxuICAgICAgdW5kZWZpbmVkKSk7XG4gIHJldHVybiB0cy5jcmVhdGVGdW5jdGlvblR5cGVOb2RlKFxuICAgICAgdW5kZWZpbmVkLCBbXSxcbiAgICAgIHRzLmNyZWF0ZUFycmF5VHlwZU5vZGUoXG4gICAgICAgICAgdHMuY3JlYXRlVW5pb25UeXBlTm9kZShbdHMuY3JlYXRlVHlwZUxpdGVyYWxOb2RlKHR5cGVFbGVtZW50cyksIHRzLmNyZWF0ZU51bGwoKV0pKSk7XG59XG5cbi8qKlxuICogU2V0cyBhIENsb3N1cmUgXFxAbm9jb2xsYXBzZSBzeW50aGV0aWMgY29tbWVudCBvbiB0aGUgZ2l2ZW4gbm9kZS4gVGhpcyBwcmV2ZW50cyBDbG9zdXJlIENvbXBpbGVyXG4gKiBmcm9tIGNvbGxhcHNpbmcgdGhlIGFwcGFyZW50bHkgc3RhdGljIHByb3BlcnR5LCB3aGljaCB3b3VsZCBtYWtlIGl0IGltcG9zc2libGUgdG8gZmluZCBmb3IgY29kZVxuICogdHJ5aW5nIHRvIGRldGVjdCBpdCBhdCBydW50aW1lLlxuICovXG5mdW5jdGlvbiBhZGROb0NvbGxhcHNlQ29tbWVudChuOiB0cy5Ob2RlKSB7XG4gIHRzLnNldFN5bnRoZXRpY0xlYWRpbmdDb21tZW50cyhuLCBbe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBraW5kOiB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQ6ICcqIEBub2NvbGxhcHNlICcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvczogLTEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZDogLTEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhc1RyYWlsaW5nTmV3TGluZTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfV0pO1xufVxuXG4vKipcbiAqIGNyZWF0ZUN0b3JQYXJhbWV0ZXJzQ2xhc3NQcm9wZXJ0eSBjcmVhdGVzIGEgc3RhdGljICdjdG9yUGFyYW1ldGVycycgcHJvcGVydHkgY29udGFpbmluZ1xuICogZG93bmxldmVsZWQgZGVjb3JhdG9yIGluZm9ybWF0aW9uLlxuICpcbiAqIFRoZSBwcm9wZXJ0eSBjb250YWlucyBhbiBhcnJvdyBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gYXJyYXkgb2Ygb2JqZWN0IGxpdGVyYWxzIG9mIHRoZSBzaGFwZTpcbiAqICAgICBzdGF0aWMgY3RvclBhcmFtZXRlcnMgPSAoKSA9PiBbe1xuICogICAgICAgdHlwZTogU29tZUNsYXNzfHVuZGVmaW5lZCwgIC8vIHRoZSB0eXBlIG9mIHRoZSBwYXJhbSB0aGF0J3MgZGVjb3JhdGVkLCBpZiBpdCdzIGEgdmFsdWUuXG4gKiAgICAgICBkZWNvcmF0b3JzOiBbe1xuICogICAgICAgICB0eXBlOiBEZWNvcmF0b3JGbiwgIC8vIHRoZSB0eXBlIG9mIHRoZSBkZWNvcmF0b3IgdGhhdCdzIGludm9rZWQuXG4gKiAgICAgICAgIGFyZ3M6IFtBUkdTXSwgICAgICAgLy8gdGhlIGFyZ3VtZW50cyBwYXNzZWQgdG8gdGhlIGRlY29yYXRvci5cbiAqICAgICAgIH1dXG4gKiAgICAgfV07XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUN0b3JQYXJhbWV0ZXJzQ2xhc3NQcm9wZXJ0eShcbiAgICBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdLFxuICAgIGVudGl0eU5hbWVUb0V4cHJlc3Npb246IChuOiB0cy5FbnRpdHlOYW1lKSA9PiB0cy5FeHByZXNzaW9uIHwgdW5kZWZpbmVkLFxuXG4gICAgY3RvclBhcmFtZXRlcnM6IFBhcmFtZXRlckRlY29yYXRpb25JbmZvW10pOiB0cy5Qcm9wZXJ0eURlY2xhcmF0aW9uIHtcbiAgY29uc3QgcGFyYW1zOiB0cy5FeHByZXNzaW9uW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IGN0b3JQYXJhbSBvZiBjdG9yUGFyYW1ldGVycykge1xuICAgIGlmICghY3RvclBhcmFtLnR5cGUgJiYgY3RvclBhcmFtLmRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBwYXJhbXMucHVzaCh0cy5jcmVhdGVOdWxsKCkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1UeXBlID0gY3RvclBhcmFtLnR5cGUgP1xuICAgICAgICB0eXBlUmVmZXJlbmNlVG9FeHByZXNzaW9uKGVudGl0eU5hbWVUb0V4cHJlc3Npb24sIGN0b3JQYXJhbS50eXBlKSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICBjb25zdCBtZW1iZXJzID1cbiAgICAgICAgW3RzLmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudCgndHlwZScsIHBhcmFtVHlwZSB8fCB0cy5jcmVhdGVJZGVudGlmaWVyKCd1bmRlZmluZWQnKSldO1xuXG4gICAgY29uc3QgZGVjb3JhdG9yczogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGZvciAoY29uc3QgZGVjbyBvZiBjdG9yUGFyYW0uZGVjb3JhdG9ycykge1xuICAgICAgZGVjb3JhdG9ycy5wdXNoKGV4dHJhY3RNZXRhZGF0YUZyb21TaW5nbGVEZWNvcmF0b3IoZGVjbywgZGlhZ25vc3RpY3MpKTtcbiAgICB9XG4gICAgaWYgKGRlY29yYXRvcnMubGVuZ3RoKSB7XG4gICAgICBtZW1iZXJzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KCdkZWNvcmF0b3JzJywgdHMuY3JlYXRlQXJyYXlMaXRlcmFsKGRlY29yYXRvcnMpKSk7XG4gICAgfVxuICAgIHBhcmFtcy5wdXNoKHRzLmNyZWF0ZU9iamVjdExpdGVyYWwobWVtYmVycykpO1xuICB9XG5cbiAgY29uc3QgaW5pdGlhbGl6ZXIgPSB0cy5jcmVhdGVBcnJvd0Z1bmN0aW9uKFxuICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFtdLCB1bmRlZmluZWQsIHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuRXF1YWxzR3JlYXRlclRoYW5Ub2tlbiksXG4gICAgICB0cy5jcmVhdGVBcnJheUxpdGVyYWwocGFyYW1zLCB0cnVlKSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVDdG9yUGFyYW1ldGVyc0NsYXNzUHJvcGVydHlUeXBlKCk7XG4gIGNvbnN0IGN0b3JQcm9wID0gdHMuY3JlYXRlUHJvcGVydHkoXG4gICAgICB1bmRlZmluZWQsIFt0cy5jcmVhdGVUb2tlbih0cy5TeW50YXhLaW5kLlN0YXRpY0tleXdvcmQpXSwgJ2N0b3JQYXJhbWV0ZXJzJywgdW5kZWZpbmVkLCB0eXBlLFxuICAgICAgaW5pdGlhbGl6ZXIpO1xuICBhZGROb0NvbGxhcHNlQ29tbWVudChjdG9yUHJvcCk7XG4gIHJldHVybiBjdG9yUHJvcDtcbn1cblxuLyoqXG4gKiBjcmVhdGVQcm9wRGVjb3JhdG9yc0NsYXNzUHJvcGVydHkgY3JlYXRlcyBhIHN0YXRpYyAncHJvcERlY29yYXRvcnMnIHByb3BlcnR5IGNvbnRhaW5pbmcgdHlwZVxuICogaW5mb3JtYXRpb24gZm9yIGV2ZXJ5IHByb3BlcnR5IHRoYXQgaGFzIGEgZGVjb3JhdG9yIGFwcGxpZWQuXG4gKlxuICogICAgIHN0YXRpYyBwcm9wRGVjb3JhdG9yczoge1trZXk6IHN0cmluZ106IHt0eXBlOiBGdW5jdGlvbiwgYXJncz86IGFueVtdfVtdfSA9IHtcbiAqICAgICAgIHByb3BBOiBbe3R5cGU6IE15RGVjb3JhdG9yLCBhcmdzOiBbMSwgMl19LCAuLi5dLFxuICogICAgICAgLi4uXG4gKiAgICAgfTtcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUHJvcERlY29yYXRvcnNDbGFzc1Byb3BlcnR5KFxuICAgIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10sIHByb3BlcnRpZXM6IE1hcDxzdHJpbmcsIHRzLkRlY29yYXRvcltdPik6IHRzLlByb3BlcnR5RGVjbGFyYXRpb24ge1xuICAvLyAgYHN0YXRpYyBwcm9wRGVjb3JhdG9yczoge1trZXk6IHN0cmluZ106IGAgKyB7dHlwZTogRnVuY3Rpb24sIGFyZ3M/OiBhbnlbXX1bXSArIGB9ID0ge1xcbmApO1xuICBjb25zdCBlbnRyaWVzOiB0cy5PYmplY3RMaXRlcmFsRWxlbWVudExpa2VbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBkZWNvcmF0b3JzXSBvZiBwcm9wZXJ0aWVzLmVudHJpZXMoKSkge1xuICAgIGVudHJpZXMucHVzaCh0cy5jcmVhdGVQcm9wZXJ0eUFzc2lnbm1lbnQoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIHRzLmNyZWF0ZUFycmF5TGl0ZXJhbChcbiAgICAgICAgICAgIGRlY29yYXRvcnMubWFwKGRlY28gPT4gZXh0cmFjdE1ldGFkYXRhRnJvbVNpbmdsZURlY29yYXRvcihkZWNvLCBkaWFnbm9zdGljcykpKSkpO1xuICB9XG4gIGNvbnN0IGluaXRpYWxpemVyID0gdHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChlbnRyaWVzLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZShbdHMuY3JlYXRlSW5kZXhTaWduYXR1cmUoXG4gICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgW3RzLmNyZWF0ZVBhcmFtZXRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgJ2tleScsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUoJ3N0cmluZycsIHVuZGVmaW5lZCksIHVuZGVmaW5lZCldLFxuICAgICAgY3JlYXRlRGVjb3JhdG9ySW52b2NhdGlvblR5cGUoKSldKTtcbiAgcmV0dXJuIHRzLmNyZWF0ZVByb3BlcnR5KFxuICAgICAgdW5kZWZpbmVkLCBbdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKV0sICdwcm9wRGVjb3JhdG9ycycsIHVuZGVmaW5lZCwgdHlwZSxcbiAgICAgIGluaXRpYWxpemVyKTtcbn1cblxuZnVuY3Rpb24gaXNOYW1lRXF1YWwoY2xhc3NNZW1iZXI6IHRzLkNsYXNzRWxlbWVudCwgbmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChjbGFzc01lbWJlci5uYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgaWQgPSBjbGFzc01lbWJlci5uYW1lIGFzIHRzLklkZW50aWZpZXI7XG4gIHJldHVybiBpZC50ZXh0ID09PSBuYW1lO1xufVxuXG4vKipcbiAqIFJldHVybnMgYW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIChwb3RlbnRpYWxseSkgdmFsdWUgcGFydCBmb3IgdGhlIGdpdmVuIG5vZGUuXG4gKlxuICogVGhpcyBpcyBhIHBhcnRpYWwgcmUtaW1wbGVtZW50YXRpb24gb2YgVHlwZVNjcmlwdCdzIHNlcmlhbGl6ZVR5cGVSZWZlcmVuY2VOb2RlLiBUaGlzIGlzIGFcbiAqIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMTc1MTYgKHNlcmlhbGl6ZVR5cGVSZWZlcmVuY2VOb2RlXG4gKiBub3QgYmVpbmcgZXhwb3NlZCkuIEluIHByYWN0aWNlIHRoaXMgaW1wbGVtZW50YXRpb24gaXMgc3VmZmljaWVudCBmb3IgQW5ndWxhcidzIHVzZSBvZiB0eXBlXG4gKiBtZXRhZGF0YS5cbiAqL1xuZnVuY3Rpb24gdHlwZVJlZmVyZW5jZVRvRXhwcmVzc2lvbihcbiAgICBlbnRpdHlOYW1lVG9FeHByZXNzaW9uOiAobjogdHMuRW50aXR5TmFtZSkgPT4gdHMuRXhwcmVzc2lvbiB8IHVuZGVmaW5lZCxcbiAgICBub2RlOiB0cy5UeXBlTm9kZSk6IHRzLkV4cHJlc3Npb258dW5kZWZpbmVkIHtcbiAgbGV0IGtpbmQgPSBub2RlLmtpbmQ7XG4gIGlmICh0cy5pc0xpdGVyYWxUeXBlTm9kZShub2RlKSkge1xuICAgIC8vIFRyZWF0IGxpdGVyYWwgdHlwZXMgbGlrZSB0aGVpciBiYXNlIHR5cGUgKGJvb2xlYW4sIHN0cmluZywgbnVtYmVyKS5cbiAgICBraW5kID0gbm9kZS5saXRlcmFsLmtpbmQ7XG4gIH1cbiAgc3dpdGNoIChraW5kKSB7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkZ1bmN0aW9uVHlwZTpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ29uc3RydWN0b3JUeXBlOlxuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ0Z1bmN0aW9uJyk7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkFycmF5VHlwZTpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuVHVwbGVUeXBlOlxuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ0FycmF5Jyk7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlR5cGVQcmVkaWNhdGU6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlRydWVLZXl3b3JkOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5GYWxzZUtleXdvcmQ6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkJvb2xlYW5LZXl3b3JkOlxuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ0Jvb2xlYW4nKTtcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuU3RyaW5nTGl0ZXJhbDpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuU3RyaW5nS2V5d29yZDpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKCdTdHJpbmcnKTtcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuT2JqZWN0S2V5d29yZDpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKCdPYmplY3QnKTtcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuTnVtYmVyS2V5d29yZDpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuTnVtZXJpY0xpdGVyYWw6XG4gICAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcignTnVtYmVyJyk7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlR5cGVSZWZlcmVuY2U6XG4gICAgICBjb25zdCB0eXBlUmVmID0gbm9kZSBhcyB0cy5UeXBlUmVmZXJlbmNlTm9kZTtcbiAgICAgIC8vIElnbm9yZSBhbnkgZ2VuZXJpYyB0eXBlcywganVzdCByZXR1cm4gdGhlIGJhc2UgdHlwZS5cbiAgICAgIHJldHVybiBlbnRpdHlOYW1lVG9FeHByZXNzaW9uKHR5cGVSZWYudHlwZU5hbWUpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8qKiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mbyBkZXNjcmliZXMgdGhlIGluZm9ybWF0aW9uIGZvciBhIHNpbmdsZSBjb25zdHJ1Y3RvciBwYXJhbWV0ZXIuICovXG5pbnRlcmZhY2UgUGFyYW1ldGVyRGVjb3JhdGlvbkluZm8ge1xuICAvKipcbiAgICogVGhlIHR5cGUgZGVjbGFyYXRpb24gZm9yIHRoZSBwYXJhbWV0ZXIuIE9ubHkgc2V0IGlmIHRoZSB0eXBlIGlzIGEgdmFsdWUgKGUuZy4gYSBjbGFzcywgbm90IGFuXG4gICAqIGludGVyZmFjZSkuXG4gICAqL1xuICB0eXBlOiB0cy5UeXBlTm9kZXxudWxsO1xuICAvKiogVGhlIGxpc3Qgb2YgZGVjb3JhdG9ycyBmb3VuZCBvbiB0aGUgcGFyYW1ldGVyLCBudWxsIGlmIG5vbmUuICovXG4gIGRlY29yYXRvcnM6IHRzLkRlY29yYXRvcltdO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybWVyIGZhY3RvcnkgZm9yIHRoZSBkZWNvcmF0b3IgZG93bmxldmVsIHRyYW5zZm9ybWVyLiBTZWUgZmlsZW92ZXJ2aWV3IGZvciBkZXRhaWxzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjb3JhdG9yRG93bmxldmVsVHJhbnNmb3JtZXIoXG4gICAgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdKTpcbiAgICAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PiB0cy5UcmFuc2Zvcm1lcjx0cy5Tb3VyY2VGaWxlPiB7XG4gIHJldHVybiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PiB7XG4gICAgLyoqIEEgbWFwIGZyb20gc3ltYm9scyB0byB0aGUgaWRlbnRpZmllciBvZiBhbiBpbXBvcnQsIHJlc2V0IHBlciBTb3VyY2VGaWxlLiAqL1xuICAgIGxldCBpbXBvcnROYW1lc0J5U3ltYm9sID0gbmV3IE1hcDx0cy5TeW1ib2wsIHRzLklkZW50aWZpZXI+KCk7XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBhbiBFbnRpdHlOYW1lIChmcm9tIGEgdHlwZSBhbm5vdGF0aW9uKSB0byBhbiBleHByZXNzaW9uIChhY2Nlc3NpbmcgYSB2YWx1ZSkuXG4gICAgICpcbiAgICAgKiBGb3IgYSBnaXZlbiB0cy5FbnRpdHlOYW1lLCB0aGlzIHdhbGtzIGRlcHRoIGZpcnN0IHRvIGZpbmQgdGhlIGxlZnRtb3N0IHRzLklkZW50aWZpZXIsIHRoZW5cbiAgICAgKiBjb252ZXJ0cyB0aGUgcGF0aCBpbnRvIHByb3BlcnR5IGFjY2Vzc2VzLlxuICAgICAqXG4gICAgICogVGhpcyBnZW5lcmFsbHkgd29ya3MsIGJ1dCBUeXBlU2NyaXB0J3MgZW1pdCBwaXBlbGluZSBkb2VzIG5vdCBzZXJpYWxpemUgaWRlbnRpZmllcnMgdGhhdCBhcmVcbiAgICAgKiBvbmx5IHVzZWQgaW4gYSB0eXBlIGxvY2F0aW9uIChzdWNoIGFzIGlkZW50aWZpZXJzIGluIGEgVHlwZU5vZGUpLCBldmVuIGlmIHRoZSBpZGVudGlmaWVyXG4gICAgICogaXRzZWxmIHBvaW50cyB0byBhIHZhbHVlIChlLmcuIGEgY2xhc3MpLiBUbyBhdm9pZCB0aGF0IHByb2JsZW0sIHRoaXMgbWV0aG9kIGZpbmRzIHRoZSBzeW1ib2xcbiAgICAgKiByZXByZXNlbnRpbmcgdGhlIGlkZW50aWZpZXIgKHVzaW5nIHR5cGVDaGVja2VyKSwgdGhlbiBsb29rcyB1cCB3aGVyZSBpdCB3YXMgaW1wb3J0ZWQgKHVzaW5nXG4gICAgICogaW1wb3J0TmFtZXNCeVN5bWJvbCksIGFuZCB0aGVuIHVzZXMgdGhlIGltcG9ydGVkIG5hbWUgaW5zdGVhZCBvZiB0aGUgaWRlbnRpZmllciBmcm9tIHRoZSB0eXBlXG4gICAgICogZXhwcmVzc2lvbiwgaWYgYW55LiBPdGhlcndpc2UgaXQnbGwgdXNlIHRoZSBpZGVudGlmaWVyIHVuY2hhbmdlZC4gVGhpcyBtYWtlcyBzdXJlIHRoZVxuICAgICAqIGlkZW50aWZpZXIgaXMgbm90IG1hcmtlZCBhcyBzdGVtbWluZyBmcm9tIGEgXCJ0eXBlIG9ubHlcIiBleHByZXNzaW9uLCBjYXVzaW5nIGl0IHRvIGJlIGVtaXR0ZWRcbiAgICAgKiBhbmQgY2F1c2luZyB0aGUgaW1wb3J0IHRvIGJlIHJldGFpbmVkLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGVudGl0eU5hbWVUb0V4cHJlc3Npb24obmFtZTogdHMuRW50aXR5TmFtZSk6IHRzLkV4cHJlc3Npb258dW5kZWZpbmVkIHtcbiAgICAgIGNvbnN0IHN5bSA9IHR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obmFtZSk7XG4gICAgICBpZiAoIXN5bSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIC8vIENoZWNrIGlmIHRoZSBlbnRpdHkgbmFtZSByZWZlcmVuY2VzIGEgc3ltYm9sIHRoYXQgaXMgYW4gYWN0dWFsIHZhbHVlLiBJZiBpdCBpcyBub3QsIGl0XG4gICAgICAvLyBjYW5ub3QgYmUgcmVmZXJlbmNlZCBieSBhbiBleHByZXNzaW9uLCBzbyByZXR1cm4gdW5kZWZpbmVkLlxuICAgICAgbGV0IHN5bVRvQ2hlY2sgPSBzeW07XG4gICAgICBpZiAoc3ltVG9DaGVjay5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLkFsaWFzKSB7XG4gICAgICAgIHN5bVRvQ2hlY2sgPSB0eXBlQ2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHN5bVRvQ2hlY2spO1xuICAgICAgfVxuICAgICAgaWYgKCEoc3ltVG9DaGVjay5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLlZhbHVlKSkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgaWYgKHRzLmlzSWRlbnRpZmllcihuYW1lKSkge1xuICAgICAgICAvLyBJZiB0aGVyZSdzIGEga25vd24gaW1wb3J0IG5hbWUgZm9yIHRoaXMgc3ltYm9sLCB1c2UgaXQgc28gdGhhdCB0aGUgaW1wb3J0IHdpbGwgYmVcbiAgICAgICAgLy8gcmV0YWluZWQgYW5kIHRoZSB2YWx1ZSBjYW4gYmUgcmVmZXJlbmNlZC5cbiAgICAgICAgaWYgKGltcG9ydE5hbWVzQnlTeW1ib2wuaGFzKHN5bSkpIHJldHVybiBpbXBvcnROYW1lc0J5U3ltYm9sLmdldChzeW0pITtcbiAgICAgICAgLy8gT3RoZXJ3aXNlIHRoaXMgd2lsbCBiZSBhIGxvY2FsbHkgZGVjbGFyZWQgbmFtZSwganVzdCByZXR1cm4gdGhhdC5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICB9XG4gICAgICBjb25zdCByZWYgPSBlbnRpdHlOYW1lVG9FeHByZXNzaW9uKG5hbWUubGVmdCk7XG4gICAgICBpZiAoIXJlZikgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhyZWYsIG5hbWUucmlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSBjbGFzcyBlbGVtZW50LiBSZXR1cm5zIGEgdGhyZWUgdHVwbGUgb2YgbmFtZSwgdHJhbnNmb3JtZWQgZWxlbWVudCwgYW5kXG4gICAgICogZGVjb3JhdG9ycyBmb3VuZC4gUmV0dXJucyBhbiB1bmRlZmluZWQgbmFtZSBpZiB0aGVyZSBhcmUgbm8gZGVjb3JhdG9ycyB0byBsb3dlciBvbiB0aGVcbiAgICAgKiBlbGVtZW50LCBvciB0aGUgZWxlbWVudCBoYXMgYW4gZXhvdGljIG5hbWUuXG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtQ2xhc3NFbGVtZW50KGVsZW1lbnQ6IHRzLkNsYXNzRWxlbWVudCk6XG4gICAgICAgIFtzdHJpbmd8dW5kZWZpbmVkLCB0cy5DbGFzc0VsZW1lbnQsIHRzLkRlY29yYXRvcltdXSB7XG4gICAgICBlbGVtZW50ID0gdHMudmlzaXRFYWNoQ2hpbGQoZWxlbWVudCwgdmlzaXRvciwgY29udGV4dCk7XG4gICAgICBjb25zdCBkZWNvcmF0b3JzVG9LZWVwOiB0cy5EZWNvcmF0b3JbXSA9IFtdO1xuICAgICAgY29uc3QgdG9Mb3dlcjogdHMuRGVjb3JhdG9yW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgZGVjb3JhdG9yIG9mIGVsZW1lbnQuZGVjb3JhdG9ycyB8fCBbXSkge1xuICAgICAgICBpZiAoIXNob3VsZExvd2VyKGRlY29yYXRvciwgdHlwZUNoZWNrZXIpKSB7XG4gICAgICAgICAgZGVjb3JhdG9yc1RvS2VlcC5wdXNoKGRlY29yYXRvcik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdG9Mb3dlci5wdXNoKGRlY29yYXRvcik7XG4gICAgICB9XG4gICAgICBpZiAoIXRvTG93ZXIubGVuZ3RoKSByZXR1cm4gW3VuZGVmaW5lZCwgZWxlbWVudCwgW11dO1xuXG4gICAgICBpZiAoIWVsZW1lbnQubmFtZSB8fCBlbGVtZW50Lm5hbWUua2luZCAhPT0gdHMuU3ludGF4S2luZC5JZGVudGlmaWVyKSB7XG4gICAgICAgIC8vIE1ldGhvZCBoYXMgYSB3ZWlyZCBuYW1lLCBlLmcuXG4gICAgICAgIC8vICAgW1N5bWJvbC5mb29dKCkgey4uLn1cbiAgICAgICAgZGlhZ25vc3RpY3MucHVzaCh7XG4gICAgICAgICAgZmlsZTogZWxlbWVudC5nZXRTb3VyY2VGaWxlKCksXG4gICAgICAgICAgc3RhcnQ6IGVsZW1lbnQuZ2V0U3RhcnQoKSxcbiAgICAgICAgICBsZW5ndGg6IGVsZW1lbnQuZ2V0RW5kKCkgLSBlbGVtZW50LmdldFN0YXJ0KCksXG4gICAgICAgICAgbWVzc2FnZVRleHQ6IGBjYW5ub3QgcHJvY2VzcyBkZWNvcmF0b3JzIG9uIHN0cmFuZ2VseSBuYW1lZCBtZXRob2RgLFxuICAgICAgICAgIGNhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsXG4gICAgICAgICAgY29kZTogMCxcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBbdW5kZWZpbmVkLCBlbGVtZW50LCBbXV07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5hbWUgPSAoZWxlbWVudC5uYW1lIGFzIHRzLklkZW50aWZpZXIpLnRleHQ7XG4gICAgICBjb25zdCBtdXRhYmxlID0gdHMuZ2V0TXV0YWJsZUNsb25lKGVsZW1lbnQpO1xuICAgICAgbXV0YWJsZS5kZWNvcmF0b3JzID0gZGVjb3JhdG9yc1RvS2VlcC5sZW5ndGggP1xuICAgICAgICAgIHRzLnNldFRleHRSYW5nZSh0cy5jcmVhdGVOb2RlQXJyYXkoZGVjb3JhdG9yc1RvS2VlcCksIG11dGFibGUuZGVjb3JhdG9ycykgOlxuICAgICAgICAgIHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiBbbmFtZSwgbXV0YWJsZSwgdG9Mb3dlcl07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIGNvbnN0cnVjdG9yLiBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCBjb25zdHJ1Y3RvciBhbmQgdGhlIGxpc3Qgb2YgcGFyYW1ldGVyXG4gICAgICogaW5mb3JtYXRpb24gY29sbGVjdGVkLCBjb25zaXN0aW5nIG9mIGRlY29yYXRvcnMgYW5kIG9wdGlvbmFsIHR5cGUuXG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtQ29uc3RydWN0b3IoY3RvcjogdHMuQ29uc3RydWN0b3JEZWNsYXJhdGlvbik6XG4gICAgICAgIFt0cy5Db25zdHJ1Y3RvckRlY2xhcmF0aW9uLCBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mb1tdXSB7XG4gICAgICBjdG9yID0gdHMudmlzaXRFYWNoQ2hpbGQoY3RvciwgdmlzaXRvciwgY29udGV4dCk7XG5cbiAgICAgIGNvbnN0IG5ld1BhcmFtZXRlcnM6IHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uW10gPSBbXTtcbiAgICAgIGNvbnN0IG9sZFBhcmFtZXRlcnMgPSB0cy52aXNpdFBhcmFtZXRlckxpc3QoY3Rvci5wYXJhbWV0ZXJzLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnNJbmZvOiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mb1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHBhcmFtIG9mIG9sZFBhcmFtZXRlcnMpIHtcbiAgICAgICAgY29uc3QgZGVjb3JhdG9yc1RvS2VlcDogdHMuRGVjb3JhdG9yW10gPSBbXTtcbiAgICAgICAgY29uc3QgcGFyYW1JbmZvOiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mbyA9IHtkZWNvcmF0b3JzOiBbXSwgdHlwZTogbnVsbH07XG5cbiAgICAgICAgZm9yIChjb25zdCBkZWNvcmF0b3Igb2YgcGFyYW0uZGVjb3JhdG9ycyB8fCBbXSkge1xuICAgICAgICAgIGlmICghc2hvdWxkTG93ZXIoZGVjb3JhdG9yLCB0eXBlQ2hlY2tlcikpIHtcbiAgICAgICAgICAgIGRlY29yYXRvcnNUb0tlZXAucHVzaChkZWNvcmF0b3IpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmFtSW5mbyEuZGVjb3JhdG9ycy5wdXNoKGRlY29yYXRvcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmFtLnR5cGUpIHtcbiAgICAgICAgICAvLyBwYXJhbSBoYXMgYSB0eXBlIHByb3ZpZGVkLCBlLmcuIFwiZm9vOiBCYXJcIi5cbiAgICAgICAgICAvLyBUaGUgdHlwZSB3aWxsIGJlIGVtaXR0ZWQgYXMgYSB2YWx1ZSBleHByZXNzaW9uIGluIGVudGl0eU5hbWVUb0V4cHJlc3Npb24sIHdoaWNoIHRha2VzXG4gICAgICAgICAgLy8gY2FyZSBub3QgdG8gZW1pdCBhbnl0aGluZyBmb3IgdHlwZXMgdGhhdCBjYW5ub3QgYmUgZXhwcmVzc2VkIGFzIGEgdmFsdWUgKGUuZy5cbiAgICAgICAgICAvLyBpbnRlcmZhY2VzKS5cbiAgICAgICAgICBwYXJhbUluZm8hLnR5cGUgPSBwYXJhbS50eXBlO1xuICAgICAgICB9XG4gICAgICAgIHBhcmFtZXRlcnNJbmZvLnB1c2gocGFyYW1JbmZvKTtcbiAgICAgICAgY29uc3QgbmV3UGFyYW0gPSB0cy51cGRhdGVQYXJhbWV0ZXIoXG4gICAgICAgICAgICBwYXJhbSxcbiAgICAgICAgICAgIC8vIE11c3QgcGFzcyAndW5kZWZpbmVkJyB0byBhdm9pZCBlbWl0dGluZyBkZWNvcmF0b3IgbWV0YWRhdGEuXG4gICAgICAgICAgICBkZWNvcmF0b3JzVG9LZWVwLmxlbmd0aCA/IGRlY29yYXRvcnNUb0tlZXAgOiB1bmRlZmluZWQsIHBhcmFtLm1vZGlmaWVycyxcbiAgICAgICAgICAgIHBhcmFtLmRvdERvdERvdFRva2VuLCBwYXJhbS5uYW1lLCBwYXJhbS5xdWVzdGlvblRva2VuLCBwYXJhbS50eXBlLCBwYXJhbS5pbml0aWFsaXplcik7XG4gICAgICAgIG5ld1BhcmFtZXRlcnMucHVzaChuZXdQYXJhbSk7XG4gICAgICB9XG4gICAgICBjb25zdCB1cGRhdGVkID0gdHMudXBkYXRlQ29uc3RydWN0b3IoXG4gICAgICAgICAgY3RvciwgY3Rvci5kZWNvcmF0b3JzLCBjdG9yLm1vZGlmaWVycywgbmV3UGFyYW1ldGVycyxcbiAgICAgICAgICB0cy52aXNpdEZ1bmN0aW9uQm9keShjdG9yLmJvZHksIHZpc2l0b3IsIGNvbnRleHQpKTtcbiAgICAgIHJldHVybiBbdXBkYXRlZCwgcGFyYW1ldGVyc0luZm9dO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSBzaW5nbGUgY2xhc3MgZGVjbGFyYXRpb246XG4gICAgICogLSBkaXNwYXRjaGVzIHRvIHN0cmlwIGRlY29yYXRvcnMgb24gbWVtYmVyc1xuICAgICAqIC0gY29udmVydHMgZGVjb3JhdG9ycyBvbiB0aGUgY2xhc3MgdG8gYW5ub3RhdGlvbnNcbiAgICAgKiAtIGNyZWF0ZXMgYSBjdG9yUGFyYW1ldGVycyBwcm9wZXJ0eVxuICAgICAqIC0gY3JlYXRlcyBhIHByb3BEZWNvcmF0b3JzIHByb3BlcnR5XG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtQ2xhc3NEZWNsYXJhdGlvbihjbGFzc0RlY2w6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiB0cy5DbGFzc0RlY2xhcmF0aW9uIHtcbiAgICAgIGNsYXNzRGVjbCA9IHRzLmdldE11dGFibGVDbG9uZShjbGFzc0RlY2wpO1xuXG4gICAgICBjb25zdCBuZXdNZW1iZXJzOiB0cy5DbGFzc0VsZW1lbnRbXSA9IFtdO1xuICAgICAgY29uc3QgZGVjb3JhdGVkUHJvcGVydGllcyA9IG5ldyBNYXA8c3RyaW5nLCB0cy5EZWNvcmF0b3JbXT4oKTtcbiAgICAgIGxldCBjbGFzc1BhcmFtZXRlcnM6IFBhcmFtZXRlckRlY29yYXRpb25JbmZvW118bnVsbCA9IG51bGw7XG5cbiAgICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIGNsYXNzRGVjbC5tZW1iZXJzKSB7XG4gICAgICAgIHN3aXRjaCAobWVtYmVyLmtpbmQpIHtcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuUHJvcGVydHlEZWNsYXJhdGlvbjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuR2V0QWNjZXNzb3I6XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlNldEFjY2Vzc29yOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5NZXRob2REZWNsYXJhdGlvbjoge1xuICAgICAgICAgICAgY29uc3QgW25hbWUsIG5ld01lbWJlciwgZGVjb3JhdG9yc10gPSB0cmFuc2Zvcm1DbGFzc0VsZW1lbnQobWVtYmVyKTtcbiAgICAgICAgICAgIG5ld01lbWJlcnMucHVzaChuZXdNZW1iZXIpO1xuICAgICAgICAgICAgaWYgKG5hbWUpIGRlY29yYXRlZFByb3BlcnRpZXMuc2V0KG5hbWUsIGRlY29yYXRvcnMpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Db25zdHJ1Y3Rvcjoge1xuICAgICAgICAgICAgY29uc3QgY3RvciA9IG1lbWJlciBhcyB0cy5Db25zdHJ1Y3RvckRlY2xhcmF0aW9uO1xuICAgICAgICAgICAgaWYgKCFjdG9yLmJvZHkpIGJyZWFrO1xuICAgICAgICAgICAgY29uc3QgW25ld01lbWJlciwgcGFyYW1ldGVyc0luZm9dID1cbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1Db25zdHJ1Y3RvcihtZW1iZXIgYXMgdHMuQ29uc3RydWN0b3JEZWNsYXJhdGlvbik7XG4gICAgICAgICAgICBjbGFzc1BhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzSW5mbztcbiAgICAgICAgICAgIG5ld01lbWJlcnMucHVzaChuZXdNZW1iZXIpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBuZXdNZW1iZXJzLnB1c2godHMudmlzaXRFYWNoQ2hpbGQobWVtYmVyLCB2aXNpdG9yLCBjb250ZXh0KSk7XG4gICAgICB9XG4gICAgICBjb25zdCBkZWNvcmF0b3JzID0gY2xhc3NEZWNsLmRlY29yYXRvcnMgfHwgW107XG5cbiAgICAgIGNvbnN0IGRlY29yYXRvcnNUb0xvd2VyID0gW107XG4gICAgICBjb25zdCBkZWNvcmF0b3JzVG9LZWVwOiB0cy5EZWNvcmF0b3JbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBkZWNvcmF0b3Igb2YgZGVjb3JhdG9ycykge1xuICAgICAgICBpZiAoc2hvdWxkTG93ZXIoZGVjb3JhdG9yLCB0eXBlQ2hlY2tlcikpIHtcbiAgICAgICAgICBkZWNvcmF0b3JzVG9Mb3dlci5wdXNoKGV4dHJhY3RNZXRhZGF0YUZyb21TaW5nbGVEZWNvcmF0b3IoZGVjb3JhdG9yLCBkaWFnbm9zdGljcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlY29yYXRvcnNUb0tlZXAucHVzaChkZWNvcmF0b3IpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5ld0NsYXNzRGVjbGFyYXRpb24gPSB0cy5nZXRNdXRhYmxlQ2xvbmUoY2xhc3NEZWNsKTtcblxuICAgICAgaWYgKGRlY29yYXRvcnNUb0xvd2VyLmxlbmd0aCkge1xuICAgICAgICBuZXdNZW1iZXJzLnB1c2goY3JlYXRlRGVjb3JhdG9yQ2xhc3NQcm9wZXJ0eShkZWNvcmF0b3JzVG9Mb3dlcikpO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzUGFyYW1ldGVycykge1xuICAgICAgICBpZiAoKGRlY29yYXRvcnNUb0xvd2VyLmxlbmd0aCkgfHwgY2xhc3NQYXJhbWV0ZXJzLnNvbWUocCA9PiAhIXAuZGVjb3JhdG9ycy5sZW5ndGgpKSB7XG4gICAgICAgICAgLy8gZW1pdCBjdG9yUGFyYW1ldGVycyBpZiB0aGUgY2xhc3Mgd2FzIGRlY29yYXRvcmVkIGF0IGFsbCwgb3IgaWYgYW55IG9mIGl0cyBjdG9yc1xuICAgICAgICAgIC8vIHdlcmUgY2xhc3NQYXJhbWV0ZXJzXG4gICAgICAgICAgbmV3TWVtYmVycy5wdXNoKGNyZWF0ZUN0b3JQYXJhbWV0ZXJzQ2xhc3NQcm9wZXJ0eShcbiAgICAgICAgICAgICAgZGlhZ25vc3RpY3MsIGVudGl0eU5hbWVUb0V4cHJlc3Npb24sIGNsYXNzUGFyYW1ldGVycykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZGVjb3JhdGVkUHJvcGVydGllcy5zaXplKSB7XG4gICAgICAgIG5ld01lbWJlcnMucHVzaChjcmVhdGVQcm9wRGVjb3JhdG9yc0NsYXNzUHJvcGVydHkoZGlhZ25vc3RpY3MsIGRlY29yYXRlZFByb3BlcnRpZXMpKTtcbiAgICAgIH1cbiAgICAgIG5ld0NsYXNzRGVjbGFyYXRpb24ubWVtYmVycyA9IHRzLnNldFRleHRSYW5nZShcbiAgICAgICAgICB0cy5jcmVhdGVOb2RlQXJyYXkobmV3TWVtYmVycywgbmV3Q2xhc3NEZWNsYXJhdGlvbi5tZW1iZXJzLmhhc1RyYWlsaW5nQ29tbWEpLFxuICAgICAgICAgIGNsYXNzRGVjbC5tZW1iZXJzKTtcbiAgICAgIG5ld0NsYXNzRGVjbGFyYXRpb24uZGVjb3JhdG9ycyA9XG4gICAgICAgICAgZGVjb3JhdG9yc1RvS2VlcC5sZW5ndGggPyB0cy5jcmVhdGVOb2RlQXJyYXkoZGVjb3JhdG9yc1RvS2VlcCkgOiB1bmRlZmluZWQ7XG4gICAgICByZXR1cm4gbmV3Q2xhc3NEZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2aXNpdG9yKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlIHtcbiAgICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Tb3VyY2VGaWxlOiB7XG4gICAgICAgICAgaW1wb3J0TmFtZXNCeVN5bWJvbCA9IG5ldyBNYXA8dHMuU3ltYm9sLCB0cy5JZGVudGlmaWVyPigpO1xuICAgICAgICAgIHJldHVybiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuSW1wb3J0RGVjbGFyYXRpb246IHtcbiAgICAgICAgICBjb25zdCBpbXBEZWNsID0gbm9kZSBhcyB0cy5JbXBvcnREZWNsYXJhdGlvbjtcbiAgICAgICAgICBpZiAoaW1wRGVjbC5pbXBvcnRDbGF1c2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGltcG9ydENsYXVzZSA9IGltcERlY2wuaW1wb3J0Q2xhdXNlO1xuICAgICAgICAgICAgY29uc3QgbmFtZXMgPSBbXTtcbiAgICAgICAgICAgIGlmIChpbXBvcnRDbGF1c2UubmFtZSkge1xuICAgICAgICAgICAgICBuYW1lcy5wdXNoKGltcG9ydENsYXVzZS5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbXBvcnRDbGF1c2UubmFtZWRCaW5kaW5ncyAmJlxuICAgICAgICAgICAgICAgIGltcG9ydENsYXVzZS5uYW1lZEJpbmRpbmdzLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuTmFtZWRJbXBvcnRzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG5hbWVkSW1wb3J0cyA9IGltcG9ydENsYXVzZS5uYW1lZEJpbmRpbmdzIGFzIHRzLk5hbWVkSW1wb3J0cztcbiAgICAgICAgICAgICAgbmFtZXMucHVzaCguLi5uYW1lZEltcG9ydHMuZWxlbWVudHMubWFwKGUgPT4gZS5uYW1lKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgICAgICAgICAgY29uc3Qgc3ltID0gdHlwZUNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihuYW1lKSE7XG4gICAgICAgICAgICAgIGltcG9ydE5hbWVzQnlTeW1ib2wuc2V0KHN5bSwgbmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ2xhc3NEZWNsYXJhdGlvbjoge1xuICAgICAgICAgIHJldHVybiB0cmFuc2Zvcm1DbGFzc0RlY2xhcmF0aW9uKG5vZGUgYXMgdHMuQ2xhc3NEZWNsYXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gdmlzaXRFYWNoQ2hpbGQobm9kZSwgdmlzaXRvciwgY29udGV4dCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIChzZjogdHMuU291cmNlRmlsZSkgPT4gdmlzaXRvcihzZikgYXMgdHMuU291cmNlRmlsZTtcbiAgfTtcbn1cbiJdfQ==