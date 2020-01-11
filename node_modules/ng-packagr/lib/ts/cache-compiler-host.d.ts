import * as ts from 'typescript';
import * as ng from '@angular/compiler-cli';
import { StylesheetProcessor } from '../ng-v5/entry-point/resources/stylesheet-processor';
import { EntryPointNode } from '../ng-v5/nodes';
import { BuildGraph } from '../brocc/build-graph';
import { FileCache } from '../file/file-cache';
export declare function cacheCompilerHost(graph: BuildGraph, entryPoint: EntryPointNode, compilerOptions: ng.CompilerOptions, moduleResolutionCache: ts.ModuleResolutionCache, stylesheetProcessor?: StylesheetProcessor, sourcesFileCache?: FileCache): ng.CompilerHost;
