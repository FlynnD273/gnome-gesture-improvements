var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as fs from 'fs';
import glob from 'glob';
import path from 'path';
import ts from 'typescript';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
// list of gi modules (regex) and their name in imports.gi
const GIReplacements = {
    '^@gi-types/gtk(\\d+)?$': 'Gtk',
    '^@gi-types/gdk(\\d+)?$': 'Gdk',
    '^@gi-types/st(\\d+)?$': 'St',
    '^@gi-types/clutter(\\d+)?$': 'Clutter',
    '^@gi-types/gobject(\\d+)?$': 'GObject',
    '^@gi-types/glib(\\d+)?$': 'GLib',
    '^@gi-types/gio(\\d+)?$': 'Gio',
    '^@gi-types/shell(\\d+)?$': 'Shell',
    '^@gi-types/meta(\\d+)?$': 'Meta',
    '^@gi-types/adw(\\d+)?$': 'Adw',
};
/**
 * Create Property access expression for code string
 * @param context
 * @param access javascript code for which to create expression
 * @returns
 *
 * e.g., createAccessExpressionFor(context, 'obj.property')
 */
function createAccessExpressionFor(context, access) {
    const ids = access.split('.').filter(a => a.length > 0);
    if (ids.length === 0) {
        throw new Error(`can't create access expression for ${access}`);
    }
    let expression = context.factory.createIdentifier(ids[0]);
    ids.slice(1).forEach(id => {
        expression = context.factory.createPropertyAccessExpression(expression, context.factory.createIdentifier(id));
    });
    return expression;
}
/**
 * Create variable declaration expression
 * @param context
 * @param name name of variable
 * @param initializer variable initizlizer expression
 * @returns
 */
function createVariableDeclaration(context, name, initializer) {
    return context.factory.createVariableDeclaration(name, undefined, undefined, initializer);
}
/**
 * Create variable declaration statement
 * @param context
 * @param name name of variable
 * @param initializer variable initizlizer expression
 * @param flags flags, e.g. ts.NodeFlags.Const
 * @returns
 */
function createVariableStatement(context, name, initializer, flags) {
    return context.factory.createVariableStatement([], context.factory.createVariableDeclarationList([createVariableDeclaration(context, name, initializer)], flags));
}
/**
 * Move all comments to node
 * @param node target node to move comments to
 * @param originalNode original node
 * @returns target node
 */
function moveComments(node, originalNode) {
    if (node === undefined || originalNode === undefined) {
        return node;
    }
    node = ts.setSyntheticLeadingComments(node, ts.getSyntheticLeadingComments(originalNode));
    node = ts.setSyntheticTrailingComments(node, ts.getSyntheticTrailingComments(originalNode));
    return ts.setCommentRange(node, ts.getCommentRange(originalNode));
}
// printer to print code
const printer = ts.createPrinter({ removeComments: false });
/**
 * typescript transformer to transform exports
 * @param context
 * @returns transformation function
 *
 * transformation function
 * 1. Removes 'export' modifier from function
 * 2. Convert exported ClassDeclaration into variable statement.
 * 	e.g., 'export class A {}' => 'var A = class A{};'
 * 3. Convert exported variables into 'var'
 * 	e.g., 'export const ABC = 8;' => 'var ABC = 8;'
 */
