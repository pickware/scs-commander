#!/usr/bin/env node

const Chalk = require('chalk');
const path = require('path');
const Program = require('commander');
const programVersion = require('../version');
const Plugin = require('../plugin');

// Define CLI
Program
    .version(programVersion)
    .description('Reads the changelog from a plugin ZIP file and prints it.')
    .arguments('<file> Path to the plugin ZIP file')
    .option('-l, --language [language, e.g. "en"]', 'The language for which the changelog shall be returned', 'en')
    .option('--html', 'Return the changelog as HTML instead of Markdown')
    .parse(process.argv);

// Load an .env config if available
require('../envLoader').loadConfig(Program);

// Validate arguments
if (Program.args.length < 1) {
    console.error(Chalk.white.bgRed.bold('No file given!'));
    process.exit(1);
}

async function main() {
    try {
        const pluginZipFilePath = path.resolve(process.cwd(), Program.args[0]);

        const plugin = await Plugin.readFromZipFile(pluginZipFilePath);

        const releaseNotesMarkdown = plugin.releaseNotes[Program.language];

        if (Program.html) {
            console.log(releaseNotesMarkdown.toHtml());
        } else {
            console.log(releaseNotesMarkdown.toString());
        }
    } catch (err) {
        const errorMessage = `\u{1F6AB} Error: ${err.message}`;
        console.error(Chalk.white.bgRed.bold(errorMessage));
        console.error(err);
        process.exit(-1);
    }
}

main();
