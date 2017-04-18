#!/usr/bin/env node

const Chalk = require('chalk');
const fs = require('mz/fs');
const path = require('path');
const Program = require('commander');

const PluginJSONReader = require('../pluginJsonReader');
const PluginChangelogParser = require('../pluginChangelogParser');
const programVersion = require('../version');


// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-l, --language [language, e.g. "en"]', 'The language for which the changelog shall be returned', 'en')
    .option('--html', 'If set, the changelog is complied to HTML before it is returned')
    .parse(process.argv);


// Load an .env config if available
require('../envLoader').loadConfig(Program);

// Validate arguments
if (Program.args.length < 1) {
    console.error(Chalk.white.bgRed.bold('No file given!'));
    process.exit(1);
}

// Run program
const filePath = path.resolve(process.cwd(), Program.args[0]);
(async () => {
    try {
        const exists = await fs.exists(filePath);

        if (!exists) {
            throw new Error(`File ${filePath} does not exist`);
        }

        // Read the plugin.json of the provided zip file
        const reader = new PluginJSONReader();

        const pluginInfo = await reader.readZip(filePath);


        if (!pluginInfo) {
            throw new Error('Cannot upload plugin binary, because it is missing a plugin.json file.');
        }

        // Try to parse the plugin's changelog file in raw markdown
        const parser = new PluginChangelogParser(Program.html);
        parser.readZip(filePath).then((pluginChangeLog) => {
            if (!pluginChangeLog) {
                throw new Error('Cannot upload plugin binary, because it is missing a plugin.json file.');
            }

            // Add the parsed changelog to the plugin info and log the current version to the console
            pluginInfo.info.changelogs = pluginChangeLog;
            console.log(pluginInfo.getChangelog(Program.language));
        });
    } catch (err) {
        const errorMessage = `\u{1F6AB} Error: ${err.message}`;
        console.error(Chalk.white.bgRed.bold(errorMessage));
        console.error(err);
        process.exit(-1);
    }
})();

