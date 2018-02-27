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

async function main() {
    try {
        // Validate arguments
        if (typeof Program.username === 'undefined') {
            throw new Error('No username given!');
        }
        if (typeof Program.plugin === 'undefined') {
            throw new Error('No plugin name given!');
        }
        if (Program.outputFormat !== 'json') {
            throw new Error(`Unsupported output format: ${Program.outputFormat}`);
        }

        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.username, password);
        spinner(commander.logEmitter);

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
