#!/usr/bin/env node


const Chalk = require('chalk');
const fs = require('mz/fs');
const path = require('path');
const Program = require('commander');
const semver = require('semver');

const ShopwareStoreCommander = require('../shopware_store_commander');
const PluginJSONReader = require('../plugin_json_reader');
const PluginChangelogParser = require('../plugin_changelog_parser');
const publishPluginReleaseEvent = require('../publish_plugin_release_event');
const util = require('../util');
const programVersion = require('../version');


// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-R, --no_release', 'Set this option to not submit the uploaded binary for review.')
    .option('-f, --force', 'Replace plugin version if it exists')
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
const filePath = path.resolve(process.cwd(), Program.args[0]);
const commander = new ShopwareStoreCommander(Program.username, Program.password);
fs.exists(filePath)
    .then((exists) => {
        if (!exists) {
            throw new Error(`File ${filePath} does not exist`);
        }

        // Read the plugin.json of the provided zip file
        const reader = new PluginJSONReader();
        return reader.readZip(filePath);
    })
    .then((pluginInfo) => {
        if (!pluginInfo) {
            throw new Error('Cannot upload plugin binary, because it is missing a plugin.json file.');
        }

        // Try to parse the plugin's changelog file
        const parser = new PluginChangelogParser(true);
        return parser.readZip(filePath)
            .then(pluginChangeLog => ({pluginInfo, pluginChangeLog}));
    })
    .then(({pluginInfo, pluginChangeLog}) => {
        if (pluginChangeLog) {
            // Add the parsed changelog to the plugin info
            console.log('Using changlog from \'CHANGELOG.md\'...');
            pluginInfo.info.changelogs = pluginChangeLog;
        }

        // Try to find the plugin
        return commander.findPlugin(pluginInfo.getName(), ['binaries', 'reviews'])
            .then(plugin => ({plugin, pluginInfo}));
    })
    .then(({plugin, pluginInfo}) => {
        // Enable partial ionCube encryption (only applies, if the plugin will be encrypted)
        return commander.enablePartialIonCubeEncryption(plugin)
            .then(updatedPlugin => ({plugin: updatedPlugin, pluginInfo}));
    })
    .then(({plugin, pluginInfo}) => {
        // Make sure that the version of the passed binary does not exist yet
        const conflictingBinary = plugin.binaries.find(
            binary => semver.eq(binary.version, pluginInfo.getCurrentVersion())
        );
        if (conflictingBinary) {
            if (Program.force) {
                return commander.updatePluginBinary(plugin, conflictingBinary, filePath)
                    .then(updatedPlugin => ({plugin: updatedPlugin, pluginInfo}));
            }

            throw new Error(`The binary version ${conflictingBinary.version} you're trying to upload already exists ` +
                `for plugin ${plugin.name}`);
        }

        // Upload the binary
        return commander.uploadPluginBinary(plugin, filePath)
            .then(updatedPlugin => ({plugin: updatedPlugin, pluginInfo}));
    })
    .then(({plugin, pluginInfo}) => {
        // Update the updloaded binary using the plugin info
        console.log(`Set version to ${pluginInfo.getCurrentVersion()}`);
        plugin.latestBinary.version = pluginInfo.getCurrentVersion();
        plugin.latestBinary.changelogs.forEach((changelog) => {
            const lang = changelog.locale.name.split('_').shift();
            try {
                changelog.text = pluginInfo.getChangelog(lang);
                console.log(`Set changelog for language '${lang}'`);
            } catch (e) {
                console.log(Chalk.yellow.bold(`\u{26A0} ${e.message}`));
            }
        });
        const shopwareVersions = commander.statics.softwareVersions;
        plugin.latestBinary.compatibleSoftwareVersions = shopwareVersions.filter(
            version => version.selectable && pluginInfo.isCompatible(version.name)
        );
        const compatibleVersionStrings = plugin.latestBinary.compatibleSoftwareVersions.map(version => version.name);
        if (compatibleVersionStrings.length > 0) {
            console.log(`Set shopware version compatiblity: ${compatibleVersionStrings.join(', ')}`);
        } else {
            console.log(
                Chalk.yellow.bold(
                    '\u{26A0} Warning: The plugin\'s compatibility constraints don\'t match any available shopware ' +
                    'versions!'
                )
            );
        }

        return commander.savePluginBinary(plugin, plugin.latestBinary)
            .then(updatedPlugin => ({plugin: updatedPlugin, pluginInfo}));
    })
    .then(({plugin, pluginInfo}) => {
        const uploadSuccessMessage =
            `New version ${plugin.latestBinary.version} of plugin ${plugin.name} uploaded! \u{2705}`;
        console.log(Chalk.green.bold(uploadSuccessMessage));
        if (Program.no_release) {
            util.showGrowlIfEnabled(uploadSuccessMessage);
            console.log(Chalk.yellow.bold('Don\'t forget to manually release the version by requesting a review.'));
            process.exit(0);
        }

        // Request a review for the uploaded binary
        return commander.requestBinaryReview(plugin)
            .then(updatedPlugin => ({plugin: updatedPlugin, pluginInfo}));
    })
    .then(({plugin, pluginInfo}) => {
        // Check review status
        const review = plugin.reviews[plugin.reviews.length - 1];
        if (review.status.name !== 'approved') {
            throw new Error(
                `The review of ${plugin.name} v${plugin.latestBinary.version} finished with status ` +
                `'${review.status.name}':\n\n${review.comment}`
            );
        }

        const successMessage =
            `Review succeeded! Version ${plugin.latestBinary.version} of plugin ${plugin.name} is now available in ` +
            'the store. \u{1F389}';
        util.showGrowlIfEnabled(successMessage);
        console.log(Chalk.green.bold(successMessage));

        return pluginInfo;
    })
    .then(publishPluginReleaseEvent)
    .catch((err) => {
        const errorMessage = `\u{1F6AB} Error: ${err.message}`;
        util.showGrowlIfEnabled(errorMessage);
        console.error(Chalk.white.bgRed.bold(errorMessage));
        console.error(err);
        process.exit(-1);
    });
