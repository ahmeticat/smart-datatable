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
        define("tsickle/src/jsdoc", ["require", "exports", "typescript"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ts = require("typescript");
    /**
     * A list of all JSDoc tags allowed by the Closure compiler.
     * All tags other than these are escaped before emitting.
     *
     * Note that some of these tags are also rejected by tsickle when seen in
     * the user-provided source, but also that tsickle itself may generate some of these.
     * This whitelist is just used for controlling the output.
     *
     * The public Closure docs don't list all the tags it allows; this list comes
     * from the compiler source itself.
     * https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/parsing/Annotation.java
     * https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/parsing/ParserConfig.properties
     */
    const JSDOC_TAGS_OUTPUT_WHITELIST = new Set([
        'abstract',
        'argument',
        'author',
        'consistentIdGenerator',
        'const',
        'constant',
        'constructor',
        'copyright',
        'define',
        'deprecated',
        'desc',
        'dict',
        'disposes',
        'enhance',
        'enhanceable',
        'enum',
        'export',
        'expose',
        'extends',
        'externs',
        'fileoverview',
        'final',
        'hassoydelcall',
        'hassoydeltemplate',
        'hidden',
        'id',
        'idGenerator',
        'ignore',
        'implements',
        'implicitCast',
        'inheritDoc',
        'interface',
        'jaggerInject',
        'jaggerModule',
        'jaggerProvide',
        'jaggerProvidePromise',
        'lends',
        'license',
        'link',
        'meaning',
        'modifies',
        'modName',
        'mods',
        'ngInject',
        'noalias',
        'nocollapse',
        'nocompile',
        'nosideeffects',
        'override',
        'owner',
        'package',
        'param',
        'pintomodule',
        'polymer',
        'polymerBehavior',
        'preserve',
        'preserveTry',
        'private',
        'protected',
        'public',
        'record',
        'requirecss',
        'requires',
        'return',
        'returns',
        'see',
        'stableIdGenerator',
        'struct',
        'suppress',
        'template',
        'this',
        'throws',
        'type',
        'typedef',
        'unrestricted',
        'version',
        'wizaction',
        'wizmodule',
    ]);
    /**
     * A list of JSDoc @tags that are never allowed in TypeScript source. These are Closure tags that
     * can be expressed in the TypeScript surface syntax. As tsickle's emit will mangle type names,
     * these will cause Closure Compiler issues and should not be used.
     * Note: 'template' is special-cased below; see where this set is queried.
     */
    const JSDOC_TAGS_INPUT_BLACKLIST = new Set([
        'augments', 'class', 'constructs', 'constructor', 'enum', 'extends', 'field',
        'function', 'implements', 'interface', 'lends', 'namespace', 'private', 'public',
        'record', 'static', 'template', 'this', 'type', 'typedef',
    ]);
    /**
     * JSDoc \@tags that might include a {type} after them. Specifying a type is forbidden, since it
     * would collide with TypeScript's type information. If a type *is* given, the entire tag will be
     * ignored.
     */
    const JSDOC_TAGS_WITH_TYPES = new Set([
        'const',
        'define',
        'export',
        'param',
        'return',
    ]);
    /**
     * parse parses JSDoc out of a comment string.
     * Returns null if comment is not JSDoc.
     */
    // TODO(martinprobst): representing JSDoc as a list of tags is too simplistic. We need functionality
    // such as merging (below), de-duplicating certain tags (@deprecated), and special treatment for
    // others (e.g. @suppress). We should introduce a proper model class with a more suitable data
    // strucure (e.g. a Map<TagName, Values[]>).
    function parse(comment) {
        // TODO(evanm): this is a pile of hacky regexes for now, because we
        // would rather use the better TypeScript implementation of JSDoc
        // parsing.  https://github.com/Microsoft/TypeScript/issues/7393
        if (comment.kind !== ts.SyntaxKind.MultiLineCommentTrivia)
            return null;
        // comment.text does not include /* and */, so must start with '*' for JSDoc.
        if (comment.text[0] !== '*')
            return null;
        const text = comment.text.substring(1).trim();
        return parseContents(text);
    }
    exports.parse = parse;
    /**
     * Returns the input string with line endings normalized to '\n'.
     */
    function normalizeLineEndings(input) {
        return input.replace(/\r\n/g, '\n');
    }
    exports.normalizeLineEndings = normalizeLineEndings;
    /**
     * parseContents parses JSDoc out of a comment text.
     * Returns null if comment is not JSDoc.
     *
     * @param commentText a comment's text content, i.e. the comment w/o /* and * /.
     */
    function parseContents(commentText) {
        // Make sure we have proper line endings before parsing on Windows.
        commentText = normalizeLineEndings(commentText);
        // Strip all the " * " bits from the front of each line.
        commentText = commentText.replace(/^\s*\*? ?/gm, '');
        const lines = commentText.split('\n');
        const tags = [];
        const warnings = [];
        for (const line of lines) {
            let match = line.match(/^\s*@(\S+) *(.*)/);
            if (match) {
                let [_, tagName, text] = match;
                if (tagName === 'returns') {
                    // A synonym for 'return'.
                    tagName = 'return';
                }
                let type;
                if (JSDOC_TAGS_INPUT_BLACKLIST.has(tagName)) {
                    if (tagName !== 'template') {
                        // Tell the user to not write blacklisted tags, because there is TS
                        // syntax available for them.
                        warnings.push(`@${tagName} annotations are redundant with TypeScript equivalents`);
                        continue; // Drop the tag so Closure won't process it.
                    }
                    else {
                        // But @template in particular is special: it's ok for the user to
                        // write it for documentation purposes, but we don't want the
                        // user-written one making it into the output because Closure interprets
                        // it as well.
                        // Drop it without any warning.  (We also don't ensure its correctness.)
                        continue;
                    }
                }
                else if (JSDOC_TAGS_WITH_TYPES.has(tagName)) {
                    if (text[0] === '{') {
                        warnings.push(`the type annotation on @${tagName} is redundant with its TypeScript type, ` +
                            `remove the {...} part`);
                        continue;
                    }
                }
                else if (tagName === 'suppress') {
                    const typeMatch = text.match(/^\{(.*)\}(.*)$/);
                    if (typeMatch) {
                        [, type, text] = typeMatch;
                    }
                    else {
                        warnings.push(`malformed @${tagName} tag: "${text}"`);
                    }
                }
                else if (tagName === 'dict') {
                    warnings.push('use index signatures (`[k: string]: type`) instead of @dict');
                    continue;
                }
                // Grab the parameter name from @param tags.
                let parameterName;
                if (tagName === 'param') {
                    match = text.match(/^(\S+) ?(.*)/);
                    if (match)
                        [_, parameterName, text] = match;
                }
                const tag = { tagName };
                if (parameterName)
                    tag.parameterName = parameterName;
                if (text)
                    tag.text = text;
                if (type)
                    tag.type = type;
                tags.push(tag);
            }
            else {
                // Text without a preceding @tag on it is either the plain text
                // documentation or a continuation of a previous tag.
                if (tags.length === 0) {
                    tags.push({ tagName: '', text: line });
                }
                else {
                    const lastTag = tags[tags.length - 1];
                    lastTag.text = (lastTag.text || '') + '\n' + line;
                }
            }
        }
        if (warnings.length > 0) {
            return { tags, warnings };
        }
        return { tags };
    }
    exports.parseContents = parseContents;
    /**
     * Serializes a Tag into a string usable in a comment.
     * Returns a string like " @foo {bar} baz" (note the whitespace).
     */
    function tagToString(tag, escapeExtraTags = new Set()) {
        let out = '';
        if (tag.tagName) {
            if (!JSDOC_TAGS_OUTPUT_WHITELIST.has(tag.tagName) || escapeExtraTags.has(tag.tagName)) {
                // Escape tags we don't understand.  This is a subtle
                // compromise between multiple issues.
                // 1) If we pass through these non-Closure tags, the user will
                //    get a warning from Closure, and the point of tsickle is
                //    to insulate the user from Closure.
                // 2) The output of tsickle is for Closure but also may be read
                //    by humans, for example non-TypeScript users of Angular.
                // 3) Finally, we don't want to warn because users should be
                //    free to add whichever JSDoc they feel like.  If the user
                //    wants help ensuring they didn't typo a tag, that is the
                //    responsibility of a linter.
                out += ` \\@${tag.tagName}`;
            }
            else {
                out += ` @${tag.tagName}`;
            }
        }
        if (tag.type) {
            out += ' {';
            if (tag.restParam) {
                out += '...';
            }
            out += tag.type;
            if (tag.optional) {
                out += '=';
            }
            out += '}';
        }
        if (tag.parameterName) {
            out += ' ' + tag.parameterName;
        }
        if (tag.text) {
            out += ' ' + tag.text.replace(/@/g, '\\@');
        }
        return out;
    }
    /** Tags that must only occur onces in a comment (filtered below). */
    const SINGLETON_TAGS = new Set(['deprecated']);
    /** Tags that conflict with \@type in Closure Compiler (e.g. \@param). */
    exports.TAGS_CONFLICTING_WITH_TYPE = new Set(['param', 'return']);
    /**
     * synthesizeLeadingComments parses the leading comments of node, converts them
     * to synthetic comments, and makes sure the original text comments do not get
     * emitted by TypeScript.
     */
    function synthesizeLeadingComments(node) {
        const existing = ts.getSyntheticLeadingComments(node);
        if (existing)
            return existing;
        const text = node.getFullText();
        const synthComments = getLeadingCommentRangesSynthesized(text, node.getFullStart());
        if (synthComments.length) {
            ts.setSyntheticLeadingComments(node, synthComments);
            suppressLeadingCommentsRecursively(node);
        }
        return synthComments;
    }
    exports.synthesizeLeadingComments = synthesizeLeadingComments;
    /**
     * parseLeadingCommentRangesSynthesized parses the leading comment ranges out of the given text and
     * converts them to SynthesizedComments.
     * @param offset the offset of text in the source file, e.g. node.getFullStart().
     */
    // VisibleForTesting
    function getLeadingCommentRangesSynthesized(text, offset = 0) {
        const comments = ts.getLeadingCommentRanges(text, 0) || [];
        return comments.map((cr) => {
            // Confusingly, CommentRange in TypeScript includes start and end markers, but
            // SynthesizedComments do not.
            const commentText = cr.kind === ts.SyntaxKind.SingleLineCommentTrivia ?
                text.substring(cr.pos + 2, cr.end) :
                text.substring(cr.pos + 2, cr.end - 2);
            return Object.assign({}, cr, { text: commentText, pos: -1, end: -1, originalRange: { pos: cr.pos + offset, end: cr.end + offset } });
        });
    }
    exports.getLeadingCommentRangesSynthesized = getLeadingCommentRangesSynthesized;
    /**
     * suppressCommentsRecursively prevents emit of leading comments on node, and any recursive nodes
     * underneath it that start at the same offset.
     */
    function suppressLeadingCommentsRecursively(node) {
        // TypeScript emits leading comments on a node, unless:
        // - the comment was emitted by the parent node
        // - the node has the NoLeadingComments emit flag.
        // However, transformation steps sometimes copy nodes without keeping their emit flags, so just
        // setting NoLeadingComments recursively is not enough, we must also set the text range to avoid
        // the copied node to have comments emitted.
        const originalStart = node.getFullStart();
        const actualStart = node.getStart();
        function suppressCommentsInternal(node) {
            ts.setEmitFlags(node, ts.EmitFlags.NoLeadingComments);
            return !!ts.forEachChild(node, (child) => {
                if (child.pos !== originalStart)
                    return true;
                return suppressCommentsInternal(child);
            });
        }
        suppressCommentsInternal(node);
    }
    exports.suppressLeadingCommentsRecursively = suppressLeadingCommentsRecursively;
    function toSynthesizedComment(tags, escapeExtraTags) {
        return {
            kind: ts.SyntaxKind.MultiLineCommentTrivia,
            text: toStringWithoutStartEnd(tags, escapeExtraTags),
            pos: -1,
            end: -1,
            hasTrailingNewLine: true,
        };
    }
    exports.toSynthesizedComment = toSynthesizedComment;
    /** Serializes a Comment out to a string, but does not include the start and end comment tokens. */
    function toStringWithoutStartEnd(tags, escapeExtraTags = new Set()) {
        return serialize(tags, false, escapeExtraTags);
    }
    exports.toStringWithoutStartEnd = toStringWithoutStartEnd;
    /** Serializes a Comment out to a string usable in source code. */
    function toString(tags, escapeExtraTags = new Set()) {
        return serialize(tags, true, escapeExtraTags);
    }
    exports.toString = toString;
    function serialize(tags, includeStartEnd, escapeExtraTags = new Set()) {
        if (tags.length === 0)
            return '';
        if (tags.length === 1) {
            const tag = tags[0];
            if ((tag.tagName === 'type' || tag.tagName === 'typedef' || tag.tagName === 'nocollapse') &&
                (!tag.text || !tag.text.match('\n'))) {
                // Special-case one-liner "type" and "nocollapse" tags to fit on one line, e.g.
                //   /** @type {foo} */
                const text = tagToString(tag, escapeExtraTags);
                return includeStartEnd ? `/**${text} */` : `*${text} `;
            }
            // Otherwise, fall through to the multi-line output.
        }
        let out = includeStartEnd ? '/**\n' : '*\n';
        const emitted = new Set();
        for (const tag of tags) {
            if (emitted.has(tag.tagName) && SINGLETON_TAGS.has(tag.tagName)) {
                continue;
            }
            emitted.add(tag.tagName);
            out += ' *';
            // If the tagToString is multi-line, insert " * " prefixes on subsequent lines.
            out += tagToString(tag, escapeExtraTags).split('\n').join('\n * ');
            out += '\n';
        }
        out += includeStartEnd ? ' */\n' : ' ';
        return out;
    }
    /** Merges multiple tags (of the same tagName type) into a single unified tag. */
    function merge(tags) {
        const tagNames = new Set();
        const parameterNames = new Set();
        const types = new Set();
        const texts = new Set();
        // If any of the tags are optional/rest, then the merged output is optional/rest.
        let optional = false;
        let restParam = false;
        for (const tag of tags) {
            tagNames.add(tag.tagName);
            if (tag.parameterName !== undefined)
                parameterNames.add(tag.parameterName);
            if (tag.type !== undefined)
                types.add(tag.type);
            if (tag.text !== undefined)
                texts.add(tag.text);
            if (tag.optional)
                optional = true;
            if (tag.restParam)
                restParam = true;
        }
        if (tagNames.size !== 1) {
            throw new Error(`cannot merge differing tags: ${JSON.stringify(tags)}`);
        }
        const tagName = tagNames.values().next().value;
        const parameterName = parameterNames.size > 0 ? Array.from(parameterNames).join('_or_') : undefined;
        const type = types.size > 0 ? Array.from(types).join('|') : undefined;
        // @template uses text (not type!) to declare its type parameters, with ','-separated text.
        const isTemplateTag = tagName === 'template';
        const text = texts.size > 0 ? Array.from(texts).join(isTemplateTag ? ',' : ' / ') : undefined;
        const tag = { tagName, parameterName, type, text };
        // Note: a param can either be optional or a rest param; if we merged an
        // optional and rest param together, prefer marking it as a rest param.
        if (restParam) {
            tag.restParam = true;
        }
        else if (optional) {
            tag.optional = true;
        }
        return tag;
    }
    exports.merge = merge;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNkb2MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvanNkb2MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCxpQ0FBaUM7SUFzQ2pDOzs7Ozs7Ozs7Ozs7T0FZRztJQUNILE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxHQUFHLENBQUM7UUFDMUMsVUFBVTtRQUNWLFVBQVU7UUFDVixRQUFRO1FBQ1IsdUJBQXVCO1FBQ3ZCLE9BQU87UUFDUCxVQUFVO1FBQ1YsYUFBYTtRQUNiLFdBQVc7UUFDWCxRQUFRO1FBQ1IsWUFBWTtRQUNaLE1BQU07UUFDTixNQUFNO1FBQ04sVUFBVTtRQUNWLFNBQVM7UUFDVCxhQUFhO1FBQ2IsTUFBTTtRQUNOLFFBQVE7UUFDUixRQUFRO1FBQ1IsU0FBUztRQUNULFNBQVM7UUFDVCxjQUFjO1FBQ2QsT0FBTztRQUNQLGVBQWU7UUFDZixtQkFBbUI7UUFDbkIsUUFBUTtRQUNSLElBQUk7UUFDSixhQUFhO1FBQ2IsUUFBUTtRQUNSLFlBQVk7UUFDWixjQUFjO1FBQ2QsWUFBWTtRQUNaLFdBQVc7UUFDWCxjQUFjO1FBQ2QsY0FBYztRQUNkLGVBQWU7UUFDZixzQkFBc0I7UUFDdEIsT0FBTztRQUNQLFNBQVM7UUFDVCxNQUFNO1FBQ04sU0FBUztRQUNULFVBQVU7UUFDVixTQUFTO1FBQ1QsTUFBTTtRQUNOLFVBQVU7UUFDVixTQUFTO1FBQ1QsWUFBWTtRQUNaLFdBQVc7UUFDWCxlQUFlO1FBQ2YsVUFBVTtRQUNWLE9BQU87UUFDUCxTQUFTO1FBQ1QsT0FBTztRQUNQLGFBQWE7UUFDYixTQUFTO1FBQ1QsaUJBQWlCO1FBQ2pCLFVBQVU7UUFDVixhQUFhO1FBQ2IsU0FBUztRQUNULFdBQVc7UUFDWCxRQUFRO1FBQ1IsUUFBUTtRQUNSLFlBQVk7UUFDWixVQUFVO1FBQ1YsUUFBUTtRQUNSLFNBQVM7UUFDVCxLQUFLO1FBQ0wsbUJBQW1CO1FBQ25CLFFB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Q2xGLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3RFLDJGQUEyRjtRQUMzRixNQUFNLGFBQWEsR0FBRyxPQUFPLEtBQUssVUFBVSxDQUFDO1FBQzdDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUM5RixNQUFNLEdBQUcsR0FBUSxFQUFDLE9BQU8sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ3RELHdFQUF3RTtRQUN4RSx1RUFBdUU7UUFDdkUsSUFBSSxTQUFTLEVBQUU7WUFDYixHQUFHLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztTQUN0QjthQUFNLElBQUksUUFBUSxFQUFFO1lBQ25CLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1NBQ3JCO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBcENELHNCQW9DQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbi8qKlxuICogVHlwZVNjcmlwdCBoYXMgYW4gQVBJIGZvciBKU0RvYyBhbHJlYWR5LCBidXQgaXQncyBub3QgZXhwb3NlZC5cbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNzM5M1xuICogRm9yIG5vdyB3ZSBjcmVhdGUgdHlwZXMgdGhhdCBhcmUgc2ltaWxhciB0byB0aGVpcnMgc28gdGhhdCBtaWdyYXRpbmdcbiAqIHRvIHRoZWlyIEFQSSB3aWxsIGJlIGVhc2llci4gIFNlZSBlLmcuIHRzLkpTRG9jVGFnIGFuZCB0cy5KU0RvY0NvbW1lbnQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVGFnIHtcbiAgLyoqXG4gICAqIHRhZ05hbWUgaXMgZS5nLiBcInBhcmFtXCIgaW4gYW4gQHBhcmFtIGRlY2xhcmF0aW9uLiAgSXQgaXMgdGhlIGVtcHR5IHN0cmluZ1xuICAgKiBmb3IgdGhlIHBsYWluIHRleHQgZG9jdW1lbnRhdGlvbiB0aGF0IG9jY3VycyBiZWZvcmUgYW55IEBmb28gbGluZXMuXG4gICAqL1xuICB0YWdOYW1lOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBwYXJhbWV0ZXJOYW1lIGlzIHRoZSB0aGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gcGFyYW1ldGVyLCBlLmcuIFwiZm9vXCJcbiAgICogaW4gYFxcQHBhcmFtIGZvbyBUaGUgZm9vIHBhcmFtYFxuICAgKi9cbiAgcGFyYW1ldGVyTmFtZT86IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSB0eXBlIG9mIGEgSlNEb2MgXFxAcGFyYW0sIFxcQHR5cGUgZXRjIHRhZywgcmVuZGVyZWQgaW4gY3VybHkgYnJhY2VzLlxuICAgKiBDYW4gYWxzbyBob2xkIHRoZSB0eXBlIG9mIGFuIFxcQHN1cHByZXNzLlxuICAgKi9cbiAgdHlwZT86IHN0cmluZztcbiAgLyoqIG9wdGlvbmFsIGlzIHRydWUgZm9yIG9wdGlvbmFsIGZ1bmN0aW9uIHBhcmFtZXRlcnMuICovXG4gIG9wdGlvbmFsPzogYm9vbGVhbjtcbiAgLyoqIHJlc3RQYXJhbSBpcyB0cnVlIGZvciBcIi4uLng6IGZvb1tdXCIgZnVuY3Rpb24gcGFyYW1ldGVycy4gKi9cbiAgcmVzdFBhcmFtPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIGRlc3RydWN0dXJpbmcgaXMgdHJ1ZSBmb3IgZGVzdHJ1Y3R1cmluZyBiaW5kIHBhcmFtZXRlcnMsIHdoaWNoIHJlcXVpcmVcbiAgICogbm9uLW51bGwgYXJndW1lbnRzIG9uIHRoZSBDbG9zdXJlIHNpZGUuICBDYW4gbGlrZWx5IHJlbW92ZSB0aGlzXG4gICAqIG9uY2UgVHlwZVNjcmlwdCBudWxsYWJsZSB0eXBlcyBhcmUgYXZhaWxhYmxlLlxuICAgKi9cbiAgZGVzdHJ1Y3R1cmluZz86IGJvb2xlYW47XG4gIC8qKiBBbnkgcmVtYWluaW5nIHRleHQgb24gdGhlIHRhZywgZS5nLiB0aGUgZGVzY3JpcHRpb24uICovXG4gIHRleHQ/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQSBsaXN0IG9mIGFsbCBKU0RvYyB0YWdzIGFsbG93ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG4gKiBBbGwgdGFncyBvdGhlciB0aGFuIHRoZXNlIGFyZSBlc2NhcGVkIGJlZm9yZSBlbWl0dGluZy5cbiAqXG4gKiBOb3RlIHRoYXQgc29tZSBvZiB0aGVzZSB0YWdzIGFyZSBhbHNvIHJlamVjdGVkIGJ5IHRzaWNrbGUgd2hlbiBzZWVuIGluXG4gKiB0aGUgdXNlci1wcm92aWRlZCBzb3VyY2UsIGJ1dCBhbHNvIHRoYXQgdHNpY2tsZSBpdHNlbGYgbWF5IGdlbmVyYXRlIHNvbWUgb2YgdGhlc2UuXG4gKiBUaGlzIHdoaXRlbGlzdCBpcyBqdXN0IHVzZWQgZm9yIGNvbnRyb2xsaW5nIHRoZSBvdXRwdXQuXG4gKlxuICogVGhlIHB1YmxpYyBDbG9zdXJlIGRvY3MgZG9uJ3QgbGlzdCBhbGwgdGhlIHRhZ3MgaXQgYWxsb3dzOyB0aGlzIGxpc3QgY29tZXNcbiAqIGZyb20gdGhlIGNvbXBpbGVyIHNvdXJjZSBpdHNlbGYuXG4gKiBodHRwczovL2dpdGh1Yi5jb20vZ29vZ2xlL2Nsb3N1cmUtY29tcGlsZXIvYmxvYi9tYXN0ZXIvc3JjL2NvbS9nb29nbGUvamF2YXNjcmlwdC9qc2NvbXAvcGFyc2luZy9Bbm5vdGF0aW9uLmphdmFcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9nb29nbGUvY2xvc3VyZS1jb21waWxlci9ibG9iL21hc3Rlci9zcmMvY29tL2dvb2dsZS9qYXZhc2NyaXB0L2pzY29tcC9wYXJzaW5nL1BhcnNlckNvbmZpZy5wcm9wZXJ0aWVzXG4gKi9cbmNvbnN0IEpTRE9DX1RBR1NfT1VUUFVUX1dISVRFTElTVCA9IG5ldyBTZXQoW1xuICAnYWJzdHJhY3QnLFxuICAnYXJndW1lbnQnLFxuICAnYXV0aG9yJyxcbiAgJ2NvbnNpc3RlbnRJZEdlbmVyYXRvcicsXG4gICdjb25zdCcsXG4gICdjb25zdGFudCcsXG4gICdjb25zdHJ1Y3RvcicsXG4gICdjb3B5cmlnaHQnLFxuICAnZGVmaW5lJyxcbiAgJ2RlcHJlY2F0ZWQnLFxuICAnZGVzYycsXG4gICdkaWN0JyxcbiAgJ2Rpc3Bvc2VzJyxcbiAgJ2VuaGFuY2UnLFxuICAnZW5oYW5jZWFibGUnLFxuICAnZW51bScsXG4gICdleHBvcnQnLFxuICAnZXhwb3NlJyxcbiAgJ2V4dGVuZHMnLFxuICAnZXh0ZXJucycsXG4gICdmaWxlb3ZlcnZpZXcnLFxuICAnZmluYWwnLFxuICAnaGFzc295ZGVsY2FsbCcsXG4gICdoYXNzb3lkZWx0ZW1wbGF0ZScsXG4gICdoaWRkZW4nLFxuICAnaWQnLFxuICAnaWRHZW5lcmF0b3InLFxuICAnaWdub3JlJyxcbiAgJ2ltcGxlbWVudHMnLFxuICAnaW1wbGljaXRDYXN0JyxcbiAgJ2luaGVyaXREb2MnLFxuICAnaW50ZXJmYWNlJyxcbiAgJ2phZ2dlckluamVjdCcsXG4gICdqYWdnZXJNb2R1bGUnLFxuICAnamFnZ2VyUHJvdmlkZScsXG4gICdqYWdnZXJQcm92aWRlUHJvbWlzZScsXG4gICdsZW5kcycsXG4gICdsaWNlbnNlJyxcbiAgJ2xpbmsnLFxuICAnbWVhbmluZycsXG4gICdtb2RpZmllcycsXG4gICdtb2ROYW1lJyxcbiAgJ21vZHMnLFxuICAnbmdJbmplY3QnLFxuICAnbm9hbGlhcycsXG4gICdub2NvbGxhcHNlJyxcbiAgJ25vY29tcGlsZScsXG4gICdub3NpZGVlZmZlY3RzJyxcbiAgJ292ZXJyaWRlJyxcbiAgJ293bmVyJyxcbiAgJ3BhY2thZ2UnLFxuICAncGFyYW0nLFxuICAncGludG9tb2R1bGUnLFxuICAncG9seW1lcicsXG4gICdwb2x5bWVyQmVoYXZpb3InLFxuICAncHJlc2VydmUnLFxuICAncHJlc2VydmVUcnknLFxuICAncHJpdmF0ZScsXG4gICdwcm90ZWN0ZWQnLFxuICAncHVibGljJyxcbiAgJ3JlY29yZCcsXG4gICdyZXF1aXJlY3NzJyxcbiAgJ3JlcXVpcmVzJyxcbiAgJ3JldHVybicsXG4gICdyZXR1cm5zJyxcbiAgJ3NlZScsXG4gICdzdGFibGVJZEdlbmVyYXRvcicsXG4gICdzdHJ1Y3QnLFxuICAnc3VwcHJlc3MnLFxuICAndGVtcGxhdGUnLFxuICAndGhpcycsXG4gICd0aHJvd3MnLFxuICAndHlwZScsXG4gICd0eXBlZGVmJyxcbiAgJ3VucmVzdHJpY3RlZCcsXG4gICd2ZXJzaW9uJyxcbiAgJ3dpemFjdGlvbicsXG4gICd3aXptb2R1bGUnLFxuXSk7XG5cbi8qKlxuICogQSBsaXN0IG9mIEpTRG9jIEB0YWdzIHRoYXQgYXJlIG5ldmVyIGFsbG93ZWQgaW4gVHlwZVNjcmlwdCBzb3VyY2UuIFRoZXNlIGFyZSBDbG9zdXJlIHRhZ3MgdGhhdFxuICogY2FuIGJlIGV4cHJlc3NlZCBpbiB0aGUgVHlwZVNjcmlwdCBzdXJmYWNlIHN5bnRheC4gQXMgdHNpY2tsZSdzIGVtaXQgd2lsbCBtYW5nbGUgdHlwZSBuYW1lcyxcbiAqIHRoZXNlIHdpbGwgY2F1c2UgQ2xvc3VyZSBDb21waWxlciBpc3N1ZXMgYW5kIHNob3VsZCBub3QgYmUgdXNlZC5cbiAqIE5vdGU6ICd0ZW1wbGF0ZScgaXMgc3BlY2lhbC1jYXNlZCBiZWxvdzsgc2VlIHdoZXJlIHRoaXMgc2V0IGlzIHF1ZXJpZWQuXG4gKi9cbmNvbnN0IEpTRE9DX1RBR1NfSU5QVVRfQkxBQ0tMSVNUID0gbmV3IFNldChbXG4gICdhdWdtZW50cycsICdjbGFzcycsICAgICAgJ2NvbnN0cnVjdHMnLCAnY29uc3RydWN0b3InLCAnZW51bScsICAgICAgJ2V4dGVuZHMnLCAnZmllbGQnLFxuICAnZnVuY3Rpb24nLCAnaW1wbGVtZW50cycsICdpbnRlcmZhY2UnLCAgJ2xlbmRzJywgICAgICAgJ25hbWVzcGFjZScsICdwcml2YXRlJywgJ3B1YmxpYycsXG4gICdyZWNvcmQnLCAgICdzdGF0aWMnLCAgICAgJ3RlbXBsYXRlJywgICAndGhpcycsICAgICAgICAndHlwZScsICAgICAgJ3R5cGVkZWYnLFxuXSk7XG5cbi8qKlxuICogSlNEb2MgXFxAdGFncyB0aGF0IG1pZ2h0IGluY2x1ZGUgYSB7dHlwZX0gYWZ0ZXIgdGhlbS4gU3BlY2lmeWluZyBhIHR5cGUgaXMgZm9yYmlkZGVuLCBzaW5jZSBpdFxuICogd291bGQgY29sbGlkZSB3aXRoIFR5cGVTY3JpcHQncyB0eXBlIGluZm9ybWF0aW9uLiBJZiBhIHR5cGUgKmlzKiBnaXZlbiwgdGhlIGVudGlyZSB0YWcgd2lsbCBiZVxuICogaWdub3JlZC5cbiAqL1xuY29uc3QgSlNET0NfVEFHU19XSVRIX1RZUEVTID0gbmV3IFNldChbXG4gICdjb25zdCcsXG4gICdkZWZpbmUnLFxuICAnZXhwb3J0JyxcbiAgJ3BhcmFtJyxcbiAgJ3JldHVybicsXG5dKTtcblxuLyoqXG4gKiBSZXN1bHQgb2YgcGFyc2luZyBhIEpTRG9jIGNvbW1lbnQuIFN1Y2ggY29tbWVudHMgZXNzZW50aWFsbHkgYXJlIGJ1aWx0IG9mIGEgbGlzdCBvZiB0YWdzLlxuICogSW4gYWRkaXRpb24gdG8gdGhlIHRhZ3MsIHRoaXMgbWlnaHQgYWxzbyBjb250YWluIHdhcm5pbmdzIHRvIGluZGljYXRlIG5vbi1mYXRhbCBwcm9ibGVtc1xuICogd2hpbGUgZmluZGluZyB0aGUgdGFncy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRKU0RvY0NvbW1lbnQge1xuICB0YWdzOiBUYWdbXTtcbiAgd2FybmluZ3M/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBwYXJzZSBwYXJzZXMgSlNEb2Mgb3V0IG9mIGEgY29tbWVudCBzdHJpbmcuXG4gKiBSZXR1cm5zIG51bGwgaWYgY29tbWVudCBpcyBub3QgSlNEb2MuXG4gKi9cbi8vIFRPRE8obWFydGlucHJvYnN0KTogcmVwcmVzZW50aW5nIEpTRG9jIGFzIGEgbGlzdCBvZiB0YWdzIGlzIHRvbyBzaW1wbGlzdGljLiBXZSBuZWVkIGZ1bmN0aW9uYWxpdHlcbi8vIHN1Y2ggYXMgbWVyZ2luZyAoYmVsb3cpLCBkZS1kdXBsaWNhdGluZyBjZXJ0YWluIHRhZ3MgKEBkZXByZWNhdGVkKSwgYW5kIHNwZWNpYWwgdHJlYXRtZW50IGZvclxuLy8gb3RoZXJzIChlLmcuIEBzdXBwcmVzcykuIFdlIHNob3VsZCBpbnRyb2R1Y2UgYSBwcm9wZXIgbW9kZWwgY2xhc3Mgd2l0aCBhIG1vcmUgc3VpdGFibGUgZGF0YVxuLy8gc3RydWN1cmUgKGUuZy4gYSBNYXA8VGFnTmFtZSwgVmFsdWVzW10+KS5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShjb21tZW50OiB0cy5TeW50aGVzaXplZENvbW1lbnQpOiBQYXJzZWRKU0RvY0NvbW1lbnR8bnVsbCB7XG4gIC8vIFRPRE8oZXZhbm0pOiB0aGlzIGlzIGEgcGlsZSBvZiBoYWNreSByZWdleGVzIGZvciBub3csIGJlY2F1c2Ugd2VcbiAgLy8gd291bGQgcmF0aGVyIHVzZSB0aGUgYmV0dGVyIFR5cGVTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgSlNEb2NcbiAgLy8gcGFyc2luZy4gIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNzM5M1xuICBpZiAoY29tbWVudC5raW5kICE9PSB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEpIHJldHVybiBudWxsO1xuICAvLyBjb21tZW50LnRleHQgZG9lcyBub3QgaW5jbHVkZSAvKiBhbmQgKi8sIHNvIG11c3Qgc3RhcnQgd2l0aCAnKicgZm9yIEpTRG9jLlxuICBpZiAoY29tbWVudC50ZXh0WzBdICE9PSAnKicpIHJldHVybiBudWxsO1xuICBjb25zdCB0ZXh0ID0gY29tbWVudC50ZXh0LnN1YnN0cmluZygxKS50cmltKCk7XG4gIHJldHVybiBwYXJzZUNvbnRlbnRzKHRleHQpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGlucHV0IHN0cmluZyB3aXRoIGxpbmUgZW5kaW5ncyBub3JtYWxpemVkIHRvICdcXG4nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplTGluZUVuZGluZ3MoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dC5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpO1xufVxuXG4vKipcbiAqIHBhcnNlQ29udGVudHMgcGFyc2VzIEpTRG9jIG91dCBvZiBhIGNvbW1lbnQgdGV4dC5cbiAqIFJldHVybnMgbnVsbCBpZiBjb21tZW50IGlzIG5vdCBKU0RvYy5cbiAqXG4gKiBAcGFyYW0gY29tbWVudFRleHQgYSBjb21tZW50J3MgdGV4dCBjb250ZW50LCBpLmUuIHRoZSBjb21tZW50IHcvbyAvKiBhbmQgKiAvLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb250ZW50cyhjb21tZW50VGV4dDogc3RyaW5nKTogUGFyc2VkSlNEb2NDb21tZW50fG51bGwge1xuICAvLyBNYWtlIHN1cmUgd2UgaGF2ZSBwcm9wZXIgbGluZSBlbmRpbmdzIGJlZm9yZSBwYXJzaW5nIG9uIFdpbmRvd3MuXG4gIGNvbW1lbnRUZXh0ID0gbm9ybWFsaXplTGluZUVuZGluZ3MoY29tbWVudFRleHQpO1xuICAvLyBTdHJpcCBhbGwgdGhlIFwiICogXCIgYml0cyBmcm9tIHRoZSBmcm9udCBvZiBlYWNoIGxpbmUuXG4gIGNvbW1lbnRUZXh0ID0gY29tbWVudFRleHQucmVwbGFjZSgvXlxccypcXCo/ID8vZ20sICcnKTtcbiAgY29uc3QgbGluZXMgPSBjb21tZW50VGV4dC5zcGxpdCgnXFxuJyk7XG4gIGNvbnN0IHRhZ3M6IFRhZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKkAoXFxTKykgKiguKikvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGxldCBbXywgdGFnTmFtZSwgdGV4dF0gPSBtYXRjaDtcbiAgICAgIGlmICh0YWdOYW1lID09PSAncmV0dXJucycpIHtcbiAgICAgICAgLy8gQSBzeW5vbnltIGZvciAncmV0dXJuJy5cbiAgICAgICAgdGFnTmFtZSA9ICdyZXR1cm4nO1xuICAgICAgfVxuICAgICAgbGV0IHR5cGU6IHN0cmluZ3x1bmRlZmluZWQ7XG4gICAgICBpZiAoSlNET0NfVEFHU19JTlBVVF9CTEFDS0xJU1QuaGFzKHRhZ05hbWUpKSB7XG4gICAgICAgIGlmICh0YWdOYW1lICE9PSAndGVtcGxhdGUnKSB7XG4gICAgICAgICAgLy8gVGVsbCB0aGUgdXNlciB0byBub3Qgd3JpdGUgYmxhY2tsaXN0ZWQgdGFncywgYmVjYXVzZSB0aGVyZSBpcyBUU1xuICAgICAgICAgIC8vIHN5bnRheCBhdmFpbGFibGUgZm9yIHRoZW0uXG4gICAgICAgICAgd2FybmluZ3MucHVzaChgQCR7dGFnTmFtZX0gYW5ub3RhdGlvbnMgYXJlIHJlZHVuZGFudCB3aXRoIFR5cGVTY3JpcHQgZXF1aXZhbGVudHNgKTtcbiAgICAgICAgICBjb250aW51ZTsgIC8vIERyb3AgdGhlIHRhZyBzbyBDbG9zdXJlIHdvbid0IHByb2Nlc3MgaXQuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQnV0IEB0ZW1wbGF0ZSBpbiBwYXJ0aWN1bGFyIGlzIHNwZWNpYWw6IGl0J3Mgb2sgZm9yIHRoZSB1c2VyIHRvXG4gICAgICAgICAgLy8gd3JpdGUgaXQgZm9yIGRvY3VtZW50YXRpb24gcHVycG9zZXMsIGJ1dCB3ZSBkb24ndCB3YW50IHRoZVxuICAgICAgICAgIC8vIHVzZXItd3JpdHRlbiBvbmUgbWFraW5nIGl0IGludG8gdGhlIG91dHB1dCBiZWNhdXNlIENsb3N1cmUgaW50ZXJwcmV0c1xuICAgICAgICAgIC8vIGl0IGFzIHdlbGwuXG4gICAgICAgICAgLy8gRHJvcCBpdCB3aXRob3V0IGFueSB3YXJuaW5nLiAgKFdlIGFsc28gZG9uJ3QgZW5zdXJlIGl0cyBjb3JyZWN0bmVzcy4pXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoSlNET0NfVEFHU19XSVRIX1RZUEVTLmhhcyh0YWdOYW1lKSkge1xuICAgICAgICBpZiAodGV4dFswXSA9PT0gJ3snKSB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaChcbiAgICAgICAgICAgICAgYHRoZSB0eXBlIGFubm90YXRpb24gb24gQCR7dGFnTmFtZX0gaXMgcmVkdW5kYW50IHdpdGggaXRzIFR5cGVTY3JpcHQgdHlwZSwgYCArXG4gICAgICAgICAgICAgIGByZW1vdmUgdGhlIHsuLi59IHBhcnRgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YWdOYW1lID09PSAnc3VwcHJlc3MnKSB7XG4gICAgICAgIGNvbnN0IHR5cGVNYXRjaCA9IHRleHQubWF0Y2goL15cXHsoLiopXFx9KC4qKSQvKTtcbiAgICAgICAgaWYgKHR5cGVNYXRjaCkge1xuICAgICAgICAgIFssIHR5cGUsIHRleHRdID0gdHlwZU1hdGNoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goYG1hbGZvcm1lZCBAJHt0YWdOYW1lfSB0YWc6IFwiJHt0ZXh0fVwiYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGFnTmFtZSA9PT0gJ2RpY3QnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ3VzZSBpbmRleCBzaWduYXR1cmVzIChgW2s6IHN0cmluZ106IHR5cGVgKSBpbnN0ZWFkIG9mIEBkaWN0Jyk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBHcmFiIHRoZSBwYXJhbWV0ZXIgbmFtZSBmcm9tIEBwYXJhbSB0YWdzLlxuICAgICAgbGV0IHBhcmFtZXRlck5hbWU6IHN0cmluZ3x1bmRlZmluZWQ7XG4gICAgICBpZiAodGFnTmFtZSA9PT0gJ3BhcmFtJykge1xuICAgICAgICBtYXRjaCA9IHRleHQubWF0Y2goL14oXFxTKykgPyguKikvKTtcbiAgICAgICAgaWYgKG1hdGNoKSBbXywgcGFyYW1ldGVyTmFtZSwgdGV4dF0gPSBtYXRjaDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGFnOiBUYWcgPSB7dGFnTmFtZX07XG4gICAgICBpZiAocGFyYW1ldGVyTmFtZSkgdGFnLnBhcmFtZXRlck5hbWUgPSBwYXJhbWV0ZXJOYW1lO1xuICAgICAgaWYgKHRleHQpIHRhZy50ZXh0ID0gdGV4dDtcbiAgICAgIGlmICh0eXBlKSB0YWcudHlwZSA9IHR5cGU7XG4gICAgICB0YWdzLnB1c2godGFnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGV4dCB3aXRob3V0IGEgcHJlY2VkaW5nIEB0YWcgb24gaXQgaXMgZWl0aGVyIHRoZSBwbGFpbiB0ZXh0XG4gICAgICAvLyBkb2N1bWVudGF0aW9uIG9yIGEgY29udGludWF0aW9uIG9mIGEgcHJldmlvdXMgdGFnLlxuICAgICAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogJycsIHRleHQ6IGxpbmV9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGxhc3RUYWcgPSB0YWdzW3RhZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIGxhc3RUYWcudGV4dCA9IChsYXN0VGFnLnRleHQgfHwgJycpICsgJ1xcbicgKyBsaW5lO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7dGFncywgd2FybmluZ3N9O1xuICB9XG4gIHJldHVybiB7dGFnc307XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBhIFRhZyBpbnRvIGEgc3RyaW5nIHVzYWJsZSBpbiBhIGNvbW1lbnQuXG4gKiBSZXR1cm5zIGEgc3RyaW5nIGxpa2UgXCIgQGZvbyB7YmFyfSBiYXpcIiAobm90ZSB0aGUgd2hpdGVzcGFjZSkuXG4gKi9cbmZ1bmN0aW9uIHRhZ1RvU3RyaW5nKHRhZzogVGFnLCBlc2NhcGVFeHRyYVRhZ3MgPSBuZXcgU2V0PHN0cmluZz4oKSk6IHN0cmluZyB7XG4gIGxldCBvdXQgPSAnJztcbiAgaWYgKHRhZy50YWdOYW1lKSB7XG4gICAgaWYgKCFKU0RPQ19UQUdTX09VVFBVVF9XSElURUxJU1QuaGFzKHRhZy50YWdOYW1lKSB8fCBlc2NhcGVFeHRyYVRhZ3MuaGFzKHRhZy50YWdOYW1lKSkge1xuICAgICAgLy8gRXNjYXBlIHRhZ3Mgd2UgZG9uJ3QgdW5kZXJzdGFuZC4gIFRoaXMgaXMgYSBzdWJ0bGVcbiAgICAgIC8vIGNvbXByb21pc2UgYmV0d2VlbiBtdWx0aXBsZSBpc3N1ZXMuXG4gICAgICAvLyAxKSBJZiB3ZSBwYXNzIHRocm91Z2ggdGhlc2Ugbm9uLUNsb3N1cmUgdGFncywgdGhlIHVzZXIgd2lsbFxuICAgICAgLy8gICAgZ2V0IGEgd2FybmluZyBmcm9tIENsb3N1cmUsIGFuZCB0aGUgcG9pbnQgb2YgdHNpY2tsZSBpc1xuICAgICAgLy8gICAgdG8gaW5zdWxhdGUgdGhlIHVzZXIgZnJvbSBDbG9zdXJlLlxuICAgICAgLy8gMikgVGhlIG91dHB1dCBvZiB0c2lja2xlIGlzIGZvciBDbG9zdXJlIGJ1dCBhbHNvIG1heSBiZSByZWFkXG4gICAgICAvLyAgICBieSBodW1hbnMsIGZvciBleGFtcGxlIG5vbi1UeXBlU2NyaXB0IHVzZXJzIG9mIEFuZ3VsYXIuXG4gICAgICAvLyAzKSBGaW5hbGx5LCB3ZSBkb24ndCB3YW50IHRvIHdhcm4gYmVjYXVzZSB1c2VycyBzaG91bGQgYmVcbiAgICAgIC8vICAgIGZyZWUgdG8gYWRkIHdoaWNoZXZlciBKU0RvYyB0aGV5IGZlZWwgbGlrZS4gIElmIHRoZSB1c2VyXG4gICAgICAvLyAgICB3YW50cyBoZWxwIGVuc3VyaW5nIHRoZXkgZGlkbid0IHR5cG8gYSB0YWcsIHRoYXQgaXMgdGhlXG4gICAgICAvLyAgICByZXNwb25zaWJpbGl0eSBvZiBhIGxpbnRlci5cbiAgICAgIG91dCArPSBgIFxcXFxAJHt0YWcudGFnTmFtZX1gO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXQgKz0gYCBAJHt0YWcudGFnTmFtZX1gO1xuICAgIH1cbiAgfVxuICBpZiAodGFnLnR5cGUpIHtcbiAgICBvdXQgKz0gJyB7JztcbiAgICBpZiAodGFnLnJlc3RQYXJhbSkge1xuICAgICAgb3V0ICs9ICcuLi4nO1xuICAgIH1cbiAgICBvdXQgKz0gdGFnLnR5cGU7XG4gICAgaWYgKHRhZy5vcHRpb25hbCkge1xuICAgICAgb3V0ICs9ICc9JztcbiAgICB9XG4gICAgb3V0ICs9ICd9JztcbiAgfVxuICBpZiAodGFnLnBhcmFtZXRlck5hbWUpIHtcbiAgICBvdXQgKz0gJyAnICsgdGFnLnBhcmFtZXRlck5hbWU7XG4gIH1cbiAgaWYgKHRhZy50ZXh0KSB7XG4gICAgb3V0ICs9ICcgJyArIHRhZy50ZXh0LnJlcGxhY2UoL0AvZywgJ1xcXFxAJyk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqIFRhZ3MgdGhhdCBtdXN0IG9ubHkgb2NjdXIgb25jZXMgaW4gYSBjb21tZW50IChmaWx0ZXJlZCBiZWxvdykuICovXG5jb25zdCBTSU5HTEVUT05fVEFHUyA9IG5ldyBTZXQoWydkZXByZWNhdGVkJ10pO1xuXG4vKiogVGFncyB0aGF0IGNvbmZsaWN0IHdpdGggXFxAdHlwZSBpbiBDbG9zdXJlIENvbXBpbGVyIChlLmcuIFxcQHBhcmFtKS4gKi9cbmV4cG9ydCBjb25zdCBUQUdTX0NPTkZMSUNUSU5HX1dJVEhfVFlQRSA9IG5ldyBTZXQoWydwYXJhbScsICdyZXR1cm4nXSk7XG5cbi8qKlxuICogQSBzeW50aGVzaXplZCBjb21tZW50IHRoYXQgKHBvc3NpYmx5KSBpbmNsdWRlcyB0aGUgb3JpZ2luYWwgY29tbWVudCByYW5nZSBpdCB3YXMgY3JlYXRlZCBmcm9tLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5bnRoZXNpemVkQ29tbWVudFdpdGhPcmlnaW5hbCBleHRlbmRzIHRzLlN5bnRoZXNpemVkQ29tbWVudCB7XG4gIC8qKlxuICAgKiBUaGUgb3JpZ2luYWwgdGV4dCByYW5nZSBvZiB0aGUgY29tbWVudCAocmVsYXRpdmUgdG8gdGhlIHNvdXJjZSBmaWxlJ3MgZnVsbCB0ZXh0KS5cbiAgICovXG4gIG9yaWdpbmFsUmFuZ2U/OiB0cy5UZXh0UmFuZ2U7XG59XG5cbi8qKlxuICogc3ludGhlc2l6ZUxlYWRpbmdDb21tZW50cyBwYXJzZXMgdGhlIGxlYWRpbmcgY29tbWVudHMgb2Ygbm9kZSwgY29udmVydHMgdGhlbVxuICogdG8gc3ludGhldGljIGNvbW1lbnRzLCBhbmQgbWFrZXMgc3VyZSB0aGUgb3JpZ2luYWwgdGV4dCBjb21tZW50cyBkbyBub3QgZ2V0XG4gKiBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzeW50aGVzaXplTGVhZGluZ0NvbW1lbnRzKG5vZGU6IHRzLk5vZGUpOiBTeW50aGVzaXplZENvbW1lbnRXaXRoT3JpZ2luYWxbXSB7XG4gIGNvbnN0IGV4aXN0aW5nID0gdHMuZ2V0U3ludGhldGljTGVhZGluZ0NvbW1lbnRzKG5vZGUpO1xuICBpZiAoZXhpc3RpbmcpIHJldHVybiBleGlzdGluZztcbiAgY29uc3QgdGV4dCA9IG5vZGUuZ2V0RnVsbFRleHQoKTtcbiAgY29uc3Qgc3ludGhDb21tZW50cyA9IGdldExlYWRpbmdDb21tZW50UmFuZ2VzU3ludGhlc2l6ZWQodGV4dCwgbm9kZS5nZXRGdWxsU3RhcnQoKSk7XG4gIGlmIChzeW50aENvbW1lbnRzLmxlbmd0aCkge1xuICAgIHRzLnNldFN5bnRoZXRpY0xlYWRpbmdDb21tZW50cyhub2RlLCBzeW50aENvbW1lbnRzKTtcbiAgICBzdXBwcmVzc0xlYWRpbmdDb21tZW50c1JlY3Vyc2l2ZWx5KG5vZGUpO1xuICB9XG4gIHJldHVybiBzeW50aENvbW1lbnRzO1xufVxuXG4vKipcbiAqIHBhcnNlTGVhZGluZ0NvbW1lbnRSYW5nZXNTeW50aGVzaXplZCBwYXJzZXMgdGhlIGxlYWRpbmcgY29tbWVudCByYW5nZXMgb3V0IG9mIHRoZSBnaXZlbiB0ZXh0IGFuZFxuICogY29udmVydHMgdGhlbSB0byBTeW50aGVzaXplZENvbW1lbnRzLlxuICogQHBhcmFtIG9mZnNldCB0aGUgb2Zmc2V0IG9mIHRleHQgaW4gdGhlIHNvdXJjZSBmaWxlLCBlLmcuIG5vZGUuZ2V0RnVsbFN0YXJ0KCkuXG4gKi9cbi8vIFZpc2libGVGb3JUZXN0aW5nXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGVhZGluZ0NvbW1lbnRSYW5nZXNTeW50aGVzaXplZChcbiAgICB0ZXh0OiBzdHJpbmcsIG9mZnNldCA9IDApOiBTeW50aGVzaXplZENvbW1lbnRXaXRoT3JpZ2luYWxbXSB7XG4gIGNvbnN0IGNvbW1lbnRzID0gdHMuZ2V0TGVhZGluZ0NvbW1lbnRSYW5nZXModGV4dCwgMCkgfHwgW107XG4gIHJldHVybiBjb21tZW50cy5tYXAoKGNyKTogU3ludGhlc2l6ZWRDb21tZW50V2l0aE9yaWdpbmFsID0+IHtcbiAgICAvLyBDb25mdXNpbmdseSwgQ29tbWVudFJhbmdlIGluIFR5cGVTY3JpcHQgaW5jbHVkZXMgc3RhcnQgYW5kIGVuZCBtYXJrZXJzLCBidXRcbiAgICAvLyBTeW50aGVzaXplZENvbW1lbnRzIGRvIG5vdC5cbiAgICBjb25zdCBjb21tZW50VGV4dCA9IGNyLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuU2luZ2xlTGluZUNvbW1lbnRUcml2aWEgP1xuICAgICAgICB0ZXh0LnN1YnN0cmluZyhjci5wb3MgKyAyLCBjci5lbmQpIDpcbiAgICAgICAgdGV4dC5zdWJzdHJpbmcoY3IucG9zICsgMiwgY3IuZW5kIC0gMik7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmNyLFxuICAgICAgdGV4dDogY29tbWVudFRleHQsXG4gICAgICBwb3M6IC0xLFxuICAgICAgZW5kOiAtMSxcbiAgICAgIG9yaWdpbmFsUmFuZ2U6IHtwb3M6IGNyLnBvcyArIG9mZnNldCwgZW5kOiBjci5lbmQgKyBvZmZzZXR9XG4gICAgfTtcbiAgfSk7XG59XG5cbi8qKlxuICogc3VwcHJlc3NDb21tZW50c1JlY3Vyc2l2ZWx5IHByZXZlbnRzIGVtaXQgb2YgbGVhZGluZyBjb21tZW50cyBvbiBub2RlLCBhbmQgYW55IHJlY3Vyc2l2ZSBub2Rlc1xuICogdW5kZXJuZWF0aCBpdCB0aGF0IHN0YXJ0IGF0IHRoZSBzYW1lIG9mZnNldC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1cHByZXNzTGVhZGluZ0NvbW1lbnRzUmVjdXJzaXZlbHkobm9kZTogdHMuTm9kZSkge1xuICAvLyBUeXBlU2NyaXB0IGVtaXRzIGxlYWRpbmcgY29tbWVudHMgb24gYSBub2RlLCB1bmxlc3M6XG4gIC8vIC0gdGhlIGNvbW1lbnQgd2FzIGVtaXR0ZWQgYnkgdGhlIHBhcmVudCBub2RlXG4gIC8vIC0gdGhlIG5vZGUgaGFzIHRoZSBOb0xlYWRpbmdDb21tZW50cyBlbWl0IGZsYWcuXG4gIC8vIEhvd2V2ZXIsIHRyYW5zZm9ybWF0aW9uIHN0ZXBzIHNvbWV0aW1lcyBjb3B5IG5vZGVzIHdpdGhvdXQga2VlcGluZyB0aGVpciBlbWl0IGZsYWdzLCBzbyBqdXN0XG4gIC8vIHNldHRpbmcgTm9MZWFkaW5nQ29tbWVudHMgcmVjdXJzaXZlbHkgaXMgbm90IGVub3VnaCwgd2UgbXVzdCBhbHNvIHNldCB0aGUgdGV4dCByYW5nZSB0byBhdm9pZFxuICAvLyB0aGUgY29waWVkIG5vZGUgdG8gaGF2ZSBjb21tZW50cyBlbWl0dGVkLlxuICBjb25zdCBvcmlnaW5hbFN0YXJ0ID0gbm9kZS5nZXRGdWxsU3RhcnQoKTtcbiAgY29uc3QgYWN0dWFsU3RhcnQgPSBub2RlLmdldFN0YXJ0KCk7XG4gIGZ1bmN0aW9uIHN1cHByZXNzQ29tbWVudHNJbnRlcm5hbChub2RlOiB0cy5Ob2RlKTogYm9vbGVhbiB7XG4gICAgdHMuc2V0RW1pdEZsYWdzKG5vZGUsIHRzLkVtaXRGbGFncy5Ob0xlYWRpbmdDb21tZW50cyk7XG4gICAgcmV0dXJuICEhdHMuZm9yRWFjaENoaWxkKG5vZGUsIChjaGlsZCkgPT4ge1xuICAgICAgaWYgKGNoaWxkLnBvcyAhPT0gb3JpZ2luYWxTdGFydCkgcmV0dXJuIHRydWU7XG4gICAgICByZXR1cm4gc3VwcHJlc3NDb21tZW50c0ludGVybmFsKGNoaWxkKTtcbiAgICB9KTtcbiAgfVxuICBzdXBwcmVzc0NvbW1lbnRzSW50ZXJuYWwobm9kZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1N5bnRoZXNpemVkQ29tbWVudChcbiAgICB0YWdzOiBUYWdbXSwgZXNjYXBlRXh0cmFUYWdzPzogU2V0PHN0cmluZz4pOiB0cy5TeW50aGVzaXplZENvbW1lbnQge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSxcbiAgICB0ZXh0OiB0b1N0cmluZ1dpdGhvdXRTdGFydEVuZCh0YWdzLCBlc2NhcGVFeHRyYVRhZ3MpLFxuICAgIHBvczogLTEsXG4gICAgZW5kOiAtMSxcbiAgICBoYXNUcmFpbGluZ05ld0xpbmU6IHRydWUsXG4gIH07XG59XG5cbi8qKiBTZXJpYWxpemVzIGEgQ29tbWVudCBvdXQgdG8gYSBzdHJpbmcsIGJ1dCBkb2VzIG5vdCBpbmNsdWRlIHRoZSBzdGFydCBhbmQgZW5kIGNvbW1lbnQgdG9rZW5zLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvU3RyaW5nV2l0aG91dFN0YXJ0RW5kKHRhZ3M6IFRhZ1tdLCBlc2NhcGVFeHRyYVRhZ3MgPSBuZXcgU2V0PHN0cmluZz4oKSk6IHN0cmluZyB7XG4gIHJldHVybiBzZXJpYWxpemUodGFncywgZmFsc2UsIGVzY2FwZUV4dHJhVGFncyk7XG59XG5cbi8qKiBTZXJpYWxpemVzIGEgQ29tbWVudCBvdXQgdG8gYSBzdHJpbmcgdXNhYmxlIGluIHNvdXJjZSBjb2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvU3RyaW5nKHRhZ3M6IFRhZ1tdLCBlc2NhcGVFeHRyYVRhZ3MgPSBuZXcgU2V0PHN0cmluZz4oKSk6IHN0cmluZyB7XG4gIHJldHVybiBzZXJpYWxpemUodGFncywgdHJ1ZSwgZXNjYXBlRXh0cmFUYWdzKTtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplKFxuICAgIHRhZ3M6IFRhZ1tdLCBpbmNsdWRlU3RhcnRFbmQ6IGJvb2xlYW4sIGVzY2FwZUV4dHJhVGFncyA9IG5ldyBTZXQ8c3RyaW5nPigpKTogc3RyaW5nIHtcbiAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSByZXR1cm4gJyc7XG4gIGlmICh0YWdzLmxlbmd0aCA9PT0gMSkge1xuICAgIGNvbnN0IHRhZyA9IHRhZ3NbMF07XG4gICAgaWYgKCh0YWcudGFnTmFtZSA9PT0gJ3R5cGUnIHx8IHRhZy50YWdOYW1lID09PSAndHlwZWRlZicgfHwgdGFnLnRhZ05hbWUgPT09ICdub2NvbGxhcHNlJykgJiZcbiAgICAgICAgKCF0YWcudGV4dCB8fCAhdGFnLnRleHQubWF0Y2goJ1xcbicpKSkge1xuICAgICAgLy8gU3BlY2lhbC1jYXNlIG9uZS1saW5lciBcInR5cGVcIiBhbmQgXCJub2NvbGxhcHNlXCIgdGFncyB0byBmaXQgb24gb25lIGxpbmUsIGUuZy5cbiAgICAgIC8vICAgLyoqIEB0eXBlIHtmb299ICovXG4gICAgICBjb25zdCB0ZXh0ID0gdGFnVG9TdHJpbmcodGFnLCBlc2NhcGVFeHRyYVRhZ3MpO1xuICAgICAgcmV0dXJuIGluY2x1ZGVTdGFydEVuZCA/IGAvKioke3RleHR9ICovYCA6IGAqJHt0ZXh0fSBgO1xuICAgIH1cbiAgICAvLyBPdGhlcndpc2UsIGZhbGwgdGhyb3VnaCB0byB0aGUgbXVsdGktbGluZSBvdXRwdXQuXG4gIH1cblxuICBsZXQgb3V0ID0gaW5jbHVkZVN0YXJ0RW5kID8gJy8qKlxcbicgOiAnKlxcbic7XG4gIGNvbnN0IGVtaXR0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgIGlmIChlbWl0dGVkLmhhcyh0YWcudGFnTmFtZSkgJiYgU0lOR0xFVE9OX1RBR1MuaGFzKHRhZy50YWdOYW1lKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGVtaXR0ZWQuYWRkKHRhZy50YWdOYW1lKTtcbiAgICBvdXQgKz0gJyAqJztcbiAgICAvLyBJZiB0aGUgdGFnVG9TdHJpbmcgaXMgbXVsdGktbGluZSwgaW5zZXJ0IFwiICogXCIgcHJlZml4ZXMgb24gc3Vic2VxdWVudCBsaW5lcy5cbiAgICBvdXQgKz0gdGFnVG9TdHJpbmcodGFnLCBlc2NhcGVFeHRyYVRhZ3MpLnNwbGl0KCdcXG4nKS5qb2luKCdcXG4gKiAnKTtcbiAgICBvdXQgKz0gJ1xcbic7XG4gIH1cbiAgb3V0ICs9IGluY2x1ZGVTdGFydEVuZCA/ICcgKi9cXG4nIDogJyAnO1xuICByZXR1cm4gb3V0O1xufVxuXG4vKiogTWVyZ2VzIG11bHRpcGxlIHRhZ3MgKG9mIHRoZSBzYW1lIHRhZ05hbWUgdHlwZSkgaW50byBhIHNpbmdsZSB1bmlmaWVkIHRhZy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZSh0YWdzOiBUYWdbXSk6IFRhZyB7XG4gIGNvbnN0IHRhZ05hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IHBhcmFtZXRlck5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IHR5cGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IHRleHRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIC8vIElmIGFueSBvZiB0aGUgdGFncyBhcmUgb3B0aW9uYWwvcmVzdCwgdGhlbiB0aGUgbWVyZ2VkIG91dHB1dCBpcyBvcHRpb25hbC9yZXN0LlxuICBsZXQgb3B0aW9uYWwgPSBmYWxzZTtcbiAgbGV0IHJlc3RQYXJhbSA9IGZhbHNlO1xuICBmb3IgKGNvbnN0IHRhZyBvZiB0YWdzKSB7XG4gICAgdGFnTmFtZXMuYWRkKHRhZy50YWdOYW1lKTtcbiAgICBpZiAodGFnLnBhcmFtZXRlck5hbWUgIT09IHVuZGVmaW5lZCkgcGFyYW1ldGVyTmFtZXMuYWRkKHRhZy5wYXJhbWV0ZXJOYW1lKTtcbiAgICBpZiAodGFnLnR5cGUgIT09IHVuZGVmaW5lZCkgdHlwZXMuYWRkKHRhZy50eXBlKTtcbiAgICBpZiAodGFnLnRleHQgIT09IHVuZGVmaW5lZCkgdGV4dHMuYWRkKHRhZy50ZXh0KTtcbiAgICBpZiAodGFnLm9wdGlvbmFsKSBvcHRpb25hbCA9IHRydWU7XG4gICAgaWYgKHRhZy5yZXN0UGFyYW0pIHJlc3RQYXJhbSA9IHRydWU7XG4gIH1cblxuICBpZiAodGFnTmFtZXMuc2l6ZSAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgY2Fubm90IG1lcmdlIGRpZmZlcmluZyB0YWdzOiAke0pTT04uc3RyaW5naWZ5KHRhZ3MpfWApO1xuICB9XG4gIGNvbnN0IHRhZ05hbWUgPSB0YWdOYW1lcy52YWx1ZXMoKS5uZXh0KCkudmFsdWU7XG4gIGNvbnN0IHBhcmFtZXRlck5hbWUgPVxuICAgICAgcGFyYW1ldGVyTmFtZXMuc2l6ZSA+IDAgPyBBcnJheS5mcm9tKHBhcmFtZXRlck5hbWVzKS5qb2luKCdfb3JfJykgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHR5cGUgPSB0eXBlcy5zaXplID4gMCA/IEFycmF5LmZyb20odHlwZXMpLmpvaW4oJ3wnKSA6IHVuZGVmaW5lZDtcbiAgLy8gQHRlbXBsYXRlIHVzZXMgdGV4dCAobm90IHR5cGUhKSB0byBkZWNsYXJlIGl0cyB0eXBlIHBhcmFtZXRlcnMsIHdpdGggJywnLXNlcGFyYXRlZCB0ZXh0LlxuICBjb25zdCBpc1RlbXBsYXRlVGFnID0gdGFnTmFtZSA9PT0gJ3RlbXBsYXRlJztcbiAgY29uc3QgdGV4dCA9IHRleHRzLnNpemUgPiAwID8gQXJyYXkuZnJvbSh0ZXh0cykuam9pbihpc1RlbXBsYXRlVGFnID8gJywnIDogJyAvICcpIDogdW5kZWZpbmVkO1xuICBjb25zdCB0YWc6IFRhZyA9IHt0YWdOYW1lLCBwYXJhbWV0ZXJOYW1lLCB0eXBlLCB0ZXh0fTtcbiAgLy8gTm90ZTogYSBwYXJhbSBjYW4gZWl0aGVyIGJlIG9wdGlvbmFsIG9yIGEgcmVzdCBwYXJhbTsgaWYgd2UgbWVyZ2VkIGFuXG4gIC8vIG9wdGlvbmFsIGFuZCByZXN0IHBhcmFtIHRvZ2V0aGVyLCBwcmVmZXIgbWFya2luZyBpdCBhcyBhIHJlc3QgcGFyYW0uXG4gIGlmIChyZXN0UGFyYW0pIHtcbiAgICB0YWcucmVzdFBhcmFtID0gdHJ1ZTtcbiAgfSBlbHNlIGlmIChvcHRpb25hbCkge1xuICAgIHRhZy5vcHRpb25hbCA9IHRydWU7XG4gIH1cbiAgcmV0dXJuIHRhZztcbn1cbiJdfQ==