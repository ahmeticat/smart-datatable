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
        define("tsickle/src/fileoverview_comment_transformer", ["require", "exports", "typescript", "tsickle/src/jsdoc", "tsickle/src/transformer_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ts = require("typescript");
    const jsdoc = require("tsickle/src/jsdoc");
    const transformer_util_1 = require("tsickle/src/transformer_util");
    /**
     * A set of JSDoc tags that mark a comment as a fileoverview comment. These are recognized by other
     * pieces of infrastructure (Closure Compiler, module system, ...).
     */
    const FILEOVERVIEW_COMMENT_MARKERS = new Set(['fileoverview', 'externs', 'modName', 'mods', 'pintomodule']);
    /**
     * Given a parsed \@fileoverview comment, ensures it has all the attributes we need.
     * This function can be called to modify an existing comment or to make a new one.
     *
     * @param tags Comment as parsed list of tags; modified in-place.
     */
    function augmentFileoverviewComments(tags) {
        // Ensure we start with a @fileoverview.
        if (!tags.find(t => t.tagName === 'fileoverview')) {
            tags.splice(0, 0, { tagName: 'fileoverview', text: 'added by tsickle' });
        }
        // Find or create a @suppress tag.
        // Closure compiler barfs if there's a duplicated @suppress tag in a file, so the tag must
        // only appear once and be merged.
        let suppressTag = tags.find(t => t.tagName === 'suppress');
        let suppressions;
        if (suppressTag) {
            suppressions = new Set((suppressTag.type || '').split(',').map(s => s.trim()));
        }
        else {
            suppressTag = { tagName: 'suppress', text: 'checked by tsc' };
            tags.push(suppressTag);
            suppressions = new Set();
        }
        // Ensure our suppressions are included in the @suppress tag:
        // 1) Suppress checkTypes.  We believe the code has already been type-checked by TypeScript,
        // and we cannot model all the TypeScript type decisions in Closure syntax.
        suppressions.add('checkTypes');
        // 2) Suppress extraRequire.  We remove extra requires at the TypeScript level, so any require
        // that gets to the JS level is a load-bearing require.
        suppressions.add('extraRequire');
        // 3) Suppress uselessCode.  We emit an "if (false)" around type declarations,
        // which is flagged as unused code unless we suppress it.
        suppressions.add('uselessCode');
        // 4) Suppress some checks for user errors that TS already checks.
        suppressions.add('missingReturn');
        suppressions.add('unusedPrivateMembers');
        // 5) Suppress checking for @override, because TS doesn't model it.
        suppressions.add('missingOverride');
        suppressTag.type = Array.from(suppressions.values()).sort().join(',');
        return tags;
    }
    /**
     * A transformer that ensures the emitted JS file has an \@fileoverview comment that contains an
     * \@suppress {checkTypes} annotation by either adding or updating an existing comment.
     */
    function transformFileoverviewCommentFactory(diagnostics) {
        return () => {
            function checkNoFileoverviewComments(context, comments, message) {
                for (const comment of comments) {
                    const parse = jsdoc.parse(comment);
                    if (parse !== null && parse.tags.some(t => FILEOVERVIEW_COMMENT_MARKERS.has(t.tagName))) {
                        // Report a warning; this should not break compilation in third party code.
                        transformer_util_1.reportDiagnostic(diagnostics, context, message, comment.originalRange, ts.DiagnosticCategory.Warning);
                    }
                }
            }
            return (sourceFile) => {
                const text = sourceFile.getFullText();
                let fileComments = [];
                const firstStatement = sourceFile.statements.length && sourceFile.statements[0] || null;
                const originalComments = ts.getLeadingCommentRanges(text, 0) || [];
                if (!firstStatement) {
                    // In an empty source file, all comments are file-level comments.
                    fileComments = transformer_util_1.synthesizeCommentRanges(sourceFile, originalComments);
                }
                else {
                    // Search for the last comment split from the file with a \n\n. All comments before that are
                    // considered fileoverview comments, all comments after that belong to the next
                    // statement(s). If none found, comments remains empty, and the code below will insert a new
                    // fileoverview comment.
                    for (let i = originalComments.length - 1; i >= 0; i--) {
                        const end = originalComments[i].end;
                        if (!text.substring(end).startsWith('\n\n') &&
                            !text.substring(end).startsWith('\r\n\r\n')) {
                            continue;
                        }
                        // This comment is separated from the source file with a double break, marking it (and any
                        // preceding comments) as a file-level comment. Split them off and attach them onto a
                        // NotEmittedStatement, so that they do not get lost later on.
                        const synthesizedComments = jsdoc.synthesizeLeadingComments(firstStatement);
                        const notEmitted = ts.createNotEmittedStatement(sourceFile);
                        // Modify the comments on the firstStatement in place by removing the file-level comments.
                        fileComments = synthesizedComments.splice(0, i + 1);
                        // Move the fileComments onto notEmitted.
                        ts.setSyntheticLeadingComments(notEmitted, fileComments);
                        sourceFile = transformer_util_1.updateSourceFileNode(sourceFile, ts.createNodeArray([notEmitted, firstStatement, ...sourceFile.statements.slice(1)]));
                        break;
                    }
                    // Now walk every top level statement and escape/drop any @fileoverview comments found.
                    // Closure ignores all @fileoverview comments but the last, so tsickle must make sure not to
                    // emit duplicated ones.
                    for (let i = 0; i < sourceFile.statements.length; i++) {
                        const stmt = sourceFile.statements[i];
                        // Accept the NotEmittedStatement inserted above.
                        if (i === 0 && stmt.kind === ts.SyntaxKind.NotEmittedStatement)
                            continue;
                        const comments = jsdoc.synthesizeLeadingComments(stmt);
                        checkNoFileoverviewComments(stmt, comments, `file comments must be at the top of the file, ` +
                            `separated from the file body by an empty line.`);
                    }
                }
                // Closure Compiler considers the *last* comment with @fileoverview (or @externs or
                // @nocompile) that has not been attached to some other tree node to be the file overview
                // comment, and only applies @suppress tags from it. Google-internal tooling considers *any*
                // comment mentioning @fileoverview.
                let fileoverviewIdx = -1;
                let tags = [];
                for (let i = fileComments.length - 1; i >= 0; i--) {
                    const parse = jsdoc.parseContents(fileComments[i].text);
                    if (parse !== null && parse.tags.some(t => FILEOVERVIEW_COMMENT_MARKERS.has(t.tagName))) {
                        fileoverviewIdx = i;
                        tags = parse.tags;
                        break;
                    }
                }
                if (fileoverviewIdx !== -1) {
                    checkNoFileoverviewComments(firstStatement || sourceFile, fileComments.slice(0, fileoverviewIdx), `duplicate file level comment`);
                }
                augmentFileoverviewComments(tags);
                const commentText = jsdoc.toStringWithoutStartEnd(tags);
                if (fileoverviewIdx < 0) {
                    // No existing comment to merge with, just emit a new one.
                    return addNewFileoverviewComment(sourceFile, commentText);
                }
                fileComments[fileoverviewIdx].text = commentText;
                // sf does not need to be updated, synthesized comments are mutable.
                return sourceFile;
            };
        };
    }
    exports.transformFileoverviewCommentFactory = transformFileoverviewCommentFactory;
    function addNewFileoverviewComment(sf, commentText) {
        let syntheticFirstStatement = transformer_util_1.createNotEmittedStatement(sf);
        syntheticFirstStatement = ts.addSyntheticTrailingComment(syntheticFirstStatement, ts.SyntaxKind.MultiLineCommentTrivia, commentText, true);
        return transformer_util_1.updateSourceFileNode(sf, ts.createNodeArray([syntheticFirstStatement, ...sf.statements]));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZW92ZXJ2aWV3X2NvbW1lbnRfdHJhbnNmb3JtZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZmlsZW92ZXJ2aWV3X2NvbW1lbnRfdHJhbnNmb3JtZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCxpQ0FBaUM7SUFFakMsMkNBQWlDO0lBQ2pDLG1FQUE4SDtJQUU5SDs7O09BR0c7SUFDSCxNQUFNLDRCQUE0QixHQUM5QixJQUFJLEdBQUcsQ0FBQyxDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBRTNFOzs7OztPQUtHO0lBQ0gsU0FBUywyQkFBMkIsQ0FBQyxJQUFpQjtRQUNwRCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxLQUFLLGNBQWMsQ0FBQyxFQUFFO1lBQ2pELElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFDLENBQUMsQ0FBQztTQUN4RTtRQUVELGtDQUFrQztRQUNsQywwRkFBMEY7UUFDMUYsa0NBQWtDO1FBQ2xDLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxLQUFLLFVBQVUsQ0FBQyxDQUFDO1FBQzNELElBQUksWUFBeUIsQ0FBQztRQUM5QixJQUFJLFdBQVcsRUFBRTtZQUNmLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFD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QVcsR0FBRyxLQUFLLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRXhELElBQUksZUFBZSxHQUFHLENBQUMsRUFBRTtvQkFDdkIsMERBQTBEO29CQUMxRCxPQUFPLHlCQUF5QixDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztpQkFDM0Q7Z0JBRUQsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7Z0JBQ2pELG9FQUFvRTtnQkFDcEUsT0FBTyxVQUFVLENBQUM7WUFDcEIsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQXBHRCxrRkFvR0M7SUFFRCxTQUFTLHlCQUF5QixDQUFDLEVBQWlCLEVBQUUsV0FBbUI7UUFDdkUsSUFBSSx1QkFBdUIsR0FBRyw0Q0FBeUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM1RCx1QkFBdUIsR0FBRyxFQUFFLENBQUMsMkJBQTJCLENBQ3BELHVCQUF1QixFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RGLE9BQU8sdUNBQW9CLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCAqIGFzIGpzZG9jIGZyb20gJy4vanNkb2MnO1xuaW1wb3J0IHtjcmVhdGVOb3RFbWl0dGVkU3RhdGVtZW50LCByZXBvcnREaWFnbm9zdGljLCBzeW50aGVzaXplQ29tbWVudFJhbmdlcywgdXBkYXRlU291cmNlRmlsZU5vZGV9IGZyb20gJy4vdHJhbnNmb3JtZXJfdXRpbCc7XG5cbi8qKlxuICogQSBzZXQgb2YgSlNEb2MgdGFncyB0aGF0IG1hcmsgYSBjb21tZW50IGFzIGEgZmlsZW92ZXJ2aWV3IGNvbW1lbnQuIFRoZXNlIGFyZSByZWNvZ25pemVkIGJ5IG90aGVyXG4gKiBwaWVjZXMgb2YgaW5mcmFzdHJ1Y3R1cmUgKENsb3N1cmUgQ29tcGlsZXIsIG1vZHVsZSBzeXN0ZW0sIC4uLikuXG4gKi9cbmNvbnN0IEZJTEVPVkVSVklFV19DT01NRU5UX01BUktFUlM6IFJlYWRvbmx5U2V0PHN0cmluZz4gPVxuICAgIG5ldyBTZXQoWydmaWxlb3ZlcnZpZXcnLCAnZXh0ZXJucycsICdtb2ROYW1lJywgJ21vZHMnLCAncGludG9tb2R1bGUnXSk7XG5cbi8qKlxuICogR2l2ZW4gYSBwYXJzZWQgXFxAZmlsZW92ZXJ2aWV3IGNvbW1lbnQsIGVuc3VyZXMgaXQgaGFzIGFsbCB0aGUgYXR0cmlidXRlcyB3ZSBuZWVkLlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYmUgY2FsbGVkIHRvIG1vZGlmeSBhbiBleGlzdGluZyBjb21tZW50IG9yIHRvIG1ha2UgYSBuZXcgb25lLlxuICpcbiAqIEBwYXJhbSB0YWdzIENvbW1lbnQgYXMgcGFyc2VkIGxpc3Qgb2YgdGFnczsgbW9kaWZpZWQgaW4tcGxhY2UuXG4gKi9cbmZ1bmN0aW9uIGF1Z21lbnRGaWxlb3ZlcnZpZXdDb21tZW50cyh0YWdzOiBqc2RvYy5UYWdbXSkge1xuICAvLyBFbnN1cmUgd2Ugc3RhcnQgd2l0aCBhIEBmaWxlb3ZlcnZpZXcuXG4gIGlmICghdGFncy5maW5kKHQgPT4gdC50YWdOYW1lID09PSAnZmlsZW92ZXJ2aWV3JykpIHtcbiAgICB0YWdzLnNwbGljZSgwLCAwLCB7dGFnTmFtZTogJ2ZpbGVvdmVydmlldycsIHRleHQ6ICdhZGRlZCBieSB0c2lja2xlJ30pO1xuICB9XG5cbiAgLy8gRmluZCBvciBjcmVhdGUgYSBAc3VwcHJlc3MgdGFnLlxuICAvLyBDbG9zdXJlIGNvbXBpbGVyIGJhcmZzIGlmIHRoZXJlJ3MgYSBkdXBsaWNhdGVkIEBzdXBwcmVzcyB0YWcgaW4gYSBmaWxlLCBzbyB0aGUgdGFnIG11c3RcbiAgLy8gb25seSBhcHBlYXIgb25jZSBhbmQgYmUgbWVyZ2VkLlxuICBsZXQgc3VwcHJlc3NUYWcgPSB0YWdzLmZpbmQodCA9PiB0LnRhZ05hbWUgPT09ICdzdXBwcmVzcycpO1xuICBsZXQgc3VwcHJlc3Npb25zOiBTZXQ8c3RyaW5nPjtcbiAgaWYgKHN1cHByZXNzVGFnKSB7XG4gICAgc3VwcHJlc3Npb25zID0gbmV3IFNldCgoc3VwcHJlc3NUYWcudHlwZSB8fCAnJykuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSkpO1xuICB9IGVsc2Uge1xuICAgIHN1cHByZXNzVGFnID0ge3RhZ05hbWU6ICdzdXBwcmVzcycsIHRleHQ6ICdjaGVja2VkIGJ5IHRzYyd9O1xuICAgIHRhZ3MucHVzaChzdXBwcmVzc1RhZyk7XG4gICAgc3VwcHJlc3Npb25zID0gbmV3IFNldCgpO1xuICB9XG5cbiAgLy8gRW5zdXJlIG91ciBzdXBwcmVzc2lvbnMgYXJlIGluY2x1ZGVkIGluIHRoZSBAc3VwcHJlc3MgdGFnOlxuICAvLyAxKSBTdXBwcmVzcyBjaGVja1R5cGVzLiAgV2UgYmVsaWV2ZSB0aGUgY29kZSBoYXMgYWxyZWFkeSBiZWVuIHR5cGUtY2hlY2tlZCBieSBUeXBlU2NyaXB0LFxuICAvLyBhbmQgd2UgY2Fubm90IG1vZGVsIGFsbCB0aGUgVHlwZVNjcmlwdCB0eXBlIGRlY2lzaW9ucyBpbiBDbG9zdXJlIHN5bnRheC5cbiAgc3VwcHJlc3Npb25zLmFkZCgnY2hlY2tUeXBlcycpO1xuICAvLyAyKSBTdXBwcmVzcyBleHRyYVJlcXVpcmUuICBXZSByZW1vdmUgZXh0cmEgcmVxdWlyZXMgYXQgdGhlIFR5cGVTY3JpcHQgbGV2ZWwsIHNvIGFueSByZXF1aXJlXG4gIC8vIHRoYXQgZ2V0cyB0byB0aGUgSlMgbGV2ZWwgaXMgYSBsb2FkLWJlYXJpbmcgcmVxdWlyZS5cbiAgc3VwcHJlc3Npb25zLmFkZCgnZXh0cmFSZXF1aXJlJyk7XG4gIC8vIDMpIFN1cHByZXNzIHVzZWxlc3NDb2RlLiAgV2UgZW1pdCBhbiBcImlmIChmYWxzZSlcIiBhcm91bmQgdHlwZSBkZWNsYXJhdGlvbnMsXG4gIC8vIHdoaWNoIGlzIGZsYWdnZWQgYXMgdW51c2VkIGNvZGUgdW5sZXNzIHdlIHN1cHByZXNzIGl0LlxuICBzdXBwcmVzc2lvbnMuYWRkKCd1c2VsZXNzQ29kZScpO1xuICAvLyA0KSBTdXBwcmVzcyBzb21lIGNoZWNrcyBmb3IgdXNlciBlcnJvcnMgdGhhdCBUUyBhbHJlYWR5IGNoZWNrcy5cbiAgc3VwcHJlc3Npb25zLmFkZCgnbWlzc2luZ1JldHVybicpO1xuICBzdXBwcmVzc2lvbnMuYWRkKCd1bnVzZWRQcml2YXRlTWVtYmVycycpO1xuICAvLyA1KSBTdXBwcmVzcyBjaGVja2luZyBmb3IgQG92ZXJyaWRlLCBiZWNhdXNlIFRTIGRvZXNuJ3QgbW9kZWwgaXQuXG4gIHN1cHByZXNzaW9ucy5hZGQoJ21pc3NpbmdPdmVycmlkZScpO1xuICBzdXBwcmVzc1RhZy50eXBlID0gQXJyYXkuZnJvbShzdXBwcmVzc2lvbnMudmFsdWVzKCkpLnNvcnQoKS5qb2luKCcsJyk7XG5cbiAgcmV0dXJuIHRhZ3M7XG59XG5cbi8qKlxuICogQSB0cmFuc2Zvcm1lciB0aGF0IGVuc3VyZXMgdGhlIGVtaXR0ZWQgSlMgZmlsZSBoYXMgYW4gXFxAZmlsZW92ZXJ2aWV3IGNvbW1lbnQgdGhhdCBjb250YWlucyBhblxuICogXFxAc3VwcHJlc3Mge2NoZWNrVHlwZXN9IGFubm90YXRpb24gYnkgZWl0aGVyIGFkZGluZyBvciB1cGRhdGluZyBhbiBleGlzdGluZyBjb21tZW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRmlsZW92ZXJ2aWV3Q29tbWVudEZhY3RvcnkoZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSkge1xuICByZXR1cm4gKCk6IChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB0cy5Tb3VyY2VGaWxlID0+IHtcbiAgICBmdW5jdGlvbiBjaGVja05vRmlsZW92ZXJ2aWV3Q29tbWVudHMoXG4gICAgICAgIGNvbnRleHQ6IHRzLk5vZGUsIGNvbW1lbnRzOiBqc2RvYy5TeW50aGVzaXplZENvbW1lbnRXaXRoT3JpZ2luYWxbXSwgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbW1lbnQgb2YgY29tbWVudHMpIHtcbiAgICAgICAgY29uc3QgcGFyc2UgPSBqc2RvYy5wYXJzZShjb21tZW50KTtcbiAgICAgICAgaWYgKHBhcnNlICE9PSBudWxsICYmIHBhcnNlLnRhZ3Muc29tZSh0ID0+IEZJTEVPVkVSVklFV19DT01NRU5UX01BUktFUlMuaGFzKHQudGFnTmFtZSkpKSB7XG4gICAgICAgICAgLy8gUmVwb3J0IGEgd2FybmluZzsgdGhpcyBzaG91bGQgbm90IGJyZWFrIGNvbXBpbGF0aW9uIGluIHRoaXJkIHBhcnR5IGNvZGUuXG4gICAgICAgICAgcmVwb3J0RGlhZ25vc3RpYyhcbiAgICAgICAgICAgICAgZGlhZ25vc3RpY3MsIGNvbnRleHQsIG1lc3NhZ2UsIGNvbW1lbnQub3JpZ2luYWxSYW5nZSwgdHMuRGlhZ25vc3RpY0NhdGVnb3J5Lldhcm5pbmcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB7XG4gICAgICBjb25zdCB0ZXh0ID0gc291cmNlRmlsZS5nZXRGdWxsVGV4dCgpO1xuXG4gICAgICBsZXQgZmlsZUNvbW1lbnRzOiB0cy5TeW50aGVzaXplZENvbW1lbnRbXSA9IFtdO1xuICAgICAgY29uc3QgZmlyc3RTdGF0ZW1lbnQgPSBzb3VyY2VGaWxlLnN0YXRlbWVudHMubGVuZ3RoICYmIHNvdXJjZUZpbGUuc3RhdGVtZW50c1swXSB8fCBudWxsO1xuXG4gICAgICBjb25zdCBvcmlnaW5hbENvbW1lbnRzID0gdHMuZ2V0TGVhZGluZ0NvbW1lbnRSYW5nZXModGV4dCwgMCkgfHwgW107XG4gICAgICBpZiAoIWZpcnN0U3RhdGVtZW50KSB7XG4gICAgICAgIC8vIEluIGFuIGVtcHR5IHNvdXJjZSBmaWxlLCBhbGwgY29tbWVudHMgYXJlIGZpbGUtbGV2ZWwgY29tbWVudHMuXG4gICAgICAgIGZpbGVDb21tZW50cyA9IHN5bnRoZXNpemVDb21tZW50UmFuZ2VzKHNvdXJjZUZpbGUsIG9yaWdpbmFsQ29tbWVudHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU2VhcmNoIGZvciB0aGUgbGFzdCBjb21tZW50IHNwbGl0IGZyb20gdGhlIGZpbGUgd2l0aCBhIFxcblxcbi4gQWxsIGNvbW1lbnRzIGJlZm9yZSB0aGF0IGFyZVxuICAgICAgICAvLyBjb25zaWRlcmVkIGZpbGVvdmVydmlldyBjb21tZW50cywgYWxsIGNvbW1lbnRzIGFmdGVyIHRoYXQgYmVsb25nIHRvIHRoZSBuZXh0XG4gICAgICAgIC8vIHN0YXRlbWVudChzKS4gSWYgbm9uZSBmb3VuZCwgY29tbWVudHMgcmVtYWlucyBlbXB0eSwgYW5kIHRoZSBjb2RlIGJlbG93IHdpbGwgaW5zZXJ0IGEgbmV3XG4gICAgICAgIC8vIGZpbGVvdmVydmlldyBjb21tZW50LlxuICAgICAgICBmb3IgKGxldCBpID0gb3JpZ2luYWxDb21tZW50cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGNvbnN0IGVuZCA9IG9yaWdpbmFsQ29tbWVudHNbaV0uZW5kO1xuICAgICAgICAgIGlmICghdGV4dC5zdWJzdHJpbmcoZW5kKS5zdGFydHNXaXRoKCdcXG5cXG4nKSAmJlxuICAgICAgICAgICAgICAhdGV4dC5zdWJzdHJpbmcoZW5kKS5zdGFydHNXaXRoKCdcXHJcXG5cXHJcXG4nKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFRoaXMgY29tbWVudCBpcyBzZXBhcmF0ZWQgZnJvbSB0aGUgc291cmNlIGZpbGUgd2l0aCBhIGRvdWJsZSBicmVhaywgbWFya2luZyBpdCAoYW5kIGFueVxuICAgICAgICAgIC8vIHByZWNlZGluZyBjb21tZW50cykgYXMgYSBmaWxlLWxldmVsIGNvbW1lbnQuIFNwbGl0IHRoZW0gb2ZmIGFuZCBhdHRhY2ggdGhlbSBvbnRvIGFcbiAgICAgICAgICAvLyBOb3RFbWl0dGVkU3RhdGVtZW50LCBzbyB0aGF0IHRoZXkgZG8gbm90IGdldCBsb3N0IGxhdGVyIG9uLlxuICAgICAgICAgIGNvbnN0IHN5bnRoZXNpemVkQ29tbWVudHMgPSBqc2RvYy5zeW50aGVzaXplTGVhZGluZ0NvbW1lbnRzKGZpcnN0U3RhdGVtZW50KTtcbiAgICAgICAgICBjb25zdCBub3RFbWl0dGVkID0gdHMuY3JlYXRlTm90RW1pdHRlZFN0YXRlbWVudChzb3VyY2VGaWxlKTtcbiAgICAgICAgICAvLyBNb2RpZnkgdGhlIGNvbW1lbnRzIG9uIHRoZSBmaXJzdFN0YXRlbWVudCBpbiBwbGFjZSBieSByZW1vdmluZyB0aGUgZmlsZS1sZXZlbCBjb21tZW50cy5cbiAgICAgICAgICBmaWxlQ29tbWVudHMgPSBzeW50aGVzaXplZENvbW1lbnRzLnNwbGljZSgwLCBpICsgMSk7XG4gICAgICAgICAgLy8gTW92ZSB0aGUgZmlsZUNvbW1lbnRzIG9udG8gbm90RW1pdHRlZC5cbiAgICAgICAgICB0cy5zZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHMobm90RW1pdHRlZCwgZmlsZUNvbW1lbnRzKTtcbiAgICAgICAgICBzb3VyY2VGaWxlID0gdXBkYXRlU291cmNlRmlsZU5vZGUoXG4gICAgICAgICAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAgICAgICAgIHRzLmNyZWF0ZU5vZGVBcnJheShbbm90RW1pdHRlZCwgZmlyc3RTdGF0ZW1lbnQsIC4uLnNvdXJjZUZpbGUuc3RhdGVtZW50cy5zbGljZSgxKV0pKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gTm93IHdhbGsgZXZlcnkgdG9wIGxldmVsIHN0YXRlbWVudCBhbmQgZXNjYXBlL2Ryb3AgYW55IEBmaWxlb3ZlcnZpZXcgY29tbWVudHMgZm91bmQuXG4gICAgICAgIC8vIENsb3N1cmUgaWdub3JlcyBhbGwgQGZpbGVvdmVydmlldyBjb21tZW50cyBidXQgdGhlIGxhc3QsIHNvIHRzaWNrbGUgbXVzdCBtYWtlIHN1cmUgbm90IHRvXG4gICAgICAgIC8vIGVtaXQgZHVwbGljYXRlZCBvbmVzLlxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZUZpbGUuc3RhdGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IHN0bXQgPSBzb3VyY2VGaWxlLnN0YXRlbWVudHNbaV07XG4gICAgICAgICAgLy8gQWNjZXB0IHRoZSBOb3RFbWl0dGVkU3RhdGVtZW50IGluc2VydGVkIGFib3ZlLlxuICAgICAgICAgIGlmIChpID09PSAwICYmIHN0bXQua2luZCA9PT0gdHMuU3ludGF4S2luZC5Ob3RFbWl0dGVkU3RhdGVtZW50KSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBjb21tZW50cyA9IGpzZG9jLnN5bnRoZXNpemVMZWFkaW5nQ29tbWVudHMoc3RtdCk7XG4gICAgICAgICAgY2hlY2tOb0ZpbGVvdmVydmlld0NvbW1lbnRzKFxuICAgICAgICAgICAgICBzdG10LCBjb21tZW50cyxcbiAgICAgICAgICAgICAgYGZpbGUgY29tbWVudHMgbXVzdCBiZSBhdCB0aGUgdG9wIG9mIHRoZSBmaWxlLCBgICtcbiAgICAgICAgICAgICAgICAgIGBzZXBhcmF0ZWQgZnJvbSB0aGUgZmlsZSBib2R5IGJ5IGFuIGVtcHR5IGxpbmUuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ2xvc3VyZSBDb21waWxlciBjb25zaWRlcnMgdGhlICpsYXN0KiBjb21tZW50IHdpdGggQGZpbGVvdmVydmlldyAob3IgQGV4dGVybnMgb3JcbiAgICAgIC8vIEBub2NvbXBpbGUpIHRoYXQgaGFzIG5vdCBiZWVuIGF0dGFjaGVkIHRvIHNvbWUgb3RoZXIgdHJlZSBub2RlIHRvIGJlIHRoZSBmaWxlIG92ZXJ2aWV3XG4gICAgICAvLyBjb21tZW50LCBhbmQgb25seSBhcHBsaWVzIEBzdXBwcmVzcyB0YWdzIGZyb20gaXQuIEdvb2dsZS1pbnRlcm5hbCB0b29saW5nIGNvbnNpZGVycyAqYW55KlxuICAgICAgLy8gY29tbWVudCBtZW50aW9uaW5nIEBmaWxlb3ZlcnZpZXcuXG4gICAgICBsZXQgZmlsZW92ZXJ2aWV3SWR4ID0gLTE7XG4gICAgICBsZXQgdGFnczoganNkb2MuVGFnW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSBmaWxlQ29tbWVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgcGFyc2UgPSBqc2RvYy5wYXJzZUNvbnRlbnRzKGZpbGVDb21tZW50c1tpXS50ZXh0KTtcbiAgICAgICAgaWYgKHBhcnNlICE9PSBudWxsICYmIHBhcnNlLnRhZ3Muc29tZSh0ID0+IEZJTEVPVkVSVklFV19DT01NRU5UX01BUktFUlMuaGFzKHQudGFnTmFtZSkpKSB7XG4gICAgICAgICAgZmlsZW92ZXJ2aWV3SWR4ID0gaTtcbiAgICAgICAgICB0YWdzID0gcGFyc2UudGFncztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZmlsZW92ZXJ2aWV3SWR4ICE9PSAtMSkge1xuICAgICAgICBjaGVja05vRmlsZW92ZXJ2aWV3Q29tbWVudHMoXG4gICAgICAgICAgICBmaXJzdFN0YXRlbWVudCB8fCBzb3VyY2VGaWxlLCBmaWxlQ29tbWVudHMuc2xpY2UoMCwgZmlsZW92ZXJ2aWV3SWR4KSxcbiAgICAgICAgICAgIGBkdXBsaWNhdGUgZmlsZSBsZXZlbCBjb21tZW50YCk7XG4gICAgICB9XG5cbiAgICAgIGF1Z21lbnRGaWxlb3ZlcnZpZXdDb21tZW50cyh0YWdzKTtcbiAgICAgIGNvbnN0IGNvbW1lbnRUZXh0ID0ganNkb2MudG9TdHJpbmdXaXRob3V0U3RhcnRFbmQodGFncyk7XG5cbiAgICAgIGlmIChmaWxlb3ZlcnZpZXdJZHggPCAwKSB7XG4gICAgICAgIC8vIE5vIGV4aXN0aW5nIGNvbW1lbnQgdG8gbWVyZ2Ugd2l0aCwganVzdCBlbWl0IGEgbmV3IG9uZS5cbiAgICAgICAgcmV0dXJuIGFkZE5ld0ZpbGVvdmVydmlld0NvbW1lbnQoc291cmNlRmlsZSwgY29tbWVudFRleHQpO1xuICAgICAgfVxuXG4gICAgICBmaWxlQ29tbWVudHNbZmlsZW92ZXJ2aWV3SWR4XS50ZXh0ID0gY29tbWVudFRleHQ7XG4gICAgICAvLyBzZiBkb2VzIG5vdCBuZWVkIHRvIGJlIHVwZGF0ZWQsIHN5bnRoZXNpemVkIGNvbW1lbnRzIGFyZSBtdXRhYmxlLlxuICAgICAgcmV0dXJuIHNvdXJjZUZpbGU7XG4gICAgfTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gYWRkTmV3RmlsZW92ZXJ2aWV3Q29tbWVudChzZjogdHMuU291cmNlRmlsZSwgY29tbWVudFRleHQ6IHN0cmluZyk6IHRzLlNvdXJjZUZpbGUge1xuICBsZXQgc3ludGhldGljRmlyc3RTdGF0ZW1lbnQgPSBjcmVhdGVOb3RFbWl0dGVkU3RhdGVtZW50KHNmKTtcbiAgc3ludGhldGljRmlyc3RTdGF0ZW1lbnQgPSB0cy5hZGRTeW50aGV0aWNUcmFpbGluZ0NvbW1lbnQoXG4gICAgICBzeW50aGV0aWNGaXJzdFN0YXRlbWVudCwgdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhLCBjb21tZW50VGV4dCwgdHJ1ZSk7XG4gIHJldHVybiB1cGRhdGVTb3VyY2VGaWxlTm9kZShzZiwgdHMuY3JlYXRlTm9kZUFycmF5KFtzeW50aGV0aWNGaXJzdFN0YXRlbWVudCwgLi4uc2Yuc3RhdGVtZW50c10pKTtcbn1cbiJdfQ==