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
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
function readCommandLineOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield yargs(hideBin(process.argv))
            .option('inFile', {
            description: 'Input metadata file',
            type: 'string',
            default: './build/extension/metadata.json',
        })
            .option('descriptionREADMEFile', {
            description: 'README file for description',
            type: 'string',
            default: './extension_page.md',
        })
            .option('outFile', {
            description: 'Output metadada file, if not provided input file is modified',
            type: 'string',
            requiresArg: false,
        })
            .help()
            .parse();
        return options;
    });
}
function main() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield readCommandLineOptions();
        options.outFile = (_a = options.outFile) !== null && _a !== void 0 ? _a : options.inFile;
        const metadada = JSON.parse(fs.readFileSync(options.inFile, 'utf8'));
        const description = fs.readFileSync(options.descriptionREADMEFile, 'utf8');
        metadada['description'] = description;
        fs.writeFileSync(options.outFile, JSON.stringify(metadada, null, 2));
    });
}
main();
