#!/usr/bin/env node
'use strict';

var Chalk = require('chalk');
var fs = require('mz/fs');
var path = require('path');
var Program = require('commander');
var semver = require('semver');
var ShopwareStoreCommander = require('../shopware_store_commander');
var PluginJSONReader = require('../plugin_json_reader');


// Define CLI
Program
    .version('0.0.1')
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('--release', 'Set this option to directly release the uploaded binary, by requesting a review.')
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


// Run program
var filePath = path.resolve(process.cwd(), Program.args[0]);
var commander = new ShopwareStoreCommander(Program.username);
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
            console.log(Chalk.yellow.bold(e.message));
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
        console.log(Chalk.yellow.bold('Warning: The plugin\'s compatibility constraints don\'t match any available shopware versions!'));
    }

    return commander.savePluginBinary(plugin, plugin.latestBinary);
}).then(plugin => {
    console.log(Chalk.green.bold(`New version ${plugin.latestBinary.version} of plugin ${plugin.name} uploaded!`));
    if (!Program.release) {
        console.log(Chalk.yellow.bold(`Don't forget to release the version by requesting a review (e.g. 'scs-commander release -v ${Program.username} -p ${plugin.name} -b ${plugin.latestBinary.version}')`));
        process.exit(0);
    }

    // Request a review for the uploaded binary
    return commander.requestBinaryReview(plugin);
}).then(plugin => {
    // Check review status
    var review = plugin.reviews[plugin.reviews.length - 1];
    if (review.status.name === 'approved') {
        console.log(Chalk.green.bold(`Review succeeded! Version ${plugin.latestBinary.version} of plugin ${plugin.name} is now available in the store.`));
    } else {
        console.error(Chalk.white.bgRed.bold(`The review finished with status '${review.status.name}':\n\n${review.comment}`));
    }
}).catch(err => {
    console.error(Chalk.white.bgRed.bold(`Error: ${err.message}`));
    console.error(err);
    process.exit(-1);
});
