#!/usr/bin/env node


const Chalk = require('chalk');
const Program = require('commander');
const semver = require('semver');
const Table = require('cli-table');

const ShopwareStoreCommander = require('../shopware_store_commander');
const programVersion = require('../version');

const spinner = require('../cli_status_indicator');

// Load an .env config if available
require('../env_loader').loadConfig(Program);

const getPassword = require('../password_promt');


const getShopwareCompatibility = (plugin) => {
    if (!plugin.latestBinary || plugin.latestBinary.compatibleSoftwareVersions.length === 0) {
        return null;
    }

    return plugin.latestBinary.compatibleSoftwareVersions
        .map(shopwareVersion => shopwareVersion.name)
        .sort(semver.compare).shift();
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
    shopwareCompatibility: (a, b) => {
        const vA = getShopwareCompatibility(a) || '10000.0.0';
        const vB = getShopwareCompatibility(b) || '10000.0.0';

        return semver.compare(vA, vB);
    },
};

// Define CLI
const availableSortOrders = Object.keys(pluginComparators);
Program
    .version(programVersion)
    .option('-u, --username <username>', 'The shopware username')
    .option('-s, --sort [value]',
        `The order in which the plugins will be sorted [${availableSortOrders[0]}] (${availableSortOrders.join('|')})`,
        availableSortOrders[0]
    )
    .option('--show-all', 'Set this option to list all plugins (inlc. disabled plugins)')
    .parse(process.argv);


// Validate arguments
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (!pluginComparators[Program.sort]) {
    console.error(Chalk.white.bgRed.bold(`'Sort' must be one of ${availableSortOrders.join(', ')}`));
    process.exit(1);
}

getPassword(Program).then((password) => {
    // Run program
    const commander = new ShopwareStoreCommander(Program.username, password, console);
    spinner(commander.client.emitter);

    return commander.loadAccountData();
})
.then((data) => {
    let plugins = Object.keys(data.plugins).map(pluginName => data.plugins[pluginName]);
    if (!Program.showAll) {
        // Filter out all disabled plugins
        plugins = plugins.filter(plugin => plugin.activationStatus.id === 1);
    }

    // Sort plugins according to the passed sort order
    const comparator = pluginComparators[Program.sort];
    const sortedPlugins = plugins.sort(comparator);

    // Print plugin list
    console.log('\nYour plugins:');
    const pluginTable = new Table({
        head: ['Name', 'Version', 'Date', 'Active', 'Review status', 'Min. Shopware compatibility'],
    });
    sortedPlugins.forEach((plugin) => {
        const version = (plugin.latestBinary) ? plugin.latestBinary.version : '0.0.0';
        const date = (plugin.latestBinary) ? plugin.latestBinary.lastChangeDate : '';
        const active = (plugin.activationStatus.id === 1) ? '\u{2713}' : '\u{274C}';
        const reviewStatus = (plugin.latestBinary) ? plugin.latestBinary.status.description : 'none';
        const shopwareCompatibility = getShopwareCompatibility(plugin) || 'none';
        pluginTable.push([plugin.name, version, date, active, reviewStatus, shopwareCompatibility]);
    });
    console.log(pluginTable.toString());
})
.catch((err) => {
    console.error(Chalk.white.bgRed.bold(`\u{1F6AB} Error: ${err.message}`));
    console.error(err);
    process.exit(-1);
});
