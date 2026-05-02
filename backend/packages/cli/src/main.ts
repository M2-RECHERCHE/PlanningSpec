import type { Planification } from 'planning-spec-language';
import { createPlanningSpecServices, PlanningSpecLanguageMetaData } from 'planning-spec-language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode, extractDocument } from './util.js';
import { generateJavaScript } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createPlanningSpecServices(NodeFileSystem).PlanningSpec;
    const model = await extractAstNode<Planification>(fileName, services);
    const generatedFilePath = generateJavaScript(model, fileName, opts.destination);
    console.log(chalk.green(`JavaScript code generated successfully: ${generatedFilePath}`));
};

export const generateMiniZincAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createPlanningSpecServices(NodeFileSystem).PlanningSpec;
    const document = await extractDocument(fileName, services);
    const outputDirectory = opts.destination
        ? path.resolve(opts.destination)
        : path.resolve(process.cwd(), 'generated_mzn');
    const generatedFilePath = services.generator.Generator.generateToFile(document, outputDirectory);
    console.log(chalk.green(`MiniZinc code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default async function(): Promise<void> {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = PlanningSpecLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates JavaScript code that prints "Hello, {name}!" for each greeting in a source file')
        .action(generateAction);

    program
        .command('generate-mzn')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of MiniZinc files')
        .description('generates a MiniZinc model from a .planning file')
        .action(generateMiniZincAction);

    await program.parseAsync(process.argv);
}
