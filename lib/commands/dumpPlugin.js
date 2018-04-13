#!/usr/bin/env node

const Chalk = require('chalk');
const Program = require('commander');
const ShopwareStoreCommander = require('../shopwareStoreCommander');
const util = require('../util');
const programVersion = require('../version');
const spinner = require('../cliStatusIndicator');
const getPassword = require('../passwordPrompt');

// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-p, --plugin <plugin>', 'The name of the plugin for which to output information')
    .option('-t, --output-format <format>', 'Output in format <format>', 'json')
    .parse(process.argv);


// Load an .env config if available
require('../envLoader').loadConfig(Program);

// Validate arguments
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (typeof Program.plugin === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No plugin name given!'));
    process.exit(1);
}
if (Program.outputFormat !== 'json') {
    console.error(Chalk.white.bgRed.bold(`Unsupported output format: ${Program.outputFormat}`));
    process.exit(1);
}

async function main() {
    try {
        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.username, password);
        spinner(commander.logEmitter);

        // Try to find the plugin
        const plugin = await commander.findPlugin(Program.plugin);
        if (!plugin) {
            process.exit(1);
        }

        console.log(JSON.stringify(plugin, null, 4));
    } catch (err) {
        const errorMessage = `\u{1F6AB} Error: ${err.message}`;
        util.showGrowlIfEnabled(errorMessage);
        console.error(Chalk.white.bgRed.bold(errorMessage));
        console.error(err);
        process.exit(1);
    }
}

main();
