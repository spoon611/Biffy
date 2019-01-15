import * as vscode from 'vscode'
import ITypeScriptServiceClient from '../typeScriptServiceClient'
import * as typeConverters from '../utils/typeConverters';
import * as Proto from '../utils/protocol';
import * as fs from 'fs';
import Helper from '../utils/helper';

export default class BifReferenceProvider implements vscode.ReferenceProvider {

    private helper: Helper;

    public constructor(private readonly client: ITypeScriptServiceClient) {
        this.helper = new Helper();
    }

    public async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: false },
        token: vscode.CancellationToken)
        : Promise<vscode.Location[]> {

        const references = this.getReferences(document, position);
        const result: vscode.Location[] = [];
        for (const ref of references) {
            let url: vscode.Uri = this.client.toResource(ref.filePath, document);
            const location = typeConverters.Location.fromTextSpan(url, ref.location);
            result.push(location);
        }

        return result;
    }

    private getReferences(document: vscode.TextDocument, position: vscode.Position): Response[] {
        let data = document.getText();
        if (data) {
            let line = this.helper.readLines(data)[position.line];
            let guid = this.helper.getGuidAtPosition(line, position.character);
            let bifSourcePath = this.helper.getBIFSourcePath();

            if (this.helper.checkGuidValidity(guid)) {
                let folders = this.helper.getAllFoldersInBIFSource(bifSourcePath, []);
                let files = this.helper.getBIFFiles(folders);
                return this.getFilesWithReference(files, guid);
            } 
            else {
                let word = document.getText(document.getWordRangeAtPosition(position));
                return this.getWordReferences(data, word, this.client.toOpenedFilePath(document));
            }
        }
        return [];
    }

    private getWordReferences(data: string, word: string, filePath: string): Response[] {
        let positionReference: Response[] = [];
        if (data.includes(word)) {
            data.split("\n").forEach(function (line, i) {
                if (line.includes(word)) {
                    let referenceLocation = new ReferenceLocation();
                    referenceLocation.start = new Location();
                    referenceLocation.start.line = i + 1;
                    referenceLocation.start.offset = line.indexOf(word) + 1;

                    referenceLocation.end = new Location();
                    referenceLocation.end.line = i + 1;
                    referenceLocation.end.offset = referenceLocation.start.offset + word.length;

                    let response = new Response();
                    response.filePath = filePath;
                    response.location = referenceLocation;
                    positionReference.push(response);
                }
            });
        }
        return positionReference;
    }

    private getFilesWithReference(files: string[], word: string): Response[] {
        let filesReference: Response[] = [];
        for (let file of files) {
            let data = fs.readFileSync(file, "utf-8");
            if (data) {
                if (data.includes(word)) {
                    data.split("\n").forEach(function (line, i) {
                        if (line.includes(word)) {
                            let referenceLocation = new ReferenceLocation();
                            referenceLocation.start = new Location();
                            referenceLocation.start.line = i + 1;
                            referenceLocation.start.offset = line.indexOf(word) + 1;

                            referenceLocation.end = new Location();
                            referenceLocation.end.line = i + 1;
                            referenceLocation.end.offset = referenceLocation.start.offset + word.length;

                            let response = new Response();
                            response.filePath = file;
                            response.location = referenceLocation;
                            filesReference.push(response);
                        }
                    });
                }
            }
        }
        return filesReference;
    }
}

class Response {
    filePath: string;
    location: Proto.TextSpan;
}

class ReferenceLocation implements Proto.TextSpan {
    start: Proto.Location;
    end: Proto.Location;
}

class Location implements Proto.Location {
    line: number;
    offset: number;
}
