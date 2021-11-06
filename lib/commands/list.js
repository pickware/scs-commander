#!/usr/bin/env node

const Chalk = require('chalk');
const Program = require('commander');
const semver = require('semver');
const Table = require('cli-table');
const ShopwareStoreCommander = require('../shopwareStoreCommander');
const programVersion = require('../version');
const spinner = require('../cliStatusIndicator');
const getPassword = require('../passwordPrompt');

const getShopwareCompatibility = (plugin, reverse) => {
    if (!plugin.latestBinary || plugin.latestBinary.compatibleSoftwareVersions.length === 0) {
        return null;
    }

    const sortedVersions = plugin.latestBinary.compatibleSoftwareVersions
        .map(shopwareVersion => shopwareVersion.name)
        .sort(semver.compare);

    return (reverse) ? sortedVersions.pop() : sortedVersions.shift();
};

const pluginComparators = {
    name: (a, b) => a.name.localeCompare(b.name),
    version: (a, b) => {
        const vA = (a.latestBinary) ? a.latestBinary.version : '0.0.0';
        const vB = (b.latestBinary) ? b.latestBinary.version : '0.0.0';

        return semver.compare(vA, vB);
    },
    active: (a, b) => a.activationStatus.name.localeCompare(b.activationStatus.name),
    reviewStatus: (a, b) => {
        const vA = (a.latestBinary) ? a.latestBinary.status.description : 'none';
        const vB = (b.latestBinary) ? b.latestBinary.status.description : 'none';

        return vA.localeCompare(vB);
    },
    releaseDate: (a, b) => {
        const dateA = a.latestBinary ? new Date(a.latestBinary.lastChangeDate) : new Date('1970-01-01T00:00:00Z');
        const dateB = b.latestBinary ? new Date(b.latestBinary.lastChangeDate) : new Date('1970-01-01T00:00:00Z');

        return dateB.getTime() - dateA.getTime();
    },
    minShopwareCompatibility: (a, b) => {
        const vA = getShopwareCompatibility(a, false) || '10000.0.0';
        const vB = getShopwareCompatibility(b, false) || '10000.0.0';

        return semver.compare(vA, vB);
    },
    maxShopwareCompatibility: (a, b) => {
        const vA = getShopwareCompatibility(a, true) || '10000.0.0';
        const vB = getShopwareCompatibility(b, true) || '10000.0.0';

        return semver.compare(vA, vB);
    },
};

// Define CLI
const availableSortOrders = Object.keys(pluginComparators);
Program
    .version(programVersion)
    .option('-u, --username <username>', 'The shopware username')
    .option('-s, --sort [value]', `The order in which the plugins will be sorted [${availableSortOrders[0]}] (${availableSortOrders.join('|')})`, 'name')
    .option('--show-all', 'Set this option to list all plugins (incl. disabled plugins)')
    .parse(process.argv);

// Load an .env config if available
require('../envLoader').loadConfig(Program);

// Validate arguments
if (typeof Program.opts().username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (!pluginComparators[Program.opts().sort]) {
    console.error(Chalk.white.bgRed.bold(`'Sort' must be one of ${availableSortOrders.join(', ')}`));
    process.exit(1);
}

async function main() {
    try {
        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.opts().username, password);
        spinner(commander.logEmitter);

        const data = await commander.getAccountData();
        await Promise.all(Object.keys(data.plugins).map(
            pluginName => commander.findPlugin(pluginName, ['reviews', 'binaries']).then((plugin) => {
                data.plugins[pluginName] = plugin;
                plugin.latestBinary = plugin.binaries.sort((lhs, rhs) => rhs.id - lhs.id)[0];

                return plugin;
            }),
        ));
        let plugins = Object.keys(data.plugins).map(pluginName => data.plugins[pluginName]);
        if (!Program.opts().showAll) {
            // Filter out all disabled plugins
            plugins = plugins.filter(plugin => plugin.activationStatus.id === 1);
        }

        // Sort plugins according to the passed sort order
        const comparator = pluginComparators[Program.opts().sort];
        const sortedPlugins = plugins.sort(comparator);

        // Print plugin list
        console.error('\nYour plugins:');
        const pluginTable = new Table({
            head: ['Name', 'Version', 'Date', 'Active', 'Review status', 'Min. SW version', 'Max. SW version'],
        });
        sortedPlugins.forEach((plugin) => {
            const version = (plugin.latestBinary) ? plugin.latestBinary.version : '0.0.0';
            const date = (plugin.latestBinary) ? plugin.latestBinary.lastChangeDate : '';
            const active = (plugin.activationStatus.id === 1) ? '\u{2713}' : '\u{274C}';
            const reviewStatus = (plugin.latestBinary) ? plugin.latestBinary.status.description : 'none';
            const minShopwareCompatibility = getShopwareCompatibility(plugin, false) || 'none';
            const maxShopwareCompatibility = getShopwareCompatibility(plugin, true) || 'none';
            pluginTable.push([
                plugin.name,
                version,
                date,
                active,
                reviewStatus,
                minShopwareCompatibility,
                maxShopwareCompatibility,
            ]);
        });
        console.log(pluginTable.toString());
    } catch (err) {
        console.error(Chalk.white.bgRed.bold(`\u{1F6AB} Error: ${err.message}`));
        console.error(err);
        process.exit(-1);
    }
}

main();
