#!/usr/bin/env node

const Chalk = require('chalk');
const Program = require('commander');
const semver = require('semver');
const { promisify } = require('util');

const ShopwareStoreCommander = require('../shopwareStoreCommander');
const util = require('../util');
const programVersion = require('../version');
const spinner = require('../cliStatusIndicator');
const getPassword = require('../passwordPrompt');

const sleep = promisify(setTimeout);

// Define CLI
Program
    .version(programVersion)
    .option('-u, --username <username>', 'The shopware username.')
    .option('-p, --plugin <plugin>', 'The name of the plugin, whose Shopware version compatibility shall be updated.')
    .option('--min-version <min-version>', 'The minimum Shopware version compatibility, e.g. 5.1.3')
    .parse(process.argv);

// Load an .env config if available
require('../envLoader').loadConfig(Program);

// Validate arguments
if (typeof Program.username === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No username given!'));
    process.exit(1);
}
if (typeof Program.plugin === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No plugin name given!'));
    process.exit(1);
}
if (typeof Program.minVersion === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No minimum Shopware version given!'));
    process.exit(1);
}

async function main() {
    try {
        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.username, password);
        spinner(commander.logEmitter);

        // Try to find the plugin
        const plugin = await commander.findPlugin(Program.plugin);
        if (!plugin) {
            process.exit(1);
        }

        // Update the minimum Shopware version compatibility of all plugin binaries
        const shopwareVersions = commander.statics.softwareVersions;
        await util.sequentiallyAwaitEach(plugin.binaries, async (binary) => {
            // Determine the current minimum compatible version of the binary
            let minCompatibleVersion;
            if (binary.compatibleSoftwareVersions.length > 0) {
                binary.compatibleSoftwareVersions.sort(
                    (lhs, rhs) => semver.compare(lhs.name, rhs.name),
                );
                minCompatibleVersion = binary.compatibleSoftwareVersions[0].name;
            } else {
                minCompatibleVersion = shopwareVersions.filter(
                    version => version.selectable,
                ).shift().name;
            }

            if (semver.lt(Program.minVersion, minCompatibleVersion)) {
                // Add new version compatibility entries to lower the minimum compatibility
                console.log(`Lowering minimum compatible Shopware version of binary ${binary.version} to ${Program.minVersion}...`);
                binary.compatibleSoftwareVersions = binary.compatibleSoftwareVersions.concat(shopwareVersions.filter(
                    version => version.selectable
                        && semver.gte(version.name, Program.minVersion)
                        && semver.lt(version.name, minCompatibleVersion),
                ));
            } else if (semver.gt(Program.minVersion, minCompatibleVersion)) {
                // Remove some version compatibilities to raise the minimum compatibility
                console.log(`Raising minimum compatible Shopware version of binary ${binary.version} to ${Program.minVersion}...`);
                binary.compatibleSoftwareVersions = binary.compatibleSoftwareVersions.filter(
                    version => version.selectable && semver.gte(version.name, Program.minVersion),
                );
            } else {
                console.log(`Minimum compatible Shopware version of binary ${binary.version} already matches ${Program.minVersion}`);

                return undefined;
            }

            if (binary.compatibleSoftwareVersions.length === 0) {
                // Add at least the minimum compatible shopware version
                binary.compatibleSoftwareVersions = [
                    shopwareVersions.find(version => version.selectable && semver.eq(version.name, Program.minVersion)),
                ];
            }

            // Save changes after waiting for half a second
            await sleep(500);
            try {
                await commander.savePluginBinary(plugin, binary);
            } catch (err) {
                const message = `Failed to save binary ${binary.version}: ${err.message}`;
                console.error(Chalk.white.bgRed.bold(message));
            }

            return undefined;
        });

        const successMessage = `Minimum Shopware version compatibility of plugin ${plugin.name} changed to ${Program.minVersion}! \u{1F389}`;
        util.showGrowlIfEnabled(successMessage);
        console.error(Chalk.green.bold(successMessage));
    } catch (err) {
        const errorMessage = `\u{1F6AB} Error: ${err.message}`;
        util.showGrowlIfEnabled(errorMessage);
        console.error(Chalk.white.bgRed.bold(errorMessage));
        console.error(err);
        process.exit(-1);
    }
}

main();
