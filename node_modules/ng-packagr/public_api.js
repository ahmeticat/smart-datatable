"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Commands API
 */
__export(require("./lib/commands/command"));
__export(require("./lib/commands/build.command"));
__export(require("./lib/commands/version.command"));
/**
 * ngPackagr() programmatic API
 */
__export(require("./lib/ng-v5/packagr"));
/**
 * Angular-specifics for tsc and ngc
 */
var compile_source_files_1 = require("./lib/ngc/compile-source-files");
exports.compileSourceFiles = compile_source_files_1.compileSourceFiles;
//# sourceMappingURL=public_api.js.map