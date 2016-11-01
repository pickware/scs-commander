#!/usr/bin/env node
'use strict';

var Chalk = require('chalk');
var Program = require('commander');
var semver = require('semver');
var ShopwareStoreCommander = require('../shopware_store_commander');
var Table = require('cli-table');


// Define CLI
var availableSortOrders = ['name', 'version', 'active', 'reviewStatus'];
Program
    .version('0.2.0')
    .option('-u, --username <username>', 'The shopware username')
    .option('-s, --sort [value]', `The order in which the plugins will be sorted [${availableSortOrders[0]}] (${availableSortOrders.join('|')})`, availableSortOrders[0])
    .parse(process.argv);


// Validate arguments
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (availableSortOrders.indexOf(Program.sort) === -1) {
    console.error(Chalk.white.bgRed.bold(`'Sort' must be one of ${availableSortOrders.join(', ')}`));
    process.exit(1);
}


// Run program
var commander = new ShopwareStoreCommander(Program.username);
commander.loadAccountData().then(data => {
    // Sort plugins according to the passed sort order
    var sortFunc = (a, b) => {
        return a.name.localeCompare(b.name);
    };
    if (Program.sort === 'version') {
        sortFunc = (a, b) => {
            var vA = (a.latestBinary) ? a.latestBinary.version : '0.0.0';
            var vB = (b.latestBinary) ? b.latestBinary.version : '0.0.0';
            return semver.compare(vA, vB);
        };
    } else if (Program.sort === 'active') {
        sortFunc = (a, b) => {
            return a.activationStatus.name.localeCompare(b.activationStatus.name);
        };
    } else if (Program.sort === 'reviewStatus') {
        sortFunc = (a, b) => {
            var vA = (a.latestBinary) ? a.latestBinary.status.description : 'none';
            var vB = (b.latestBinary) ? b.latestBinary.status.description : 'none';
            return vA.localeCompare(vB);
        };
    }
    var sortedPlugins = Object.keys(data.plugins).map(pluginName => {
        return data.plugins[pluginName];
    }).sort(sortFunc);

    // Print plugin list
    console.log('\nYour plugins:');
    var pluginTable = new Table({
        head: ['Name', 'Version', 'Active', 'Review status']
    });
    sortedPlugins.forEach(plugin => {
        var version = (plugin.latestBinary) ? plugin.latestBinary.version : '0.0.0';
        var active = (plugin.activationStatus.id === 1) ? '\u2713' : '\u274c';
        var reviewStatus = (plugin.latestBinary) ? plugin.latestBinary.status.description : 'none';
        pluginTable.push([plugin.name, version, active, reviewStatus]);
    });
    console.log(pluginTable.toString());
}).catch(err => {
    console.error(Chalk.white.bgRed.bold(`Error: ${err.message}`));
    console.error(err);
    process.exit(-1);
});
