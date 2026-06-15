import * as assert from 'assert';
import * as vscode from 'vscode';
import { DtoFieldExtractor } from '../../extractor/DtoFieldExtractor';

suite('DtoFieldExtractor Test Suite', () => {
    const originalFindFiles = vscode.workspace.findFiles;
    const originalReadFile = vscode.workspace.fs.readFile;

    teardown(() => {
        vscode.workspace.findFiles = originalFindFiles;
        vscode.workspace.fs.readFile = originalReadFile;
    });

    test('Should cache DTO file lookup and direct field parsing within one extractor instance', async () => {
        const userUri = { fsPath: 'C:\\workspace\\src\\main\\java\\com\\example\\dto\\UserDto.java' } as vscode.Uri;
        const addressUri = { fsPath: 'C:\\workspace\\src\\main\\java\\com\\example\\dto\\AddressDto.java' } as vscode.Uri;
        const fileContents = new Map<string, string>([
            [userUri.fsPath, [
                'package com.example.dto;',
                '',
                'public class UserDto {',
                '    private String id;',
                '    private AddressDto address;',
                '}'
            ].join('\n')],
            [addressUri.fsPath, [
                'package com.example.dto;',
                '',
                'public class AddressDto {',
                '    private String city;',
                '}'
            ].join('\n')]
        ]);

        let findFilesCalls = 0;
        let readFileCalls = 0;

        vscode.workspace.findFiles = async (include: vscode.GlobPattern) => {
            findFilesCalls++;
            const pattern = String(include);
            if (pattern.includes('UserDto')) {
                return [userUri];
            }
            if (pattern.includes('AddressDto')) {
                return [addressUri];
            }
            return [];
        };

        vscode.workspace.fs.readFile = async (uri: vscode.Uri) => {
            readFileCalls++;
            const content = fileContents.get(uri.fsPath);
            assert.ok(content, `Missing fixture content for ${uri.fsPath}`);
            return Buffer.from(content, 'utf8');
        };

        const extractor = new DtoFieldExtractor();

        const first = await extractor.findDtoFields('UserDto');
        const second = await extractor.findDtoFields('UserDto');

        assert.strictEqual(first.length, 2);
        assert.strictEqual(second.length, 2);
        assert.strictEqual(first[1].nested?.[0].name, 'city');
        assert.strictEqual(second[1].nested?.[0].name, 'city');
        assert.notStrictEqual(first, second);
        assert.notStrictEqual(first[1].nested, second[1].nested);
        assert.strictEqual(findFilesCalls, 2);
        assert.strictEqual(readFileCalls, 2);
    });
});
