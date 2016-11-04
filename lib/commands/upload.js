#!/usr/bin/env node
'use strict';

var Chalk = require('chalk');
var fs = require('mz/fs');
var path = require('path');
var Program = require('commander');
var semver = require('semver');
var ShopwareStoreCommander = require('../shopware_store_commander');
var PluginJSONReader = require('../plugin_json_reader');
var PluginChangelogParser = require('../plugin_changelog_parser');
var util = require('../util');


// Define CLI
Program
    .version('0.3.1')
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('--release', 'Set this option to directly release the uploaded binary, by requesting a review.')
    .parse(process.argv);


// Load an .env config if available
require('../env_loader').loadConfig(Program);

// Validate arguments
if (Program.args.length < 1) {
    console.error(Chalk.white.bgRed.bold('No file given!'));
    process.exit(1);
}
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}


// Run program
var filePath = path.resolve(process.cwd(), Program.args[0]);
var commander = new ShopwareStoreCommander(Program.username, Program.password);
fs.exists(filePath).then(exists => {
    if (!exists) {
        throw new Error(`File ${filePath} does not exist`);
    }

    // Read the plugin.json of the provided zip file
    var reader = new PluginJSONReader();
    return reader.readZip(filePath);
}).then(pluginInfo => {
    if (!pluginInfo) {
        throw new Error('Cannot upload plugin binary, because it is missing a plugin.json file.');
    }

    // Try to parse the plugin's changelog file
    var parser = new PluginChangelogParser();
    return parser.readZip(filePath).then(pluginChangeLog => {
        if (pluginChangeLog) {
            // Add the parsed changelog to the plugin info
            console.log(`Use changlog from 'CHANGELOG.md'`);
            pluginInfo.info.changelogs = pluginChangeLog;
        }

        return pluginInfo;
    });
}).then(pluginInfo => {
    // Try to find the plugin
    return commander.findPlugin(pluginInfo.getName(), ['binaries', 'reviews']).then(plugin => {
        return [plugin, pluginInfo];
    })
}).then(args => {
    var plugin = args[0],
        pluginInfo = args[1];
	// Make sure that the version of the passed binary does not exist yet
    var conflictingBinary = plugin.binaries.find(binary => {
        return semver.eq(binary.version, pluginInfo.getCurrentVersion());
    });
    if (conflictingBinary) {
        throw new Error(`The binary version ${conflictingBinary.version} you're trying to upload already exists for plugin ${plugin.name}`);
    }

    // Upload the binary
    return commander.uploadPluginBinary(plugin, filePath).then(plugin => {
        return [plugin, pluginInfo];
    });
}).then(args => {
    var plugin = args[0],
        pluginInfo = args[1];
    // Update the updloaded binary using the plugin info
    console.log(`Set version to ${pluginInfo.getCurrentVersion()}`);
    plugin.latestBinary.version = pluginInfo.getCurrentVersion();
    plugin.latestBinary.changelogs.forEach(changelog => {
        var lang = changelog.locale.name.split('_').shift();
        try {
            changelog.text = pluginInfo.getChangelog(lang);
            console.log(`Set changelog for language '${lang}'`);
        } catch (e) {
            console.log(Chalk.yellow.bold('\u{26A0} ' + e.message));
        }
    });
    var shopwareVersions = commander.statics.softwareVersions;
    plugin.latestBinary.compatibleSoftwareVersions = shopwareVersions.filter(version => {
        return version.selectable && pluginInfo.isCompatible(version.name);
    });
    var compatibleVersionStrings = plugin.latestBinary.compatibleSoftwareVersions.map(version => {
        return version.name;
    });
    if (compatibleVersionStrings.length > 0) {
        console.log(`Set shopware version compatiblity: ${compatibleVersionStrings.join(', ')}`);
    } else {
        console.log(Chalk.yellow.bold('\u{26A0} Warning: The plugin\'s compatibility constraints don\'t match any available shopware versions!'));
    }

    return commander.savePluginBinary(plugin, plugin.latestBinary);
}).then(plugin => {
    var uploadSuccessMessage = `New version ${plugin.latestBinary.version} of plugin ${plugin.name} uploaded! \u{2705}`;
    console.log(Chalk.green.bold(uploadSuccessMessage));
    if (!Program.release) {
        util.showGrowlIfEnabled(uploadSuccessMessage);
        console.log(Chalk.yellow.bold(`Don't forget to manually release the version by requesting a review (try passing '--release' next time \u{1F609} )`));
        process.exit(0);
    }

    // Request a review for the uploaded binary
    return commander.requestBinaryReview(plugin);
}).then(plugin => {
    // Check review status
    var review = plugin.reviews[plugin.reviews.length - 1];
    if (review.status.name !== 'approved') {
        throw new Error(`The review of ${plugin.name} v${plugin.latestBinary.version} finished with status '${review.status.name}':\n\n${review.comment}`);
    }

    var successMessage = `Review succeeded! Version ${plugin.latestBinary.version} of plugin ${plugin.name} is now available in the store. \u{1F389}`;
    util.showGrowlIfEnabled(successMessage);
    console.log(Chalk.green.bold(successMessage));
}).catch(err => {
    var errorMessage = `\u{1F6AB} Error: ${err.message}`;
    util.showGrowlIfEnabled(errorMessage);
    console.error(Chalk.white.bgRed.bold(errorMessage));
    console.error(err);
    process.exit(-1);
});
