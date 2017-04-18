#!/usr/bin/env node


const Chalk = require('chalk');
const fs = require('mz/fs');
const Program = require('commander');
const path = require('path');

const ShopwareStoreCommander = require('../shopwareStoreCommander');
const util = require('../util');
const programVersion = require('../version');

const spinner = require('../cliStatusIndicator');

const getPassword = require('../passwordPromt');


// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-p, --plugin <plugin>', 'The name of the plugin, for which the description shall be updated.')
    .option('-l, --locale <locale>', 'The locale, for which the description shall be udpated, e.g. de_DE, en_GB etc.')
    .parse(process.argv);


// Load an .env config if available
require('../envLoader').loadConfig(Program);

// Validate arguments
if (Program.args.length < 1) {
    console.error(Chalk.white.bgRed.bold('No file given!'));
    process.exit(1);
}
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (typeof Program.plugin === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No plugin name given!'));
    process.exit(1);
}
if (typeof Program.locale === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No locale given!'));
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), Program.args[0]);
getPassword(Program).then((password) => {
    // Run program
    const commander = new ShopwareStoreCommander(Program.username, password);
    spinner(commander.client.emitter);

    return fs.exists(filePath).then(exists => ({ commander, exists }));
})
.then(({ commander, exists }) => {
    if (!exists) {
        throw new Error(`File ${filePath} does not exist`);
    }

    return commander.findPlugin(Program.plugin).then(plugin => ({ commander, plugin }));
})
.then(({ commander, plugin }) => {
    // Try to find info for locale
    const info = plugin.infos.find(data => data.locale.name === Program.locale);
    if (!info) {
        console.error(Chalk.white.bgRed.bold(`Locale '${Program.locale}' is not available!`));
        console.log(`Available locales for plugin ${plugin.name}`);
        plugin.infos.forEach((data) => {
            console.log(`- ${data.locale.name}`);
        });
        process.exit(1);
    }

    // Read the description file
    return fs.readFile(filePath, 'utf-8').then((description) => {
        // Update plugin description
        info.description = description;

        // Save changes
        return commander.savePlugin(plugin);
    });
})
.then((plugin) => {
    const successMessage =
        `Description of plugin ${plugin.name} for locale '${Program.locale}' successfully updated! \u{1F389}`;
    util.showGrowlIfEnabled(successMessage);
    console.log(Chalk.green.bold(successMessage));
})
.catch((err) => {
    const errorMessage = `\u{1F6AB} Error: ${err.message}`;
    util.showGrowlIfEnabled(errorMessage);
    console.error(Chalk.white.bgRed.bold(errorMessage));
    console.error(err);
    process.exit(-1);
});
