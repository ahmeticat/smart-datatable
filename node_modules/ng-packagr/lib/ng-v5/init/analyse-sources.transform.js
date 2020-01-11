"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ng = require("@angular/compiler-cli");
const ts = require("typescript");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const log = require("../../util/log");
const nodes_1 = require("../nodes");
const cache_compiler_host_1 = require("../../ts/cache-compiler-host");
const array_1 = require("../../util/array");
const path_1 = require("../../util/path");
exports.analyseSourcesTransform = rxjs_1.pipe(operators_1.map(graph => {
    const entryPoints = graph.filter(x => nodes_1.isEntryPoint(x) && x.state !== 'done');
    for (let entryPoint of entryPoints) {
        analyseEntryPoint(graph, entryPoint, entryPoints);
    }
    return graph;
}));
/**
 * Analyses an entrypoint, searching for TypeScript dependencies and additional resources (Templates and Stylesheets).
 *
 * @param graph Build graph
 * @param entryPoint Current entry point that should be analysed.
 * @param entryPoints List of all entry points.
 */
function analyseEntryPoint(graph, entryPoint, entryPoints) {
    const { analysisModuleResolutionCache, oldPrograms, analysisSourcesFileCache } = entryPoint.cache;
    const oldProgram = oldPrograms && oldPrograms['analysis'];
    const { moduleId } = entryPoint.data.entryPoint;
    log.debug(`Analysing sources for ${moduleId}`);
    const tsConfigOptions = Object.assign({}, entryPoint.data.tsConfig.options, { skipLibCheck: true, types: [] });
    const compilerHost = cache_compiler_host_1.cacheCompilerHost(graph, entryPoint, tsConfigOptions, analysisModuleResolutionCache, undefined, analysisSourcesFileCache);
    compilerHost.resolveModuleNames = (moduleNames, containingFile) => {
        return moduleNames.map(moduleName => {
            if (!moduleName.startsWith('.')) {
                return undefined;
            }
            const { resolvedModule } = ts.resolveModuleName(moduleName, path_1.ensureUnixPath(containingFile), tsConfigOptions, compilerHost, analysisModuleResolutionCache);
            return resolvedModule;
        });
    };
    const program = ts.createProgram(entryPoint.data.tsConfig.rootNames, tsConfigOptions, compilerHost, oldProgram);
    const diagnostics = program.getOptionsDiagnostics();
    if (diagnostics.length) {
        throw new Error(ng.formatDiagnostics(diagnostics));
    }
    // this is a workaround due to the below
    // https://github.com/angular/angular/issues/24010
    let moduleStatements = [];
    program
        .getSourceFiles()
        .filter(x => !/node_modules|\.ngfactory|\.ngstyle|(\.d\.ts$)/.test(x.fileName))
        .forEach(sourceFile => {
        sourceFile.statements
            .filter(x => ts.isImportDeclaration(x) || ts.isExportDeclaration(x))
            .forEach((node) => {
            const { moduleSpecifier } = node;
            if (!moduleSpecifier) {
                return;
            }
            const text = moduleSpecifier.getText();
            const trimmedText = text.substring(1, text.length - 1);
            if (!trimmedText.startsWith('.')) {
                moduleStatements.push(trimmedText);
            }
        });
    });
    log.debug(`tsc program structure is reused: ${oldProgram ? oldProgram.structureIsReused : 'No old program'}`);
    entryPoint.cache.oldPrograms = Object.assign({}, entryPoint.cache.oldPrograms, { ['analysis']: program });
    moduleStatements = array_1.unique(moduleStatements);
    moduleStatements.forEach(moduleName => {
        const dep = entryPoints.find(ep => ep.data.entryPoint.moduleId === moduleName);
        if (dep) {
            log.debug(`Found entry point dependency: ${moduleId} -> ${moduleName}`);
            if (moduleId === moduleName) {
                throw new Error(`Entry point ${moduleName} has a circular dependency on itself.`);
            }
            entryPoint.dependsOn(dep);
        }
    });
}
//# sourceMappingURL=analyse-sources.transform.js.map