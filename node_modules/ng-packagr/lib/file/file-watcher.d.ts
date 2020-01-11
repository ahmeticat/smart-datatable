import { Observable } from 'rxjs';
export declare type FileWatchEvent = 'change' | 'unlink' | 'add' | 'unlinkDir' | 'addDir';
export interface FileChangedEvent {
    filePath: string;
    event: FileWatchEvent;
}
export declare function createFileWatch(projectPath: string, ignoredPaths?: (RegExp | string)[]): Observable<FileChangedEvent>;
