import * as path from 'path';

let platformOverride: NodeJS.Platform | undefined;

export function setPlatformForTest(platform?: NodeJS.Platform): void {
    platformOverride = platform;
}

export function isCaseInsensitivePlatform(platform: NodeJS.Platform = platformOverride ?? process.platform): boolean {
    return platform === 'win32';
}

export function toPosixPath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

export function normalizePathKey(filePath: string, platform: NodeJS.Platform = platformOverride ?? process.platform): string {
    if (!filePath) {
        return '';
    }
    if (isCaseInsensitivePlatform(platform)) {
        return path.win32.normalize(filePath).replace(/\\/g, '/').toLowerCase();
    }
    return path.posix.normalize(filePath.replace(/\\/g, '/'));
}

export function relativeFromFolder(
    folderPath: string,
    targetPath: string,
    platform: NodeJS.Platform = platformOverride ?? process.platform
): string | null {
    const win = isCaseInsensitivePlatform(platform);
    const rel = win
        ? path.win32.relative(folderPath, targetPath).replace(/\\/g, '/')
        : path.posix.relative(folderPath.replace(/\\/g, '/'), targetPath.replace(/\\/g, '/'));
    if (rel === '..' || rel.startsWith('../') || (win ? path.win32.isAbsolute(rel) : path.posix.isAbsolute(rel))) {
        return null;
    }
    return rel;
}
