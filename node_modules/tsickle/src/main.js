#!/usr/bin/env node
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
        define("tsickle/src/main", ["require", "exports", "fs", "minimist", "mkdirp", "path", "typescript", "tsickle/src/cli_support", "tsickle/src/tsickle", "tsickle/src/tsickle"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const fs = require("fs");
    const minimist = require("minimist");
    const mkdirp = require("mkdirp");
    const path = require("path");
    const ts = require("typescript");
    const cliSupport = require("tsickle/src/cli_support");
    const tsickle = require("tsickle/src/tsickle");
    const tsickle_1 = require("tsickle/src/tsickle");
    function usage() {
        console.error(`usage: tsickle [tsickle options] -- [tsc options]

example:
  tsickle --externs=foo/externs.js -- -p src --noImplicitAny

tsickle flags are:
  --externs=PATH        save generated Closure externs.js to PATH
  --typed               [experimental] attempt to provide Closure types instead of {?}
  --fatalWarnings       whether warnings should be fatal, and cause tsickle to return a non-zero exit code
`);
    }
    /**
     * Parses the command-line arguments, extracting the tsickle settings and
     * the arguments to pass on to tsc.
     */
    function loadSettingsFromArgs(args) {
        const settings = {};
        const parsedArgs = minimist(args);
        for (const flag of Object.keys(parsedArgs)) {
            switch (flag) {
                case 'h':
                case 'help':
                    usage();
                    process.exit(0);
                    break;
                case 'externs':
                    settings.externsPath = parsedArgs[flag];
                    break;
                case 'typed':
                    settings.isTyped = true;
                    break;
                case 'verbose':
                    settings.verbose = true;
                    break;
                case 'fatalWarnings':
                    settings.fatalWarnings = true;
                    break;
                case '_':
                    // This is part of the minimist API, and holds args after the '--'.
                    break;
                default:
                    console.error(`unknown flag '--${flag}'`);
                    usage();
                    process.exit(1);
            }
        }
        // Arguments after the '--' arg are arguments to tsc.
        const tscArgs = parsedArgs['_'];
        return { settings, tscArgs };
    }
    /**
     * Determine the lowest-level common parent directory of the given list of files.
     */
    function getCommonParentDirectory(fileNames) {
        const pathSplitter = /[\/\\]+/;
        const commonParent = fileNames[0].split(pathSplitter);
        for (let i = 1; i < fileNames.length; i++) {
            const thisPath = fileNames[i].split(pathSplitter);
            let j = 0;
            while (thisPath[j] === commonParent[j]) {
                j++;
            }
            commonParent.length = j; // Truncate without copying the array
        }
        if (commonParent.length === 0) {
            return '/';
        }
        else {
            return commonParent.join(path.sep);
        }
    }
    exports.getCommonParentDirectory = getCommonParentDirectory;
    /**
     * Loads the tsconfig.json from a directory.
     *
     * TODO(martinprobst): use ts.findConfigFile to match tsc behaviour.
     *
     * @param args tsc command-line arguments.
     */
    function loadTscConfig(args) {
        // Gather tsc options/input files from command line.
        let { options, fileNames, errors } = ts.parseCommandLine(args);
        if (errors.length > 0) {
            return { options: {}, fileNames: [], errors };
        }
        // Store file arguments
        const tsFileArguments = fileNames;
        // Read further settings from tsconfig.json.
        const projectDir = options.project || '.';
        const configFileName = path.join(projectDir, 'tsconfig.json');
        const { config: json, error } = ts.readConfigFile(configFileName, path => fs.readFileSync(path, 'utf-8'));
        if (error) {
            return { options: {}, fileNames: [], errors: [error] };
        }
        ({ options, fileNames, errors } =
            ts.parseJsonConfigFileContent(json, ts.sys, projectDir, options, configFileName));
        if (errors.length > 0) {
            return { options: {}, fileNames: [], errors };
        }
        // if file arguments were given to the typescript transpiler then transpile only those files
        fileNames = tsFileArguments.length > 0 ? tsFileArguments : fileNames;
        return { options, fileNames, errors: [] };
    }
    /**
     * Compiles TypeScript code into Closure-compiler-ready JS.
     */
    function toClosureJS(options, fileNames, settings, writeFile) {
        // Use absolute paths to determine what files to process since files may be imported using
        // relative or absolute paths
        const absoluteFileNames = fileNames.map(i => path.resolve(i));
        const compilerHost = ts.createCompilerHost(options);
        const program = ts.createProgram(absoluteFileNames, options, compilerHost);
        const filesToProcess = new Set(absoluteFileNames);
        const rootModulePath = options.rootDir || getCommonParentDirectory(absoluteFileNames);
        const transformerHost = {
            shouldSkipTsickleProcessing: (fileName) => {
                return !filesToProcess.has(path.resolve(fileName));
            },
            shouldIgnoreWarningsForPath: (fileName) => !settings.fatalWarnings,
            pathToModuleName: (context, fileName) => cliSupport.pathToModuleName(rootModulePath, context, fileName),
            fileNameToModuleId: (fileName) => path.relative(rootModulePath, fileName),
            es5Mode: true,
            googmodule: true,
            transformDecorators: true,
            transformTypesToClosure: true,
            typeBlackListPaths: new Set(),
            untyped: false,
            logWarning: (warning) => console.error(ts.formatDiagnostics([warning], compilerHost)),
            options,
            moduleResolutionHost: compilerHost,
        };
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length > 0) {
            return {
                diagnostics,
                modulesManifest: new tsickle_1.ModulesManifest(),
                externs: {},
                emitSkipped: true,
                emittedFiles: [],
            };
        }
        return tsickle.emitWithTsickle(program, transformerHost, compilerHost, options, undefined, writeFile);
    }
    exports.toClosureJS = toClosureJS;
    function main(args) {
        const { settings, tscArgs } = loadSettingsFromArgs(args);
        const config = loadTscConfig(tscArgs);
        if (config.errors.length) {
            console.error(ts.formatDiagnostics(config.errors, ts.createCompilerHost(config.options)));
            return 1;
        }
        if (config.options.module !== ts.ModuleKind.CommonJS) {
            // This is not an upstream TypeScript diagnostic, therefore it does not go
            // through the diagnostics array mechanism.
            console.error('tsickle converts TypeScript modules to Closure modules via CommonJS internally. ' +
                'Set tsconfig.js "module": "commonjs"');
            return 1;
        }
        // Run tsickle+TSC to convert inputs to Closure JS files.
        const result = toClosureJS(config.options, config.fileNames, settings, (filePath, contents) => {
            mkdirp.sync(path.dirname(filePath));
            fs.writeFileSync(filePath, contents, { encoding: 'utf-8' });
        });
        if (result.diagnostics.length) {
            console.error(ts.formatDiagnostics(result.diagnostics, ts.createCompilerHost(config.options)));
            return 1;
        }
        if (settings.externsPath) {
            mkdirp.sync(path.dirname(settings.externsPath));
            fs.writeFileSync(settings.externsPath, tsickle.getGeneratedExterns(result.externs, config.options.rootDir || ''));
        }
        return 0;
    }
    // CLI entry point
    if (require.main === module) {
        process.exit(main(process.argv.splice(2)));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFFQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUVILHlCQUF5QjtJQUN6QixxQ0FBcUM7SUFDckMsaUNBQWlDO0lBQ2pDLDZCQUE2QjtJQUM3QixpQ0FBaUM7SUFFakMsc0RBQTRDO0lBQzVDLCtDQUFxQztJQUNyQyxpREFBMEM7SUFpQjFDLFNBQVMsS0FBSztRQUNaLE9BQU8sQ0FBQyxLQUFLLENBQUM7Ozs7Ozs7OztDQVNmLENBQUMsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLG9CQUFvQixDQUFDLElBQWM7UUFDMUMsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDMUMsUUFBUSxJQUFJLEVBQUU7Z0JBQ1osS0FBSyxHQUFHLENBQUM7Z0JBQ1QsS0FBSyxNQUFNO29CQUNULEtBQUssRUFBRSxDQUFDO29CQUNSLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2hCLE1BQU07Z0JBQ1IsS0FBSyxTQUFTO29CQUNaLFFBQVEsQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN4QyxNQUFNO2dCQUNSLEtBQUssT0FBTztvQkFDVixRQUFRLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztvQkFDeEIsTUFBTTtnQkFDUixLQUFLLFNBQVM7b0JBQ1osUUFBUSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7b0JBQ3hCLE1BQU07Z0JBQ1IsS0FBSyxlQUFlO29CQUNsQixRQUFRLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztvQkFDOUIsTUFBTTtnQkFDUixL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Q0FBQyxDQUFDLENBQUM7WUFDL0YsT0FBTyxDQUFDLENBQUM7U0FDVjtRQUVELElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRTtZQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDaEQsRUFBRSxDQUFDLGFBQWEsQ0FDWixRQUFRLENBQUMsV0FBVyxFQUNwQixPQUFPLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2hGO1FBQ0QsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQsa0JBQWtCO0lBQ2xCLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzVDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIG1pbmltaXN0IGZyb20gJ21pbmltaXN0JztcbmltcG9ydCAqIGFzIG1rZGlycCBmcm9tICdta2RpcnAnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQgKiBhcyBjbGlTdXBwb3J0IGZyb20gJy4vY2xpX3N1cHBvcnQnO1xuaW1wb3J0ICogYXMgdHNpY2tsZSBmcm9tICcuL3RzaWNrbGUnO1xuaW1wb3J0IHtNb2R1bGVzTWFuaWZlc3R9IGZyb20gJy4vdHNpY2tsZSc7XG5cbi8qKiBUc2lja2xlIHNldHRpbmdzIHBhc3NlZCBvbiB0aGUgY29tbWFuZCBsaW5lLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXR0aW5ncyB7XG4gIC8qKiBJZiBwcm92aWRlZCwgcGF0aCB0byBzYXZlIGV4dGVybnMgdG8uICovXG4gIGV4dGVybnNQYXRoPzogc3RyaW5nO1xuXG4gIC8qKiBJZiBwcm92aWRlZCwgYXR0ZW1wdCB0byBwcm92aWRlIHR5cGVzIHJhdGhlciB0aGFuIHs/fS4gKi9cbiAgaXNUeXBlZD86IGJvb2xlYW47XG5cbiAgLyoqIElmIHRydWUsIGxvZyBpbnRlcm5hbCBkZWJ1ZyB3YXJuaW5ncyB0byB0aGUgY29uc29sZS4gKi9cbiAgdmVyYm9zZT86IGJvb2xlYW47XG5cbiAgLyoqIElmIHRydWUsIHdhcm5pbmdzIGNhdXNlIGEgbm9uLXplcm8gZXhpdCBjb2RlLiAqL1xuICBmYXRhbFdhcm5pbmdzPzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gdXNhZ2UoKSB7XG4gIGNvbnNvbGUuZXJyb3IoYHVzYWdlOiB0c2lja2xlIFt0c2lja2xlIG9wdGlvbnNdIC0tIFt0c2Mgb3B0aW9uc11cblxuZXhhbXBsZTpcbiAgdHNpY2tsZSAtLWV4dGVybnM9Zm9vL2V4dGVybnMuanMgLS0gLXAgc3JjIC0tbm9JbXBsaWNpdEFueVxuXG50c2lja2xlIGZsYWdzIGFyZTpcbiAgLS1leHRlcm5zPVBBVEggICAgICAgIHNhdmUgZ2VuZXJhdGVkIENsb3N1cmUgZXh0ZXJucy5qcyB0byBQQVRIXG4gIC0tdHlwZWQgICAgICAgICAgICAgICBbZXhwZXJpbWVudGFsXSBhdHRlbXB0IHRvIHByb3ZpZGUgQ2xvc3VyZSB0eXBlcyBpbnN0ZWFkIG9mIHs/fVxuICAtLWZhdGFsV2FybmluZ3MgICAgICAgd2hldGhlciB3YXJuaW5ncyBzaG91bGQgYmUgZmF0YWwsIGFuZCBjYXVzZSB0c2lja2xlIHRvIHJldHVybiBhIG5vbi16ZXJvIGV4aXQgY29kZVxuYCk7XG59XG5cbi8qKlxuICogUGFyc2VzIHRoZSBjb21tYW5kLWxpbmUgYXJndW1lbnRzLCBleHRyYWN0aW5nIHRoZSB0c2lja2xlIHNldHRpbmdzIGFuZFxuICogdGhlIGFyZ3VtZW50cyB0byBwYXNzIG9uIHRvIHRzYy5cbiAqL1xuZnVuY3Rpb24gbG9hZFNldHRpbmdzRnJvbUFyZ3MoYXJnczogc3RyaW5nW10pOiB7c2V0dGluZ3M6IFNldHRpbmdzLCB0c2NBcmdzOiBzdHJpbmdbXX0ge1xuICBjb25zdCBzZXR0aW5nczogU2V0dGluZ3MgPSB7fTtcbiAgY29uc3QgcGFyc2VkQXJncyA9IG1pbmltaXN0KGFyZ3MpO1xuICBmb3IgKGNvbnN0IGZsYWcgb2YgT2JqZWN0LmtleXMocGFyc2VkQXJncykpIHtcbiAgICBzd2l0Y2ggKGZsYWcpIHtcbiAgICAgIGNhc2UgJ2gnOlxuICAgICAgY2FzZSAnaGVscCc6XG4gICAgICAgIHVzYWdlKCk7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgwKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdleHRlcm5zJzpcbiAgICAgICAgc2V0dGluZ3MuZXh0ZXJuc1BhdGggPSBwYXJzZWRBcmdzW2ZsYWddO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3R5cGVkJzpcbiAgICAgICAgc2V0dGluZ3MuaXNUeXBlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAndmVyYm9zZSc6XG4gICAgICAgIHNldHRpbmdzLnZlcmJvc2UgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2ZhdGFsV2FybmluZ3MnOlxuICAgICAgICBzZXR0aW5ncy5mYXRhbFdhcm5pbmdzID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdfJzpcbiAgICAgICAgLy8gVGhpcyBpcyBwYXJ0IG9mIHRoZSBtaW5pbWlzdCBBUEksIGFuZCBob2xkcyBhcmdzIGFmdGVyIHRoZSAnLS0nLlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYHVua25vd24gZmxhZyAnLS0ke2ZsYWd9J2ApO1xuICAgICAgICB1c2FnZSgpO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgfVxuICB9XG4gIC8vIEFyZ3VtZW50cyBhZnRlciB0aGUgJy0tJyBhcmcgYXJlIGFyZ3VtZW50cyB0byB0c2MuXG4gIGNvbnN0IHRzY0FyZ3MgPSBwYXJzZWRBcmdzWydfJ107XG4gIHJldHVybiB7c2V0dGluZ3MsIHRzY0FyZ3N9O1xufVxuXG4vKipcbiAqIERldGVybWluZSB0aGUgbG93ZXN0LWxldmVsIGNvbW1vbiBwYXJlbnQgZGlyZWN0b3J5IG9mIHRoZSBnaXZlbiBsaXN0IG9mIGZpbGVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uUGFyZW50RGlyZWN0b3J5KGZpbGVOYW1lczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBwYXRoU3BsaXR0ZXIgPSAvW1xcL1xcXFxdKy87XG4gIGNvbnN0IGNvbW1vblBhcmVudCA9IGZpbGVOYW1lc1swXS5zcGxpdChwYXRoU3BsaXR0ZXIpO1xuICBmb3IgKGxldCBpID0gMTsgaSA8IGZpbGVOYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHRoaXNQYXRoID0gZmlsZU5hbWVzW2ldLnNwbGl0KHBhdGhTcGxpdHRlcik7XG4gICAgbGV0IGogPSAwO1xuICAgIHdoaWxlICh0aGlzUGF0aFtqXSA9PT0gY29tbW9uUGFyZW50W2pdKSB7XG4gICAgICBqKys7XG4gICAgfVxuICAgIGNvbW1vblBhcmVudC5sZW5ndGggPSBqOyAgLy8gVHJ1bmNhdGUgd2l0aG91dCBjb3B5aW5nIHRoZSBhcnJheVxuICB9XG4gIGlmIChjb21tb25QYXJlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICcvJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29tbW9uUGFyZW50LmpvaW4ocGF0aC5zZXApO1xuICB9XG59XG5cbi8qKlxuICogTG9hZHMgdGhlIHRzY29uZmlnLmpzb24gZnJvbSBhIGRpcmVjdG9yeS5cbiAqXG4gKiBUT0RPKG1hcnRpbnByb2JzdCk6IHVzZSB0cy5maW5kQ29uZmlnRmlsZSB0byBtYXRjaCB0c2MgYmVoYXZpb3VyLlxuICpcbiAqIEBwYXJhbSBhcmdzIHRzYyBjb21tYW5kLWxpbmUgYXJndW1lbnRzLlxuICovXG5mdW5jdGlvbiBsb2FkVHNjQ29uZmlnKGFyZ3M6IHN0cmluZ1tdKTpcbiAgICB7b3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zLCBmaWxlTmFtZXM6IHN0cmluZ1tdLCBlcnJvcnM6IHRzLkRpYWdub3N0aWNbXX0ge1xuICAvLyBHYXRoZXIgdHNjIG9wdGlvbnMvaW5wdXQgZmlsZXMgZnJvbSBjb21tYW5kIGxpbmUuXG4gIGxldCB7b3B0aW9ucywgZmlsZU5hbWVzLCBlcnJvcnN9ID0gdHMucGFyc2VDb21tYW5kTGluZShhcmdzKTtcbiAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtvcHRpb25zOiB7fSwgZmlsZU5hbWVzOiBbXSwgZXJyb3JzfTtcbiAgfVxuXG4gIC8vIFN0b3JlIGZpbGUgYXJndW1lbnRzXG4gIGNvbnN0IHRzRmlsZUFyZ3VtZW50cyA9IGZpbGVOYW1lcztcblxuICAvLyBSZWFkIGZ1cnRoZXIgc2V0dGluZ3MgZnJvbSB0c2NvbmZpZy5qc29uLlxuICBjb25zdCBwcm9qZWN0RGlyID0gb3B0aW9ucy5wcm9qZWN0IHx8ICcuJztcbiAgY29uc3QgY29uZmlnRmlsZU5hbWUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ3RzY29uZmlnLmpzb24nKTtcbiAgY29uc3Qge2NvbmZpZzoganNvbiwgZXJyb3J9ID1cbiAgICAgIHRzLnJlYWRDb25maWdGaWxlKGNvbmZpZ0ZpbGVOYW1lLCBwYXRoID0+IGZzLnJlYWRGaWxlU3luYyhwYXRoLCAndXRmLTgnKSk7XG4gIGlmIChlcnJvcikge1xuICAgIHJldHVybiB7b3B0aW9uczoge30sIGZpbGVOYW1lczogW10sIGVycm9yczogW2Vycm9yXX07XG4gIH1cbiAgKHtvcHRpb25zLCBmaWxlTmFtZXMsIGVycm9yc30gPVxuICAgICAgIHRzLnBhcnNlSnNvbkNvbmZpZ0ZpbGVDb250ZW50KGpzb24sIHRzLnN5cywgcHJvamVjdERpciwgb3B0aW9ucywgY29uZmlnRmlsZU5hbWUpKTtcbiAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtvcHRpb25zOiB7fSwgZmlsZU5hbWVzOiBbXSwgZXJyb3JzfTtcbiAgfVxuXG4gIC8vIGlmIGZpbGUgYXJndW1lbnRzIHdlcmUgZ2l2ZW4gdG8gdGhlIHR5cGVzY3JpcHQgdHJhbnNwaWxlciB0aGVuIHRyYW5zcGlsZSBvbmx5IHRob3NlIGZpbGVzXG4gIGZpbGVOYW1lcyA9IHRzRmlsZUFyZ3VtZW50cy5sZW5ndGggPiAwID8gdHNGaWxlQXJndW1lbnRzIDogZmlsZU5hbWVzO1xuXG4gIHJldHVybiB7b3B0aW9ucywgZmlsZU5hbWVzLCBlcnJvcnM6IFtdfTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyBUeXBlU2NyaXB0IGNvZGUgaW50byBDbG9zdXJlLWNvbXBpbGVyLXJlYWR5IEpTLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9DbG9zdXJlSlMoXG4gICAgb3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zLCBmaWxlTmFtZXM6IHN0cmluZ1tdLCBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgd3JpdGVGaWxlPzogdHMuV3JpdGVGaWxlQ2FsbGJhY2spOiB0c2lja2xlLkVtaXRSZXN1bHQge1xuICAvLyBVc2UgYWJzb2x1dGUgcGF0aHMgdG8gZGV0ZXJtaW5lIHdoYXQgZmlsZXMgdG8gcHJvY2VzcyBzaW5jZSBmaWxlcyBtYXkgYmUgaW1wb3J0ZWQgdXNpbmdcbiAgLy8gcmVsYXRpdmUgb3IgYWJzb2x1dGUgcGF0aHNcbiAgY29uc3QgYWJzb2x1dGVGaWxlTmFtZXMgPSBmaWxlTmFtZXMubWFwKGkgPT4gcGF0aC5yZXNvbHZlKGkpKTtcblxuICBjb25zdCBjb21waWxlckhvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3Qob3B0aW9ucyk7XG4gIGNvbnN0IHByb2dyYW0gPSB0cy5jcmVhdGVQcm9ncmFtKGFic29sdXRlRmlsZU5hbWVzLCBvcHRpb25zLCBjb21waWxlckhvc3QpO1xuICBjb25zdCBmaWxlc1RvUHJvY2VzcyA9IG5ldyBTZXQoYWJzb2x1dGVGaWxlTmFtZXMpO1xuICBjb25zdCByb290TW9kdWxlUGF0aCA9IG9wdGlvbnMucm9vdERpciB8fCBnZXRDb21tb25QYXJlbnREaXJlY3RvcnkoYWJzb2x1dGVGaWxlTmFtZXMpO1xuICBjb25zdCB0cmFuc2Zvcm1lckhvc3Q6IHRzaWNrbGUuVHNpY2tsZUhvc3QgPSB7XG4gICAgc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nOiAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgcmV0dXJuICFmaWxlc1RvUHJvY2Vzcy5oYXMocGF0aC5yZXNvbHZlKGZpbGVOYW1lKSk7XG4gICAgfSxcbiAgICBzaG91bGRJZ25vcmVXYXJuaW5nc0ZvclBhdGg6IChmaWxlTmFtZTogc3RyaW5nKSA9PiAhc2V0dGluZ3MuZmF0YWxXYXJuaW5ncyxcbiAgICBwYXRoVG9Nb2R1bGVOYW1lOiAoY29udGV4dCwgZmlsZU5hbWUpID0+XG4gICAgICAgIGNsaVN1cHBvcnQucGF0aFRvTW9kdWxlTmFtZShyb290TW9kdWxlUGF0aCwgY29udGV4dCwgZmlsZU5hbWUpLFxuICAgIGZpbGVOYW1lVG9Nb2R1bGVJZDogKGZpbGVOYW1lKSA9PiBwYXRoLnJlbGF0aXZlKHJvb3RNb2R1bGVQYXRoLCBmaWxlTmFtZSksXG4gICAgZXM1TW9kZTogdHJ1ZSxcbiAgICBnb29nbW9kdWxlOiB0cnVlLFxuICAgIHRyYW5zZm9ybURlY29yYXRvcnM6IHRydWUsXG4gICAgdHJhbnNmb3JtVHlwZXNUb0Nsb3N1cmU6IHRydWUsXG4gICAgdHlwZUJsYWNrTGlzdFBhdGhzOiBuZXcgU2V0KCksXG4gICAgdW50eXBlZDogZmFsc2UsXG4gICAgbG9nV2FybmluZzogKHdhcm5pbmcpID0+IGNvbnNvbGUuZXJyb3IodHMuZm9ybWF0RGlhZ25vc3RpY3MoW3dhcm5pbmddLCBjb21waWxlckhvc3QpKSxcbiAgICBvcHRpb25zLFxuICAgIG1vZHVsZVJlc29sdXRpb25Ib3N0OiBjb21waWxlckhvc3QsXG4gIH07XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzKHByb2dyYW0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7XG4gICAgICBkaWFnbm9zdGljcyxcbiAgICAgIG1vZHVsZXNNYW5pZmVzdDogbmV3IE1vZHVsZXNNYW5pZmVzdCgpLFxuICAgICAgZXh0ZXJuczoge30sXG4gICAgICBlbWl0U2tpcHBlZDogdHJ1ZSxcbiAgICAgIGVtaXR0ZWRGaWxlczogW10sXG4gICAgfTtcbiAgfVxuICByZXR1cm4gdHNpY2tsZS5lbWl0V2l0aFRzaWNrbGUoXG4gICAgICBwcm9ncmFtLCB0cmFuc2Zvcm1lckhvc3QsIGNvbXBpbGVySG9zdCwgb3B0aW9ucywgdW5kZWZpbmVkLCB3cml0ZUZpbGUpO1xufVxuXG5mdW5jdGlvbiBtYWluKGFyZ3M6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgY29uc3Qge3NldHRpbmdzLCB0c2NBcmdzfSA9IGxvYWRTZXR0aW5nc0Zyb21BcmdzKGFyZ3MpO1xuICBjb25zdCBjb25maWcgPSBsb2FkVHNjQ29uZmlnKHRzY0FyZ3MpO1xuICBpZiAoY29uZmlnLmVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKHRzLmZvcm1hdERpYWdub3N0aWNzKGNvbmZpZy5lcnJvcnMsIHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb25maWcub3B0aW9ucykpKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIGlmIChjb25maWcub3B0aW9ucy5tb2R1bGUgIT09IHRzLk1vZHVsZUtpbmQuQ29tbW9uSlMpIHtcbiAgICAvLyBUaGlzIGlzIG5vdCBhbiB1cHN0cmVhbSBUeXBlU2NyaXB0IGRpYWdub3N0aWMsIHRoZXJlZm9yZSBpdCBkb2VzIG5vdCBnb1xuICAgIC8vIHRocm91Z2ggdGhlIGRpYWdub3N0aWNzIGFycmF5IG1lY2hhbmlzbS5cbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAndHNpY2tsZSBjb252ZXJ0cyBUeXBlU2NyaXB0IG1vZHVsZXMgdG8gQ2xvc3VyZSBtb2R1bGVzIHZpYSBDb21tb25KUyBpbnRlcm5hbGx5LiAnICtcbiAgICAgICAgJ1NldCB0c2NvbmZpZy5qcyBcIm1vZHVsZVwiOiBcImNvbW1vbmpzXCInKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIC8vIFJ1biB0c2lja2xlK1RTQyB0byBjb252ZXJ0IGlucHV0cyB0byBDbG9zdXJlIEpTIGZpbGVzLlxuICBjb25zdCByZXN1bHQgPSB0b0Nsb3N1cmVKUyhcbiAgICAgIGNvbmZpZy5vcHRpb25zLCBjb25maWcuZmlsZU5hbWVzLCBzZXR0aW5ncywgKGZpbGVQYXRoOiBzdHJpbmcsIGNvbnRlbnRzOiBzdHJpbmcpID0+IHtcbiAgICAgICAgbWtkaXJwLnN5bmMocGF0aC5kaXJuYW1lKGZpbGVQYXRoKSk7XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZmlsZVBhdGgsIGNvbnRlbnRzLCB7ZW5jb2Rpbmc6ICd1dGYtOCd9KTtcbiAgICAgIH0pO1xuICBpZiAocmVzdWx0LmRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IodHMuZm9ybWF0RGlhZ25vc3RpY3MocmVzdWx0LmRpYWdub3N0aWNzLCB0cy5jcmVhdGVDb21waWxlckhvc3QoY29uZmlnLm9wdGlvbnMpKSk7XG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICBpZiAoc2V0dGluZ3MuZXh0ZXJuc1BhdGgpIHtcbiAgICBta2RpcnAuc3luYyhwYXRoLmRpcm5hbWUoc2V0dGluZ3MuZXh0ZXJuc1BhdGgpKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKFxuICAgICAgICBzZXR0aW5ncy5leHRlcm5zUGF0aCxcbiAgICAgICAgdHNpY2tsZS5nZXRHZW5lcmF0ZWRFeHRlcm5zKHJlc3VsdC5leHRlcm5zLCBjb25maWcub3B0aW9ucy5yb290RGlyIHx8ICcnKSk7XG4gIH1cbiAgcmV0dXJuIDA7XG59XG5cbi8vIENMSSBlbnRyeSBwb2ludFxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIHByb2Nlc3MuZXhpdChtYWluKHByb2Nlc3MuYXJndi5zcGxpY2UoMikpKTtcbn1cbiJdfQ==