#!/usr/bin/env node
'use strict';

const Chalk = require('chalk');
const Program = require('commander');
const semver = require('semver');
const ShopwareStoreCommander = require('../shopware_store_commander');
const Table = require('cli-table');

const pluginComparators = {
    name: (a, b) => {
        return a.name.localeCompare(b.name);
    },
    version: (a, b) => {
        const vA = (a.latestBinary) ? a.latestBinary.version : '0.0.0';
        const vB = (b.latestBinary) ? b.latestBinary.version : '0.0.0';
        return semver.compare(vA, vB);
    },
    active: (a, b) => {
        return a.activationStatus.name.localeCompare(b.activationStatus.name);
    },
    reviewStatus: (a, b) => {
        const vA = (a.latestBinary) ? a.latestBinary.status.description : 'none';
        const vB = (b.latestBinary) ? b.latestBinary.status.description : 'none';
        return vA.localeCompare(vB);
    }
};

// Define CLI
const availableSortOrders = Object.keys(pluginComparators);
Program
    .version('0.4.0')
    .option('-u, --username <username>', 'The shopware username')
    .option('-s, --sort [value]', `The order in which the plugins will be sorted [${availableSortOrders[0]}] (${availableSortOrders.join('|')})`, availableSortOrders[0])
    .parse(process.argv);

// Load an .env config if available
require('../env_loader').loadConfig(Program);

// Validate arguments
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (!pluginComparators[Program.sort]) {
    console.error(Chalk.white.bgRed.bold(`'Sort' must be one of ${availableSortOrders.join(', ')}`));
    process.exit(1);
}

// Run program
const commander = new ShopwareStoreCommander(Program.username, Program.password);
commander.loadAccountData().then(data => {
    // Sort plugins according to the passed sort order
    const comparator = pluginComparators[Program.sort];
    const sortedPlugins = Object.keys(data.plugins).map(pluginName => {
        return data.plugins[pluginName];
    }).sort(comparator);

    // Print plugin list
    console.log('\nYour plugins:');
    const pluginTable = new Table({
        head: ['Name', 'Version', 'Date', 'Active', 'Review status']
    });
    sortedPlugins.forEach(plugin => {
        const version = (plugin.latestBinary) ? plugin.latestBinary.version : '0.0.0';
        const active = (plugin.activationStatus.id === 1) ? '\u{2713}' : '\u{274C}';
        const reviewStatus = (plugin.latestBinary) ? plugin.latestBinary.status.description : 'none';
        pluginTable.push([plugin.name, version, active, reviewStatus]);
    });
    console.log(pluginTable.toString());
}).catch(err => {
    console.error(Chalk.white.bgRed.bold(`\u{1F6AB} Error: ${err.message}`));
    console.error(err);
    process.exit(-1);
});
