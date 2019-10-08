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
const getPassword = require('../passwordPrompt');

function parseOnOffAutoOption(suppliedValue) {
    switch (suppliedValue) {
        case 'on':
            return true;
        case 'off':
            return false;
        case 'auto':
            return suppliedValue;
        default:
            console.error(Chalk.white.bgRed.bold(`Invalid value '${suppliedValue}' for option --license-check-required.`));
            process.exit(-1);

            return undefined;
    }
}

// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-R, --no-release', 'Set this option to not submit the uploaded binary for review.')
    .option(
        '--store-ioncube-encode <on|off|auto>',
        'Whether the Store should automatically ionCube-encode the released binary (default is \'auto\', which retains previous release\'s setting)',
        parseOnOffAutoOption,
        'auto',
    )
    .option(
        '--license-check-required <on|off|auto>',
        'Whether the Store should check for a \'checkLicense\' method in the released binary (default is \'auto\', which retains previous release\'s setting)',
        parseOnOffAutoOption,
        'auto',
    )
    .option('-f, --force', 'Replace plugin version if it exists')
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

async function main() {
    const filePath = path.resolve(process.cwd(), Program.args[0]);
    try {
        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.username, password);
        spinner(commander.logEmitter);

        // Make sure the zip file exists
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
        const pluginBinaryVersion = pluginInfo.getCurrentVersion();

        // Read the plugin's changelog file
        const parser = new PluginChangelogParser(true);
        const pluginChangelog = await parser.readZip(filePath);
        if (!(pluginBinaryVersion in pluginChangelog)) {
            throw new Error(`Changlog is missing entries for provided version ${pluginBinaryVersion}.`);
        }
        pluginInfo.addChangelog(pluginChangelog);

        // Try to find the plugin
        let plugin = await commander.findPlugin(pluginInfo.getName(), ['reviews']);
        if (!plugin) {
            process.exit(1);
        }

        // Enable partial ionCube encryption (only applies, if the plugin will be encrypted)
        plugin = await commander.enablePartialIonCubeEncryption(plugin);

        // Find the the currently latest binary
        const semVerPattern = /(\d+\.\d+\.\d+)([^\d]*)/;
        const releasedBinaries = plugin.binaries.filter(
            // Filter out binaries that are missing a version or whose review failed
            binary => binary.version.length > 0 && binary.status.name === 'codereviewsucceeded',
        ).map((binary) => {
            const newBinary = { ...binary };
            // Use only the three most significant version parts for comparison
            const matches = newBinary.version.match(semVerPattern);
            if (matches !== null) {
                newBinary.version = matches[1];
            }

            return newBinary;
        }).sort(
            // Sort by version (semver) and release date (from new to old)
            (lhs, rhs) => semver.rcompare(lhs.version, rhs.version) || (-1 * lhs.creationDate.localeCompare(rhs.creationDate)),
        );
        const latestReleasedBinary = (releasedBinaries.length > 0) ? releasedBinaries[0] : null;

        if (Program.storeIoncubeEncode === 'auto') {
            // Set the option based on the latest released binary, if possible
            if (latestReleasedBinary) {
                Program.storeIoncubeEncode = latestReleasedBinary.ionCubeEncrypted;
            } else {
                Program.storeIoncubeEncode = false;
                console.error(Chalk.yellow.bold('Warning: Cannot automatically determine value for option \'--store-ioncube-encode\', because no valid, released binary exists which it could have been derived from. Using \'false\' instead.'));
            }
        }
        if (Program.licenseCheckRequired === 'auto') {
            // Set the option based on the latest released binary, if possible
            if (latestReleasedBinary) {
                Program.licenseCheckRequired = latestReleasedBinary.licenseCheckRequired;
            } else {
                Program.licenseCheckRequired = false;
                console.error(Chalk.yellow.bold('Warning: Cannot automatically determine value for option \'--license-check-required\', because no valid, released binary exists which it could have been derived from. Using \'false\' instead.'));
            }
        }

        // Make sure that the version of the passed binary does not exist yet
        const conflictingBinary = plugin.binaries.find(
            binary => binary.version.length > 0 && binary.version === pluginBinaryVersion,
        );
        if (conflictingBinary) {
            if (Program.force) {
                plugin = await commander.updatePluginBinary(plugin, conflictingBinary, filePath);
            } else {
                throw new Error(`The binary version ${conflictingBinary.version} you're trying to upload already exists for plugin ${plugin.name}`);
            }
        } else {
            // Upload the binary
            plugin = await commander.uploadPluginBinary(plugin, filePath);
        }

        // Update the uploaded binary using the plugin info
        console.error(`Set version to ${pluginBinaryVersion}`);
        plugin.latestBinary.version = pluginBinaryVersion;
        plugin.latestBinary.changelogs.forEach((changelog) => {
            const lang = changelog.locale.name.split('_').shift();
            console.error(`Set changelog for language '${lang}'`);
            // Try to find a changelog
            let changelogText = '';
            try {
                changelogText = pluginInfo.getChangelog(lang);
            } catch (e) {
                console.error(Chalk.yellow.bold(`\u{26A0} ${e.message}`));
            }

            // Add 20 non-breaking whitespace characters to the changelog. This allows the changelog to pass Shopware's
            // server-side validation, which accepts only changelogs with at least 20 characters.
            for (let i = 0; i < 20; i += 1) {
                changelogText += '\u{0020}';
            }

            changelog.text = changelogText;
        });
        const shopwareVersions = commander.statics.softwareVersions;
        plugin.latestBinary.compatibleSoftwareVersions = shopwareVersions.filter(
            version => version.selectable && pluginInfo.isCompatible(version.name),
        );
        const compatibleVersionStrings = plugin.latestBinary.compatibleSoftwareVersions.map(version => version.name);
        if (compatibleVersionStrings.length > 0) {
            console.error(`Set shopware version compatibility: ${compatibleVersionStrings.join(', ')}`);
        } else {
            console.error(
                Chalk.yellow.bold('\u{26A0} Warning: The plugin\'s compatibility constraints don\'t match any available shopware versions!'),
            );
        }
        plugin.latestBinary.ionCubeEncrypted = Program.storeIoncubeEncode;
        plugin.latestBinary.licenseCheckRequired = Program.licenseCheckRequired;
        plugin = await commander.savePluginBinary(plugin, plugin.latestBinary);

        const uploadSuccessMessage = `New version ${plugin.latestBinary.version} of plugin ${plugin.name} uploaded! \u{2705}`;
        console.error(Chalk.green.bold(uploadSuccessMessage));
        if (!Program.release) {
            util.showGrowlIfEnabled(uploadSuccessMessage);
            console.error(Chalk.yellow.bold('Don\'t forget to manually release the version by requesting a review.'));
            process.exit(0);
        }

        // Request a review for the uploaded binary
        plugin = await commander.requestBinaryReview(plugin);

        // Check review status
        const review = plugin.reviews[plugin.reviews.length - 1];
        if (review.status.name !== 'approved') {
            throw new Error(`The review of ${plugin.name} v${plugin.latestBinary.version} finished with status '${review.status.name}':\n\n${review.comment}`);
        }

        const successMessage = `Review succeeded! Version ${plugin.latestBinary.version} of plugin ${plugin.name} is now available in the store. \u{1F389}`;
        util.showGrowlIfEnabled(successMessage);
        console.error(Chalk.green.bold(successMessage));

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
