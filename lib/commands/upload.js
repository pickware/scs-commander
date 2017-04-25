#!/usr/bin/env node


const Chalk = require('chalk');
const fs = require('mz/fs');
const path = require('path');
const Program = require('commander');
const semver = require('semver');

const ShopwareStoreCommander = require('../shopwareStoreCommander');
const PluginJSONReader = require('../pluginJsonReader');
const PluginChangelogParser = require('../pluginChangelogParser');
const publishPluginReleaseEvent = require('../publishPluginReleaseEvent');
const util = require('../util');
const programVersion = require('../version');

const spinner = require('../cliStatusIndicator');

// Load an .env config if available
require('../envLoader').loadConfig(Program);

const getPassword = require('../passwordPrompt');


// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-R, --no_release', 'Set this option to not submit the uploaded binary for review.')
    .option('-f, --force', 'Replace plugin version if it exists')
    .parse(process.argv);

async function main() {
    // Validate arguments
    if (Program.args.length < 1) {
        console.error(Chalk.white.bgRed.bold('No file given!'));
        process.exit(1);
    }
    if (typeof Program.username === 'undefined') {
        console.error(Chalk.white.bgRed.bold('No username given!'));
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), Program.args[0]);
    try {
        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.username, password);
        spinner(commander.logEmitter);

        const exists = await fs.exists(filePath);

        if (!exists) {
            throw new Error(`File ${filePath} does not exist`);
        }

        // Read the plugin.json of the provided zip file
        const reader = new PluginJSONReader();

        const pluginInfo = await reader.readZip(filePath);

        if (!pluginInfo) {
            throw new Error('Cannot upload plugin binary, because it is missing a plugin.json file.');
        }

        // Try to parse the plugin's changelog file
        const parser = new PluginChangelogParser(true);

        const pluginChangeLog = await parser.readZip(filePath);

        if (pluginChangeLog) {
            // Add the parsed changelog to the plugin info
            console.log('Using changlog from \'CHANGELOG.md\'...');
            pluginInfo.info.changelogs = pluginChangeLog;
        }

        // Try to find the plugin
        let plugin = await commander.findPlugin(pluginInfo.getName(), ['binaries', 'reviews']);
        if (!plugin) {
            process.exit(1);
        }

        // Enable partial ionCube encryption (only applies, if the plugin will be encrypted)
        plugin = await commander.enablePartialIonCubeEncryption(plugin);

        // Make sure that the version of the passed binary does not exist yet
        const conflictingBinary = plugin.binaries.find(
            binary => semver.eq(binary.version, pluginInfo.getCurrentVersion())
        );
        if (conflictingBinary) {
            if (Program.force) {
                plugin = await commander.updatePluginBinary(plugin, conflictingBinary, filePath);
            } else {
                throw new Error(`The binary version ${conflictingBinary.version} you're trying to upload ` +
                    `already exists for plugin ${plugin.name}`);
            }
        } else {
            // Upload the binary
            plugin = await commander.uploadPluginBinary(plugin, filePath);
        }

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

        plugin = await commander.savePluginBinary(plugin, plugin.latestBinary);

        const uploadSuccessMessage =
            `New version ${plugin.latestBinary.version} of plugin ${plugin.name} uploaded! \u{2705}`;
        console.log(Chalk.green.bold(uploadSuccessMessage));
        if (Program.no_release) {
            util.showGrowlIfEnabled(uploadSuccessMessage);
            console.log(Chalk.yellow.bold('Don\'t forget to manually release the version by requesting a review.'));
            process.exit(0);
        }

        // Request a review for the uploaded binary
        plugin = await commander.requestBinaryReview(plugin);

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


        await publishPluginReleaseEvent(pluginInfo);
    } catch (err) {
        const errorMessage = `\u{1F6AB} Error: ${err.message}`;
        util.showGrowlIfEnabled(errorMessage);
        console.error(Chalk.white.bgRed.bold(errorMessage));
        console.error(err);
        process.exit(-1);
    }
}

main();
