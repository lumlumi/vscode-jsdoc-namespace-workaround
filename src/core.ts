import { Uri, WorkspaceFolder, window } from "vscode";
import Babel = require("@babel/parser");
import BabelTypes = require("@babel/types");
import CommentParser = require('comment-parser');
import fs = require("fs");
import path = require("path");
import { write } from "./writer";

export class NamespaceHandler {

    private configurations : Map<string, Workspace>;

    constructor() {
        this.configurations = new Map();
    }


	processChange(fileChangedPath: string) {
        const workspace = find(this.configurations.values(), fileChangedPath);
        workspace?.removeFile(fileChangedPath);
        if(fs.existsSync(fileChangedPath)) {
            workspace?.parseFile(fileChangedPath);
        }
        workspace?.render();
	}

    addWorkspace(workspaceFolder : WorkspaceFolder) {
        const workspace = new Workspace(workspaceFolder.uri.path);
        this.configurations.set(workspaceFolder.uri.path, workspace);
        workspace.parse();
        workspace.render();
    }

    clearWorkspace(workspaceFolder : WorkspaceFolder) {
        this.configurations.delete(workspaceFolder.uri.path);
    }
}

function find(iterator: IterableIterator<Workspace>, path: string) : Workspace | undefined {
    return Array.from(iterator).find(workspace => {
        return path.startsWith(workspace.rootPath);
    });
}

class Workspace {
    rootPath : string;
    namespaces : Map<string, Namespace> = new Map();


    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }
    
    render() {
        write(this.rootPath, Array.from(this.namespaces.values()));
    }


    parse(): string[] {
        const errors: string[] = [];
        walkSync(this.rootPath, file => {
            const parseErrors = this.parseFile(file);
            errors.push(...parseErrors);
        }, file => file.endsWith(".js"));
        return errors;
    }

    parseFile(path: string) : string[] {
        /**@type {Babel.ParseResult<BabelTypes.File>}*/
        try {
            const ast = Babel.parse(fs.readFileSync(path).toString());
            ast.program.body.forEach(bodyEntry => {
                const leadingComment = bodyEntry.leadingComments && bodyEntry.leadingComments?.length > 0 ? bodyEntry.leadingComments[bodyEntry.leadingComments?.length - 1] : null; 
                if(leadingComment) {
                    const parsedComment = parseJsdocComment(leadingComment);
                    if(parsedComment.isMemberOf) {
                        switch(bodyEntry.type) {
                            case "FunctionDeclaration" :
                                parsedComment.name = String(bodyEntry.id?.name);
                                parsedComment.sourceType = "Function";
                                break;
                            case "VariableDeclaration" :
                                /*parsedComment.name = bodyEntry.declarations[0].id.type;
                                parsedComment.sourceType = "Var";*/
                                break;
                        }      
                    }
                    if(parsedComment.isMemberOf && !parsedComment.private) {
                        const namespace = this.createIfAbsent(String(parsedComment.memberOf));
                        namespace.addEntry(path, parsedComment);
                    }
                }
            });
        } catch(e) {
            ["Parse failed for file " + path  + ":" + e];
        }
        return [];
    }

    removeFile(path: string) {
        const namespaceToRemove : string[] = [];
        Array.from(this.namespaces.values()).forEach(namespace => {
            namespace.removeEntry(path);
            if(!namespace.hasEntry()) {
                namespaceToRemove.push(namespace.name);
            }
        });
    }


    private createIfAbsent(name : string) : Namespace {
        let namespace = this.namespaces.get(name);
        if(typeof namespace !== "undefined") {
            return namespace;
        }
        namespace = new Namespace(name);
        this.namespaces.set(name, namespace);
        return namespace;
    }
}

function walkSync(rootPath: string, onFile: (file: string) => void, filter: (file: string) => boolean): void {
    fs.readdirSync(rootPath).forEach(file => {
        const filePath = path.resolve(rootPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            walkSync(filePath, onFile, filter);
        } else if (filter(filePath)) {
            onFile(filePath);
        }
    });
}


export class Namespace {
    readonly name : string;
    private byFiles : Map<string, ParsedJsdocComment[]> = new Map();

    constructor(name: string) {
        this.name = name;
    }

    addEntry(path: string, entry: ParsedJsdocComment) {
        const entries = this.byFiles.get(path) || [];
        entries.push(entry);
        this.byFiles.set(path, entries);
    }

    getEntries() : ParsedJsdocComment[] {
        return Array.from(this.byFiles.values())
        .reduce((acc, entriesFromFile) => {
            entriesFromFile.forEach(entry => acc.push(entry));
            return acc;
        }, []);
    }

    hasEntry() : boolean {
        return this.byFiles.size > 0;
    }

    removeEntry(path: string) {
        this.byFiles.delete(path);
    }
}


interface ParsedJsdocComment {
    private: boolean;
    name: string | null,
    isNamespace : boolean,
    isMemberOf : boolean,
    namespace : string | null
    memberOf : string | null,
    rawComment: string,
    params : {
        name: string,
        type: string
    }[];
    returnType: string | null,
    sourceType: null | "Var" | "Function";
}


function parseJsdocComment(leadingComment: BabelTypes.Comment) {
    const result : ParsedJsdocComment = {
        name: null,
        isNamespace : false,
        isMemberOf : false,
        memberOf : null,
        namespace : null, 
        private: false,
        rawComment : "/*" + leadingComment.value + "*/",
        params : [],
        returnType : null,
        sourceType : null
    };   
    const commentParsed = CommentParser.parse(result.rawComment);
    commentParsed.forEach(entry => {
        entry.tags.forEach(tagEntry => {
            switch(tagEntry.tag.toLowerCase()) {
                case "namespace" :
                    result.namespace = tagEntry.name;
                    result.isNamespace = true;
                    break;
                case "memberof" : 
                    if(tagEntry.name) {
                        result.memberOf = tagEntry.name;
                        result.isMemberOf = true;
                    }
                    break;
                case "param" : 
                    result.params.push({
                        name: tagEntry.name,
                        type: tagEntry.type
                    });
                    break;
                case "private":
                    result.private = true;
                case "type" :
                case "return" :
                case "returns" :
                    result.returnType = tagEntry.type;
                    break;
            }
        });
    });
    return result; 
}

