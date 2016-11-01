#!/usr/bin/env node
'use strict';

var Chalk = require('chalk');
var fs = require('mz/fs');
var Program = require('commander');
var ShopwareStoreCommander = require('../shopware_store_commander');
var path = require('path');


// Define CLI
Program
    .version('0.2.0')
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-p, --plugin <plugin>', 'The name of the plugin, for which the description shall be updated.')
    .option('-l, --locale <locale>', 'The locale, for which the description shall be udpated, e.g. de_DE, en_GB etc.')
    .parse(process.argv);


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


// Run program
var filePath = path.resolve(process.cwd(), Program.args[0]);
var commander = new ShopwareStoreCommander(Program.username);
fs.exists(filePath).then(exists => {
    if (!exists) {
        throw new Error(`File ${filePath} does not exist`);
    };

    return commander.findPlugin(Program.plugin);
}).then(plugin => {
    // Try to find info for locale
    var info = plugin.infos.find(data => {
        return data.locale.name == Program.locale;
    });
    if (!info) {
        console.error(Chalk.white.bgRed.bold(`Locale '${Program.locale}' is not available!`));
        console.log(`Available locales for plugin ${plugin.name}`);
        plugin.infos.forEach(data => {
            console.log(`- ${data.locale.name}`);
        });
        process.exit(1);
    }

    // Read the description file
    return fs.readFile(filePath, 'utf-8').then(description => {
        // Update plugin description
        info.description = description;

        // Save changes
        return commander.savePlugin(plugin);
    });
}).then(plugin => {
    console.log(Chalk.green.bold(`Description of plugin ${plugin.name} for locale '${Program.locale}' successfully updated!`));
}).catch(err => {
    console.error(Chalk.white.bgRed.bold(`Error: ${err.message}`));
    console.error(err);
    process.exit(-1);
});
