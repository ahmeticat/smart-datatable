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
        define("tsickle/src/enum_transformer", ["require", "exports", "typescript", "tsickle/src/transformer_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * @fileoverview Transforms TypeScript enum declarations to Closure enum declarations, which
     * look like:
     *
     *     /.. @enum {number} ./
     *     const Foo = {BAR: 0, BAZ: 1, ...};
     *     export {Foo};  // even if originally exported on one line.
     *
     * This declares an enum type for Closure Compiler (and Closure JS users of this TS code).
     * Splitting the enum into declaration and export is required so that local references to the
     * type resolve ("@type {Foo}").
     */
    const ts = require("typescript");
    const transformer_util_1 = require("tsickle/src/transformer_util");
    /** isInNamespace returns true if any of node's ancestors is a namespace (ModuleDeclaration). */
    function isInNamespace(node) {
        // Must use the original node because node might have already been transformed, with node.parent
        // no longer being set.
        let parent = ts.getOriginalNode(node).parent;
        while (parent) {
            if (parent.kind === ts.SyntaxKind.ModuleDeclaration) {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }
    /**
     * getEnumMemberType computes the type of an enum member by inspecting its initializer expression.
     */
    function getEnumMemberType(typeChecker, member) {
        // Enum members without initialization have type 'number'
        if (!member.initializer) {
            return 'number';
        }
        const type = typeChecker.getTypeAtLocation(member.initializer);
        // Note: checking against 'NumberLike' instead of just 'Number' means this code
        // handles both
        //   MEMBER = 3,  // TypeFlags.NumberLiteral
        // and
        //   MEMBER = someFunction(),  // TypeFlags.Number
        if (type.flags & ts.TypeFlags.NumberLike) {
            return 'number';
        }
        // If the value is not a number, it must be a string.
        // TypeScript does not allow enum members to have any other type.
        return 'string';
    }
    /**
     * getEnumType computes the Closure type of an enum, by iterating through the members and gathering
     * their types.
     */
    function getEnumType(typeChecker, enumDecl) {
        let hasNumber = false;
        let hasString = false;
        for (const member of enumDecl.members) {
            const type = getEnumMemberType(typeChecker, member);
            if (type === 'string') {
                hasString = true;
            }
            else if (type === 'number') {
                hasNumber = true;
            }
        }
        if (hasNumber && hasString) {
            return '?'; // Closure's new type inference doesn't support enums of unions.
        }
        else if (hasNumber) {
            return 'number';
        }
        else if (hasString) {
            return 'string';
        }
        else {
            // Perhaps an empty enum?
            return '?';
        }
    }
    exports.getEnumType = getEnumType;
    /**
     * Transformer factory for the enum transformer. See fileoverview for details.
     */
    function enumTransformer(typeChecker, diagnostics) {
        return (context) => {
            function visitor(node) {
                if (!ts.isEnumDeclaration(node))
                    return ts.visitEachChild(node, visitor, context);
                // TODO(martinprobst): The enum transformer does not work for enums embedded in namespaces,
                // because TS does not support splitting export and declaration ("export {Foo};") in
                // namespaces. tsickle's emit for namespaces is unintelligible for Closure in any case, so
                // this is left to fix for another day.
                if (isInNamespace(node))
                    return ts.visitEachChild(node, visitor, context);
                // TypeScript does not emit any code for ambient enums, so early exit here to prevent the code
                // below from producing runtime values for an ambient structure.
                if (transformer_util_1.isAmbient(node))
                    return ts.visitEachChild(node, visitor, context);
                const name = node.name.getText();
                const isExported = transformer_util_1.hasModifierFlag(node, ts.ModifierFlags.Export);
                const enumType = getEnumType(typeChecker, node);
                const values = [];
                let enumIndex = 0;
                for (const member of node.members) {
                    let enumValue;
                    if (member.initializer) {
                        const enumConstValue = typeChecker.getConstantValue(member);
                        if (typeof enumConstValue === 'number') {
                            enumIndex = enumConstValue + 1;
                            enumValue = ts.createLiteral(enumConstValue);
                        }
                        else {
                            // Non-numeric enum value (string or an expression).
                            // Emit this initializer expression as-is.
                            // Note: if the member's initializer expression refers to another
                            // value within the enum (e.g. something like
                            //   enum Foo {
                            //     Field1,
                            //     Field2 = Field1 + something(),
                            //   }
                            // Then when we emit the initializer we produce invalid code because
                            // on the Closure side the reference to Field1 has to be namespaced,
                            // e.g. written "Foo.Field1 + something()".
                            // Hopefully this doesn't come up often -- if the enum instead has
                            // something like
                            //     Field2 = Field1 + 3,
                            // then it's still a constant expression and we inline the constant
                            // value in the above branch of this "if" statement.
                            enumValue = visitor(member.initializer);
                        }
                    }
                    else {
                        enumValue = ts.createLiteral(enumIndex);
                        enumIndex++;
                    }
                    const memberName = member.name.getText();
                    values.push(ts.setOriginalNode(ts.setTextRange(ts.createPropertyAssignment(memberName, enumValue), member), member));
                }
                const varDecl = ts.createVariableStatement(
                /* modifiers */ undefined, ts.createVariableDeclarationList([ts.createVariableDeclaration(name, undefined, ts.createObjectLiteral(ts.setTextRange(ts.createNodeArray(values, true), node.members), true))], 
                /* create a const var */ ts.NodeFlags.Const));
                const comment = {
                    kind: ts.SyntaxKind.MultiLineCommentTrivia,
                    text: `* @enum {${enumType}} `,
                    hasTrailingNewLine: true,
                    pos: -1,
                    end: -1
                };
                ts.setSyntheticLeadingComments(varDecl, [comment]);
                const resultNodes = [varDecl];
                if (isExported) {
                    // Create a separate export {...} statement, so that the enum name can be used in local
                    // type annotations within the file.
                    resultNodes.push(ts.createExportDeclaration(undefined, undefined, ts.createNamedExports([ts.createExportSpecifier(undefined, name)])));
                }
                if (transformer_util_1.hasModifierFlag(node, ts.ModifierFlags.Const)) {
                    // By TypeScript semantics, const enums disappear after TS compilation.
                    // We still need to generate the runtime value above to make Closure Compiler's type system
                    // happy and allow refering to enums from JS code, but we should at least not emit string
                    // value mappings.
                    return resultNodes;
                }
                // Emit the reverse mapping of foo[foo.BAR] = 'BAR'; lines for number enum members
                for (const member of node.members) {
                    const memberName = member.name;
                    const memberType = getEnumMemberType(typeChecker, member);
                    if (memberType !== 'number')
                        continue;
                    // TypeScript enum members can have Identifier names or String names.
                    // We need to emit slightly different code to support these two syntaxes:
                    let nameExpr;
                    let memberAccess;
                    if (ts.isIdentifier(memberName)) {
                        // Foo[Foo.ABC] = "ABC";
                        nameExpr = transformer_util_1.createSingleQuoteStringLiteral(memberName.text);
                        // Make sure to create a clean, new identifier, so comments do not get emitted twice.
                        const ident = ts.createIdentifier(transformer_util_1.getIdentifierText(memberName));
                        memberAccess = ts.createPropertyAccess(ts.createIdentifier(name), ident);
                    }
                    else {
                        // Foo[Foo["A B C"]] = "A B C"; or Foo[Foo[expression]] = expression;
                        nameExpr = ts.isComputedPropertyName(memberName) ? memberName.expression : memberName;
                        memberAccess = ts.createElementAccess(ts.createIdentifier(name), nameExpr);
                    }
                    resultNodes.push(ts.createStatement(ts.createAssignment(ts.createElementAccess(ts.createIdentifier(name), memberAccess), nameExpr)));
                }
                return resultNodes;
            }
            return (sf) => visitor(sf);
        };
    }
    exports.enumTransformer = enumTransformer;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bV90cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9lbnVtX3RyYW5zZm9ybWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBRUg7Ozs7Ozs7Ozs7O09BV0c7SUFFSCxpQ0FBaUM7SUFFakMsbUVBQWlIO0lBRWpILGdHQUFnRztJQUNoRyxTQUFTLGFBQWEsQ0FBQyxJQUFhO1FBQ2xDLGdHQUFnRztRQUNoRyx1QkFBdUI7UUFDdkIsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDN0MsT0FBTyxNQUFNLEVBQUU7WUFDYixJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDbkQsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1NBQ3hCO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLGlCQUFpQixDQUFDLFdBQTJCLEVBQUUsTUFBcUI7UUFDM0UseURBQXlEO1FBQ3pELElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFO1lBQ3ZCLE9BQU8sUUFBUSxDQUFDO1NBQ2pCO1FBQ0QsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRCwrRUFBK0U7UUFDL0UsZUFBZTtRQUNmLDRDQUE0QztRQUM1QyxNQUFNO1FBQ04sa0RBQWtEO1FBQ2xELElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRTtZQUN4QyxPQUFPLFFBQVEsQ0FBQztTQUNqQjtRQUNELHFEQUFxRDtRQUNyRCxpRUFBaUU7UUFDakUsT0FBTyxRQUFRLENBQUM7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Q0FBQyxDQUFDO3dCQUMzRCxxRkFBcUY7d0JBQ3JGLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxvQ0FBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3dCQUNqRSxZQUFZLEdBQUcsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztxQkFDMUU7eUJBQU07d0JBQ0wscUVBQXFFO3dCQUNyRSxRQUFRLEdBQUcsRUFBRSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7d0JBQ3RGLFlBQVksR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3FCQUM1RTtvQkFDRCxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUNuRCxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDbEY7Z0JBQ0QsT0FBTyxXQUFXLENBQUM7WUFDckIsQ0FBQztZQUVELE9BQU8sQ0FBQyxFQUFpQixFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFrQixDQUFDO1FBQzdELENBQUMsQ0FBQztJQUNKLENBQUM7SUF4SEQsMENBd0hDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgVHJhbnNmb3JtcyBUeXBlU2NyaXB0IGVudW0gZGVjbGFyYXRpb25zIHRvIENsb3N1cmUgZW51bSBkZWNsYXJhdGlvbnMsIHdoaWNoXG4gKiBsb29rIGxpa2U6XG4gKlxuICogICAgIC8uLiBAZW51bSB7bnVtYmVyfSAuL1xuICogICAgIGNvbnN0IEZvbyA9IHtCQVI6IDAsIEJBWjogMSwgLi4ufTtcbiAqICAgICBleHBvcnQge0Zvb307ICAvLyBldmVuIGlmIG9yaWdpbmFsbHkgZXhwb3J0ZWQgb24gb25lIGxpbmUuXG4gKlxuICogVGhpcyBkZWNsYXJlcyBhbiBlbnVtIHR5cGUgZm9yIENsb3N1cmUgQ29tcGlsZXIgKGFuZCBDbG9zdXJlIEpTIHVzZXJzIG9mIHRoaXMgVFMgY29kZSkuXG4gKiBTcGxpdHRpbmcgdGhlIGVudW0gaW50byBkZWNsYXJhdGlvbiBhbmQgZXhwb3J0IGlzIHJlcXVpcmVkIHNvIHRoYXQgbG9jYWwgcmVmZXJlbmNlcyB0byB0aGVcbiAqIHR5cGUgcmVzb2x2ZSAoXCJAdHlwZSB7Rm9vfVwiKS5cbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtjcmVhdGVTaW5nbGVRdW90ZVN0cmluZ0xpdGVyYWwsIGdldElkZW50aWZpZXJUZXh0LCBoYXNNb2RpZmllckZsYWcsIGlzQW1iaWVudH0gZnJvbSAnLi90cmFuc2Zvcm1lcl91dGlsJztcblxuLyoqIGlzSW5OYW1lc3BhY2UgcmV0dXJucyB0cnVlIGlmIGFueSBvZiBub2RlJ3MgYW5jZXN0b3JzIGlzIGEgbmFtZXNwYWNlIChNb2R1bGVEZWNsYXJhdGlvbikuICovXG5mdW5jdGlvbiBpc0luTmFtZXNwYWNlKG5vZGU6IHRzLk5vZGUpIHtcbiAgLy8gTXVzdCB1c2UgdGhlIG9yaWdpbmFsIG5vZGUgYmVjYXVzZSBub2RlIG1pZ2h0IGhhdmUgYWxyZWFkeSBiZWVuIHRyYW5zZm9ybWVkLCB3aXRoIG5vZGUucGFyZW50XG4gIC8vIG5vIGxvbmdlciBiZWluZyBzZXQuXG4gIGxldCBwYXJlbnQgPSB0cy5nZXRPcmlnaW5hbE5vZGUobm9kZSkucGFyZW50O1xuICB3aGlsZSAocGFyZW50KSB7XG4gICAgaWYgKHBhcmVudC5raW5kID09PSB0cy5TeW50YXhLaW5kLk1vZHVsZURlY2xhcmF0aW9uKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogZ2V0RW51bU1lbWJlclR5cGUgY29tcHV0ZXMgdGhlIHR5cGUgb2YgYW4gZW51bSBtZW1iZXIgYnkgaW5zcGVjdGluZyBpdHMgaW5pdGlhbGl6ZXIgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gZ2V0RW51bU1lbWJlclR5cGUodHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLCBtZW1iZXI6IHRzLkVudW1NZW1iZXIpOiAnbnVtYmVyJ3wnc3RyaW5nJyB7XG4gIC8vIEVudW0gbWVtYmVycyB3aXRob3V0IGluaXRpYWxpemF0aW9uIGhhdmUgdHlwZSAnbnVtYmVyJ1xuICBpZiAoIW1lbWJlci5pbml0aWFsaXplcikge1xuICAgIHJldHVybiAnbnVtYmVyJztcbiAgfVxuICBjb25zdCB0eXBlID0gdHlwZUNoZWNrZXIuZ2V0VHlwZUF0TG9jYXRpb24obWVtYmVyLmluaXRpYWxpemVyKTtcbiAgLy8gTm90ZTogY2hlY2tpbmcgYWdhaW5zdCAnTnVtYmVyTGlrZScgaW5zdGVhZCBvZiBqdXN0ICdOdW1iZXInIG1lYW5zIHRoaXMgY29kZVxuICAvLyBoYW5kbGVzIGJvdGhcbiAgLy8gICBNRU1CRVIgPSAzLCAgLy8gVHlwZUZsYWdzLk51bWJlckxpdGVyYWxcbiAgLy8gYW5kXG4gIC8vICAgTUVNQkVSID0gc29tZUZ1bmN0aW9uKCksICAvLyBUeXBlRmxhZ3MuTnVtYmVyXG4gIGlmICh0eXBlLmZsYWdzICYgdHMuVHlwZUZsYWdzLk51bWJlckxpa2UpIHtcbiAgICByZXR1cm4gJ251bWJlcic7XG4gIH1cbiAgLy8gSWYgdGhlIHZhbHVlIGlzIG5vdCBhIG51bWJlciwgaXQgbXVzdCBiZSBhIHN0cmluZy5cbiAgLy8gVHlwZVNjcmlwdCBkb2VzIG5vdCBhbGxvdyBlbnVtIG1lbWJlcnMgdG8gaGF2ZSBhbnkgb3RoZXIgdHlwZS5cbiAgcmV0dXJuICdzdHJpbmcnO1xufVxuXG4vKipcbiAqIGdldEVudW1UeXBlIGNvbXB1dGVzIHRoZSBDbG9zdXJlIHR5cGUgb2YgYW4gZW51bSwgYnkgaXRlcmF0aW5nIHRocm91Z2ggdGhlIG1lbWJlcnMgYW5kIGdhdGhlcmluZ1xuICogdGhlaXIgdHlwZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbnVtVHlwZSh0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIGVudW1EZWNsOiB0cy5FbnVtRGVjbGFyYXRpb24pOiAnbnVtYmVyJ3xcbiAgICAnc3RyaW5nJ3wnPycge1xuICBsZXQgaGFzTnVtYmVyID0gZmFsc2U7XG4gIGxldCBoYXNTdHJpbmcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBtZW1iZXIgb2YgZW51bURlY2wubWVtYmVycykge1xuICAgIGNvbnN0IHR5cGUgPSBnZXRFbnVtTWVtYmVyVHlwZSh0eXBlQ2hlY2tlciwgbWVtYmVyKTtcbiAgICBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGhhc1N0cmluZyA9IHRydWU7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJykge1xuICAgICAgaGFzTnVtYmVyID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgaWYgKGhhc051bWJlciAmJiBoYXNTdHJpbmcpIHtcbiAgICByZXR1cm4gJz8nOyAgLy8gQ2xvc3VyZSdzIG5ldyB0eXBlIGluZmVyZW5jZSBkb2Vzbid0IHN1cHBvcnQgZW51bXMgb2YgdW5pb25zLlxuICB9IGVsc2UgaWYgKGhhc051bWJlcikge1xuICAgIHJldHVybiAnbnVtYmVyJztcbiAgfSBlbHNlIGlmIChoYXNTdHJpbmcpIHtcbiAgICByZXR1cm4gJ3N0cmluZyc7XG4gIH0gZWxzZSB7XG4gICAgLy8gUGVyaGFwcyBhbiBlbXB0eSBlbnVtP1xuICAgIHJldHVybiAnPyc7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm1lciBmYWN0b3J5IGZvciB0aGUgZW51bSB0cmFuc2Zvcm1lci4gU2VlIGZpbGVvdmVydmlldyBmb3IgZGV0YWlscy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVudW1UcmFuc2Zvcm1lcih0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10pOlxuICAgIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpID0+IHRzLlRyYW5zZm9ybWVyPHRzLlNvdXJjZUZpbGU+IHtcbiAgcmV0dXJuIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpID0+IHtcbiAgICBmdW5jdGlvbiB2aXNpdG9yPFQgZXh0ZW5kcyB0cy5Ob2RlPihub2RlOiBUKTogVHx0cy5Ob2RlW10ge1xuICAgICAgaWYgKCF0cy5pc0VudW1EZWNsYXJhdGlvbihub2RlKSkgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0b3IsIGNvbnRleHQpO1xuXG4gICAgICAvLyBUT0RPKG1hcnRpbnByb2JzdCk6IFRoZSBlbnVtIHRyYW5zZm9ybWVyIGRvZXMgbm90IHdvcmsgZm9yIGVudW1zIGVtYmVkZGVkIGluIG5hbWVzcGFjZXMsXG4gICAgICAvLyBiZWNhdXNlIFRTIGRvZXMgbm90IHN1cHBvcnQgc3BsaXR0aW5nIGV4cG9ydCBhbmQgZGVjbGFyYXRpb24gKFwiZXhwb3J0IHtGb299O1wiKSBpblxuICAgICAgLy8gbmFtZXNwYWNlcy4gdHNpY2tsZSdzIGVtaXQgZm9yIG5hbWVzcGFjZXMgaXMgdW5pbnRlbGxpZ2libGUgZm9yIENsb3N1cmUgaW4gYW55IGNhc2UsIHNvXG4gICAgICAvLyB0aGlzIGlzIGxlZnQgdG8gZml4IGZvciBhbm90aGVyIGRheS5cbiAgICAgIGlmIChpc0luTmFtZXNwYWNlKG5vZGUpKSByZXR1cm4gdHMudmlzaXRFYWNoQ2hpbGQobm9kZSwgdmlzaXRvciwgY29udGV4dCk7XG5cbiAgICAgIC8vIFR5cGVTY3JpcHQgZG9lcyBub3QgZW1pdCBhbnkgY29kZSBmb3IgYW1iaWVudCBlbnVtcywgc28gZWFybHkgZXhpdCBoZXJlIHRvIHByZXZlbnQgdGhlIGNvZGVcbiAgICAgIC8vIGJlbG93IGZyb20gcHJvZHVjaW5nIHJ1bnRpbWUgdmFsdWVzIGZvciBhbiBhbWJpZW50IHN0cnVjdHVyZS5cbiAgICAgIGlmIChpc0FtYmllbnQobm9kZSkpIHJldHVybiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCBjb250ZXh0KTtcblxuICAgICAgY29uc3QgbmFtZSA9IG5vZGUubmFtZS5nZXRUZXh0KCk7XG4gICAgICBjb25zdCBpc0V4cG9ydGVkID0gaGFzTW9kaWZpZXJGbGFnKG5vZGUsIHRzLk1vZGlmaWVyRmxhZ3MuRXhwb3J0KTtcbiAgICAgIGNvbnN0IGVudW1UeXBlID0gZ2V0RW51bVR5cGUodHlwZUNoZWNrZXIsIG5vZGUpO1xuXG4gICAgICBjb25zdCB2YWx1ZXM6IHRzLlByb3BlcnR5QXNzaWdubWVudFtdID0gW107XG4gICAgICBsZXQgZW51bUluZGV4ID0gMDtcbiAgICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIG5vZGUubWVtYmVycykge1xuICAgICAgICBsZXQgZW51bVZhbHVlOiB0cy5FeHByZXNzaW9uO1xuICAgICAgICBpZiAobWVtYmVyLmluaXRpYWxpemVyKSB7XG4gICAgICAgICAgY29uc3QgZW51bUNvbnN0VmFsdWUgPSB0eXBlQ2hlY2tlci5nZXRDb25zdGFudFZhbHVlKG1lbWJlcik7XG4gICAgICAgICAgaWYgKHR5cGVvZiBlbnVtQ29uc3RWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGVudW1JbmRleCA9IGVudW1Db25zdFZhbHVlICsgMTtcbiAgICAgICAgICAgIGVudW1WYWx1ZSA9IHRzLmNyZWF0ZUxpdGVyYWwoZW51bUNvbnN0VmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBOb24tbnVtZXJpYyBlbnVtIHZhbHVlIChzdHJpbmcgb3IgYW4gZXhwcmVzc2lvbikuXG4gICAgICAgICAgICAvLyBFbWl0IHRoaXMgaW5pdGlhbGl6ZXIgZXhwcmVzc2lvbiBhcy1pcy5cbiAgICAgICAgICAgIC8vIE5vdGU6IGlmIHRoZSBtZW1iZXIncyBpbml0aWFsaXplciBleHByZXNzaW9uIHJlZmVycyB0byBhbm90aGVyXG4gICAgICAgICAgICAvLyB2YWx1ZSB3aXRoaW4gdGhlIGVudW0gKGUuZy4gc29tZXRoaW5nIGxpa2VcbiAgICAgICAgICAgIC8vICAgZW51bSBGb28ge1xuICAgICAgICAgICAgLy8gICAgIEZpZWxkMSxcbiAgICAgICAgICAgIC8vICAgICBGaWVsZDIgPSBGaWVsZDEgKyBzb21ldGhpbmcoKSxcbiAgICAgICAgICAgIC8vICAgfVxuICAgICAgICAgICAgLy8gVGhlbiB3aGVuIHdlIGVtaXQgdGhlIGluaXRpYWxpemVyIHdlIHByb2R1Y2UgaW52YWxpZCBjb2RlIGJlY2F1c2VcbiAgICAgICAgICAgIC8vIG9uIHRoZSBDbG9zdXJlIHNpZGUgdGhlIHJlZmVyZW5jZSB0byBGaWVsZDEgaGFzIHRvIGJlIG5hbWVzcGFjZWQsXG4gICAgICAgICAgICAvLyBlLmcuIHdyaXR0ZW4gXCJGb28uRmllbGQxICsgc29tZXRoaW5nKClcIi5cbiAgICAgICAgICAgIC8vIEhvcGVmdWxseSB0aGlzIGRvZXNuJ3QgY29tZSB1cCBvZnRlbiAtLSBpZiB0aGUgZW51bSBpbnN0ZWFkIGhhc1xuICAgICAgICAgICAgLy8gc29tZXRoaW5nIGxpa2VcbiAgICAgICAgICAgIC8vICAgICBGaWVsZDIgPSBGaWVsZDEgKyAzLFxuICAgICAgICAgICAgLy8gdGhlbiBpdCdzIHN0aWxsIGEgY29uc3RhbnQgZXhwcmVzc2lvbiBhbmQgd2UgaW5saW5lIHRoZSBjb25zdGFudFxuICAgICAgICAgICAgLy8gdmFsdWUgaW4gdGhlIGFib3ZlIGJyYW5jaCBvZiB0aGlzIFwiaWZcIiBzdGF0ZW1lbnQuXG4gICAgICAgICAgICBlbnVtVmFsdWUgPSB2aXNpdG9yKG1lbWJlci5pbml0aWFsaXplcikgYXMgdHMuRXhwcmVzc2lvbjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bVZhbHVlID0gdHMuY3JlYXRlTGl0ZXJhbChlbnVtSW5kZXgpO1xuICAgICAgICAgIGVudW1JbmRleCsrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1lbWJlck5hbWUgPSBtZW1iZXIubmFtZS5nZXRUZXh0KCk7XG4gICAgICAgIHZhbHVlcy5wdXNoKHRzLnNldE9yaWdpbmFsTm9kZShcbiAgICAgICAgICAgIHRzLnNldFRleHRSYW5nZSh0cy5jcmVhdGVQcm9wZXJ0eUFzc2lnbm1lbnQobWVtYmVyTmFtZSwgZW51bVZhbHVlKSwgbWVtYmVyKSwgbWVtYmVyKSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHZhckRlY2wgPSB0cy5jcmVhdGVWYXJpYWJsZVN0YXRlbWVudChcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgIHRzLmNyZWF0ZVZhcmlhYmxlRGVjbGFyYXRpb25MaXN0KFxuICAgICAgICAgICAgICBbdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgICAgIG5hbWUsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgIHRzLmNyZWF0ZU9iamVjdExpdGVyYWwoXG4gICAgICAgICAgICAgICAgICAgICAgdHMuc2V0VGV4dFJhbmdlKHRzLmNyZWF0ZU5vZGVBcnJheSh2YWx1ZXMsIHRydWUpLCBub2RlLm1lbWJlcnMpLCB0cnVlKSldLFxuICAgICAgICAgICAgICAvKiBjcmVhdGUgYSBjb25zdCB2YXIgKi8gdHMuTm9kZUZsYWdzLkNvbnN0KSk7XG4gICAgICBjb25zdCBjb21tZW50OiB0cy5TeW50aGVzaXplZENvbW1lbnQgPSB7XG4gICAgICAgIGtpbmQ6IHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSxcbiAgICAgICAgdGV4dDogYCogQGVudW0geyR7ZW51bVR5cGV9fSBgLFxuICAgICAgICBoYXNUcmFpbGluZ05ld0xpbmU6IHRydWUsXG4gICAgICAgIHBvczogLTEsXG4gICAgICAgIGVuZDogLTFcbiAgICAgIH07XG4gICAgICB0cy5zZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHModmFyRGVjbCwgW2NvbW1lbnRdKTtcblxuICAgICAgY29uc3QgcmVzdWx0Tm9kZXM6IHRzLk5vZGVbXSA9IFt2YXJEZWNsXTtcbiAgICAgIGlmIChpc0V4cG9ydGVkKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIGV4cG9ydCB7Li4ufSBzdGF0ZW1lbnQsIHNvIHRoYXQgdGhlIGVudW0gbmFtZSBjYW4gYmUgdXNlZCBpbiBsb2NhbFxuICAgICAgICAvLyB0eXBlIGFubm90YXRpb25zIHdpdGhpbiB0aGUgZmlsZS5cbiAgICAgICAgcmVzdWx0Tm9kZXMucHVzaCh0cy5jcmVhdGVFeHBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgdHMuY3JlYXRlTmFtZWRFeHBvcnRzKFt0cy5jcmVhdGVFeHBvcnRTcGVjaWZpZXIodW5kZWZpbmVkLCBuYW1lKV0pKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChoYXNNb2RpZmllckZsYWcobm9kZSwgdHMuTW9kaWZpZXJGbGFncy5Db25zdCkpIHtcbiAgICAgICAgLy8gQnkgVHlwZVNjcmlwdCBzZW1hbnRpY3MsIGNvbnN0IGVudW1zIGRpc2FwcGVhciBhZnRlciBUUyBjb21waWxhdGlvbi5cbiAgICAgICAgLy8gV2Ugc3RpbGwgbmVlZCB0byBnZW5lcmF0ZSB0aGUgcnVudGltZSB2YWx1ZSBhYm92ZSB0byBtYWtlIENsb3N1cmUgQ29tcGlsZXIncyB0eXBlIHN5c3RlbVxuICAgICAgICAvLyBoYXBweSBhbmQgYWxsb3cgcmVmZXJpbmcgdG8gZW51bXMgZnJvbSBKUyBjb2RlLCBidXQgd2Ugc2hvdWxkIGF0IGxlYXN0IG5vdCBlbWl0IHN0cmluZ1xuICAgICAgICAvLyB2YWx1ZSBtYXBwaW5ncy5cbiAgICAgICAgcmV0dXJuIHJlc3VsdE5vZGVzO1xuICAgICAgfVxuXG4gICAgICAvLyBFbWl0IHRoZSByZXZlcnNlIG1hcHBpbmcgb2YgZm9vW2Zvby5CQVJdID0gJ0JBUic7IGxpbmVzIGZvciBudW1iZXIgZW51bSBtZW1iZXJzXG4gICAgICBmb3IgKGNvbnN0IG1lbWJlciBvZiBub2RlLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3QgbWVtYmVyTmFtZSA9IG1lbWJlci5uYW1lO1xuICAgICAgICBjb25zdCBtZW1iZXJUeXBlID0gZ2V0RW51bU1lbWJlclR5cGUodHlwZUNoZWNrZXIsIG1lbWJlcik7XG4gICAgICAgIGlmIChtZW1iZXJUeXBlICE9PSAnbnVtYmVyJykgY29udGludWU7XG5cbiAgICAgICAgLy8gVHlwZVNjcmlwdCBlbnVtIG1lbWJlcnMgY2FuIGhhdmUgSWRlbnRpZmllciBuYW1lcyBvciBTdHJpbmcgbmFtZXMuXG4gICAgICAgIC8vIFdlIG5lZWQgdG8gZW1pdCBzbGlnaHRseSBkaWZmZXJlbnQgY29kZSB0byBzdXBwb3J0IHRoZXNlIHR3byBzeW50YXhlczpcbiAgICAgICAgbGV0IG5hbWVFeHByOiB0cy5FeHByZXNzaW9uO1xuICAgICAgICBsZXQgbWVtYmVyQWNjZXNzOiB0cy5FeHByZXNzaW9uO1xuICAgICAgICBpZiAodHMuaXNJZGVudGlmaWVyKG1lbWJlck5hbWUpKSB7XG4gICAgICAgICAgLy8gRm9vW0Zvby5BQkNdID0gXCJBQkNcIjtcbiAgICAgICAgICBuYW1lRXhwciA9IGNyZWF0ZVNpbmdsZVF1b3RlU3RyaW5nTGl0ZXJhbChtZW1iZXJOYW1lLnRleHQpO1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0byBjcmVhdGUgYSBjbGVhbiwgbmV3IGlkZW50aWZpZXIsIHNvIGNvbW1lbnRzIGRvIG5vdCBnZXQgZW1pdHRlZCB0d2ljZS5cbiAgICAgICAgICBjb25zdCBpZGVudCA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoZ2V0SWRlbnRpZmllclRleHQobWVtYmVyTmFtZSkpO1xuICAgICAgICAgIG1lbWJlckFjY2VzcyA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHRzLmNyZWF0ZUlkZW50aWZpZXIobmFtZSksIGlkZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGb29bRm9vW1wiQSBCIENcIl1dID0gXCJBIEIgQ1wiOyBvciBGb29bRm9vW2V4cHJlc3Npb25dXSA9IGV4cHJlc3Npb247XG4gICAgICAgICAgbmFtZUV4cHIgPSB0cy5pc0NvbXB1dGVkUHJvcGVydHlOYW1lKG1lbWJlck5hbWUpID8gbWVtYmVyTmFtZS5leHByZXNzaW9uIDogbWVtYmVyTmFtZTtcbiAgICAgICAgICBtZW1iZXJBY2Nlc3MgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKHRzLmNyZWF0ZUlkZW50aWZpZXIobmFtZSksIG5hbWVFeHByKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHROb2Rlcy5wdXNoKHRzLmNyZWF0ZVN0YXRlbWVudCh0cy5jcmVhdGVBc3NpZ25tZW50KFxuICAgICAgICAgICAgdHMuY3JlYXRlRWxlbWVudEFjY2Vzcyh0cy5jcmVhdGVJZGVudGlmaWVyKG5hbWUpLCBtZW1iZXJBY2Nlc3MpLCBuYW1lRXhwcikpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHROb2RlcztcbiAgICB9XG5cbiAgICByZXR1cm4gKHNmOiB0cy5Tb3VyY2VGaWxlKSA9PiB2aXNpdG9yKHNmKSBhcyB0cy5Tb3VyY2VGaWxlO1xuICB9O1xufVxuIl19