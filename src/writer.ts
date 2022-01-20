import { Namespace } from "./core";
import fs = require("fs");
import path = require("path");

export function write(rootPath: string, namespaces : Namespace[]) : void {
    const targetFile = path.join(rootPath, "namespaces.d.ts");
    fs.writeFileSync(targetFile, "");
    namespaces.forEach(namespace => writeNamespace(targetFile, namespace));
}


function writeNamespace(filePath: string, namespace: Namespace) {
    fs.appendFileSync(filePath,`interface ${namespace.name} {\n${namespace.getEntries().map(entry => {
        return `${entry.rawComment}\n${entry.name}${renderParams(entry.params)} : ${entry.returnType}`; 
    }).join(",\n")}\n}\ndeclare var ${namespace.name} : ${namespace.name};\n`);
}


function renderParams(params: {name: string, type: string}[]) : string {
    return`(${params.map(param => {return `${param.name} : ${param.type}`;}).join(", ")})`;
}