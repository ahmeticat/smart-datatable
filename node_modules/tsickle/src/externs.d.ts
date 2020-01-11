/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="tsickle/src/externs" />
import * as ts from 'typescript';
import { AnnotatorHost } from './annotator_host';
/**
 * Concatenate all generated externs definitions together into a string, including a file comment
 * header.
 *
 * @param rootDir Project root.  Emitted comments will reference paths relative to this root.
 *    This param is effectively required, but made optional here until Angular is fixed.
 */
export declare function getGeneratedExterns(externs: {
    [fileName: string]: string;
}, rootDir?: string): string;
/**
 * generateExterns generates extern definitions for all ambient declarations in the given source
 * file. It returns a string representation of the Closure JavaScript, not including the initial
 * comment with \@fileoverview and \@externs (see above for that).
 */
export declare function generateExterns(typeChecker: ts.TypeChecker, sourceFile: ts.SourceFile, host: AnnotatorHost, moduleResolutionHost: ts.ModuleResolutionHost, options: ts.CompilerOptions): {
    output: string;
    diagnostics: ts.Diagnostic[];
};