const transformExports = context => {
    /* Remove 'export' modifier from function declaration */
    const tranformFunction = (node, variables) => {
        var _a, _b;
        if (!((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
            return node;
        }
        variables.push(((_b = node.name) === null || _b === void 0 ? void 0 : _b.text) || '');
        return moveComments(context.factory.createFunctionDeclaration(node.decorators, node.modifiers.filter(m => m.kind !== ts.SyntaxKind.ExportKeyword), node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, node.body || context.factory.createBlock([])), node);
    };
    /* convert exported class declaration to variable statement */
    const transformClass = (node, variables) => {
        var _a, _b, _c;
        if (!((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
            return node;
        }
        variables.push(((_b = node.name) === null || _b === void 0 ? void 0 : _b.text) || '');
        return moveComments(createVariableStatement(context, ((_c = node.name) === null || _c === void 0 ? void 0 : _c.text) || '', context.factory.createClassExpression(node.decorators, node.modifiers.filter(m => m.kind !== ts.SyntaxKind.ExportKeyword), node.name, node.typeParameters, node.heritageClauses, node.members)), node);
    };
    /* make all exported variables 'var' type */
    const tranformVariable = (node, variables) => {
        var _a;
        if (!((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
            return node;
        }
        return moveComments(context.factory.createVariableStatement([], node.declarationList.declarations.map(d => {
            if (d.name.kind === ts.SyntaxKind.Identifier) {
                variables.push(d.name.text);
            }
            return moveComments(createVariableDeclaration(context, d.name, d.initializer), d);
        })), node);
    };
    /* transformation function */
    return sourceFile => {
        const variables = [];
        const visitor = (node) => {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                    return transformClass(node, variables);
                case ts.SyntaxKind.FunctionDeclaration:
                    return tranformFunction(node, variables);
                case ts.SyntaxKind.VariableStatement:
                    return tranformVariable(node, variables);
                default:
                    return node;
            }
        };
        const modifiedSourceFile = ts.visitEachChild(sourceFile, visitor, context);
        // Add /* exported var1,var2 */ comment to before first statement
        if (variables.length && modifiedSourceFile.statements.length) {
            ts.addSyntheticLeadingComment(modifiedSourceFile.statements[0], ts.SyntaxKind.MultiLineCommentTrivia, ` exported ${variables.join(', ')} `, true);
        }
        return moveComments(modifiedSourceFile, sourceFile);
    };
};
/**
 * typescript transformer to transform exports
 * @param context
 * @returns transformation function
 *
 * transformation function
 * 1. replaces @gi-types/* modules into imports.gi
 * 	e.g., "import St from '@gi-types/st';" => "const St = imports.gi.St;"
 * 2. Removes "import ... from 'gnome-shell'" statement.
 * 3. replaces local imports with statement compatible with extensions
 * 	e.g., in extension.js (top level)
 * 		"import { Indicator } from './indicator';" => "const { Indicator } = Me.imports.indicator;"
 * 		and it ensures "const Me = imports.misc.extensionUtils.getCurrentExtension();" is added before above statement.
 *
 */
const transformImports = context => {
    /**
     * Actual transformation function
     * @param node ImportDeclaration node
     * @param getModuleReplacement function which returns object with module expression and "const Me ...." statement is necessary
     * 			e.g., getModuleReplacement('@gi-types/clutter') => {statement: undefined, module: Expression('imports.gi.Clutter')}
     * 			e.g., getModuleReplacement('@gi-types/gobject2') => {statement: Expression('const Me = ...'), module: Expression('imports.gi.GObject')}
     * @returns returns either	throws when import declaration doesn't fit into above categories
     * 							or returns list of variable statements or empty statement
     */
    const transformImport = (node, getModuleReplacement) => {
        var _a, _b, _c, _d, _e;
        const module = node.moduleSpecifier;
        /* remove import from 'gnome-shell' statement */
        if (module.text === 'gnome-shell') {
            return moveComments(context.factory.createEmptyStatement(), node);
        }
        const replacement = getModuleReplacement(module.text);
        /* unknown import statement */
        if (!replacement) {
            throw new Error(`Unknown import statement '${node.getFullText()}'`);
        }
        const statements = [];
        if (replacement.statement) {
            /* 'const Me = ...' statement */
            statements.push(replacement.statement);
        }
        if ((_a = node.importClause) === null || _a === void 0 ? void 0 : _a.name) {
            /* import whole module 'St' in 'import St from ...' or 'Gtk' in 'import Gtk, {} from ...'  */
            statements.push(createVariableStatement(context, node.importClause.name.text, replacement.module, ts.NodeFlags.Const));
        }
        /* namespace imports e.g., 'import * as Clutter from ...' */
        (_c = (_b = node.importClause) === null || _b === void 0 ? void 0 : _b.namedBindings) === null || _c === void 0 ? void 0 : _c.forEachChild(binding => {
            if (binding.kind !== ts.SyntaxKind.Identifier) {
                if (binding.kind !== ts.SyntaxKind.ImportSpecifier)
                    throw new Error(`Can't understand namespace import ${node}`);
                return;
            }
            const bindingId = binding;
            statements.push(createVariableStatement(context, bindingId.text, replacement.module, ts.NodeFlags.Const));
        });
        /* named imports e.g., 'import { a, b } from ...' */
        const namedBindings = [];
        (_e = (_d = node.importClause) === null || _d === void 0 ? void 0 : _d.namedBindings) === null || _e === void 0 ? void 0 : _e.forEachChild(binding => {
            if (binding.kind === ts.SyntaxKind.ImportSpecifier) {
                const node = binding;
                namedBindings.push(node.name.text);
            }
        });
        if (namedBindings.length) {
            const bindingName = context.factory.createObjectBindingPattern(namedBindings.map(name => {
                return context.factory.createBindingElement(undefined, undefined, name, undefined);
            }));
            /* replacing named imports with 'const { a, b } = ...' */
            statements.push(createVariableStatement(context, bindingName, replacement.module, ts.NodeFlags.Const));
        }
        if (statements.length) {
            moveComments(statements[0], node);
            return statements;
        }
        else {
            throw new Error(`Can't understand import statement '${node}'`);
        }
    };
    /* transformation function */
    return sourceFile => {
        let addedMeStatement = false;
        /* function which returns object with module expression and "const Me ...." statement is necessary */
        const getModuleReplacement = (module) => {
            const giModule = Object.keys(GIReplacements).find(key => module.match(new RegExp(key)));
            if (giModule) {
                /* GI import */
                return { module: createAccessExpressionFor(context, `imports.gi.${GIReplacements[giModule]}`) };
            }
            if (module.startsWith('.')) {
                /* local import */
                let statement = undefined;
                if (!addedMeStatement && ISEXTENSION) {
                    addedMeStatement = true;
                    //const Me = imports.misc.extensionUtils.getCurrentExtension();
                    statement = createVariableStatement(context, 'Me', context.factory.createCallExpression(createAccessExpressionFor(context, 'imports.misc.extensionUtils.getCurrentExtension'), [], []), ts.NodeFlags.Const);
                }
                /* path of imported module relative to root directory if extension */
                module = path.join(path.dirname(sourceFile.fileName), module);
                module = path.relative(BASEDIR, module);
                const moduleStrings = module.split('/').filter(m => m.length > 0);
                if (!moduleStrings.length) {
                    throw new Error(`unable to resolve '${module}'`);
                }
                return {
                    statement,
                    module: createAccessExpressionFor(context, (ISEXTENSION ? 'Me.' : '') + `imports.${moduleStrings.join('.')}`),
                };
            }
            /* unknown import */
            return null;
        };
        const visitor = (node) => {
            if (node.kind !== ts.SyntaxKind.ImportDeclaration) {
                return node;
            }
            return transformImport(node, getModuleReplacement);
        };
        return moveComments(ts.visitEachChild(sourceFile, visitor, context), sourceFile);
    };
};
/**
 * typescript transformer to transform exports
 * @param context
 * @returns transformation function
 *
 * transformation function
 * 1. Replace constructor with '_init' function.
 * 2. Replace 'super()' call with 'super._init' call.
 */
const transformGObjectClasses = context => {
    /**
     * replace 'super()' call
     * @param node child node of function body
     * @returns
     */
    const replaceSuperCall = (node) => {
        if (node.kind === ts.SyntaxKind.CallExpression) {
            const callNode = node;
            if (callNode.expression.kind === ts.SyntaxKind.SuperKeyword) {
                return moveComments(context.factory.createCallExpression(context.factory.createPropertyAccessExpression(context.factory.createIdentifier('super'), context.factory.createIdentifier('_init')), callNode.typeArguments, callNode.arguments), node);
            }
        }
        return moveComments(ts.visitEachChild(node, replaceSuperCall, context), node);
    };
    /**
     * Replace constructor and super call
     * @param node child of class expression
     * @returns
     */
    const transformConstructor = (node) => {
        if (node.kind === ts.SyntaxKind.Constructor) {
            const constructorNode = node;
            return moveComments(context.factory.createMethodDeclaration(constructorNode.decorators, constructorNode.modifiers, constructorNode.asteriskToken, '_init', constructorNode.questionToken, constructorNode.typeParameters, constructorNode.parameters, constructorNode.type, ts.visitEachChild(constructorNode.body, replaceSuperCall, context)), node);
        }
        return node;
    };
    /* transformation function */
    return sourceFile => {
        const visitor = (node) => {
            if (node.kind === ts.SyntaxKind.CallExpression) {
                const callNode = node;
                if (callNode.expression.kind === ts.SyntaxKind.Identifier) {
                    /* '... = registerClass(...)' call, e.g, registerClass was named import */
                    if (callNode.expression.text !== 'registerClass') {
                        return moveComments(ts.visitEachChild(node, visitor, context), node);
                    }
                }
                else if (callNode.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                    /* '... = <module>.registerClass(...)' call, e.g, GObject.registerClass(...) after importing GObject class */
                    const id = callNode.expression;
                    if (id.expression.kind !== ts.SyntaxKind.Identifier ||
                        id.name.kind !== ts.SyntaxKind.Identifier ||
                        id.name.text !== 'registerClass') {
                        return moveComments(ts.visitEachChild(node, visitor, context), node);
                    }
                }
                else {
                    return moveComments(ts.visitEachChild(node, visitor, context), node);
                }
                if (callNode.arguments.length === 2 && callNode.arguments[1].kind === ts.SyntaxKind.ClassExpression) {
                    // second argument is class expression, registerClass({}, class {}) call
                    return moveComments(context.factory.createCallExpression(callNode.expression, callNode.typeArguments, [
                        callNode.arguments[0],
                        moveComments(ts.visitEachChild(callNode.arguments[1], transformConstructor, context), callNode.arguments[1]),
                    ]), node);
                }
                if (callNode.arguments.length === 1 && callNode.arguments[0].kind === ts.SyntaxKind.ClassExpression) {
                    // first argument is class expression, registerClass(class {}) call
                    return moveComments(context.factory.createCallExpression(callNode.expression, callNode.typeArguments, [
                        moveComments(ts.visitEachChild(callNode.arguments[0], transformConstructor, context), callNode.arguments[0]),
                    ]), node);
                }
                throw new Error(`registerClass(${printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)})` +
                    'can\'t have more than 2 argument and last argument should be class expression');
            }
            return moveComments(ts.visitEachChild(node, visitor, context), node);
        };
        return moveComments(ts.visitEachChild(sourceFile, visitor, context), sourceFile);
    };
};
var ProgramType;
(function (ProgramType) {
    ProgramType["App"] = "app";
    ProgramType["Extension"] = "extension";
})(ProgramType || (ProgramType = {}));
function readCommandLineOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield yargs(hideBin(process.argv))
            .option('dir', {
            alias: 'd',
            description: 'Directory of *javascript* files, which will be overwritten',
            type: 'string',
            default: 'build/extension',
        })
            .option('type', {
            alias: 't',
            choices: Object.values(ProgramType),
            description: 'Is your code gjs-app or extension?',
            default: 'extension',
        })
            .help()
            .alias('h', 'help')
            .parse();
        return options;
    });
}
function transpileFiles() {
    const matches = glob.globSync(`${BASEDIR}/**/*.js`);
    if (matches && matches.length) {
        matches.forEach(file => {
            console.log(`transpiling file: ${file}`);
            const text = fs.readFileSync(file).toString();
            let sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2018, true, ts.ScriptKind.JS);
            sourceFile = ts.transform(sourceFile, [transformExports, transformImports, transformGObjectClasses]).transformed[0];
            fs.writeFileSync(file, printer.printFile(sourceFile));
        });
    }
}
let BASEDIR = 'build/extension';
let ISEXTENSION = true; // is your code for extension?
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield readCommandLineOptions();
        BASEDIR = options.dir;
        ISEXTENSION = options.type === ProgramType.Extension;
        transpileFiles();
    });
}
main();
