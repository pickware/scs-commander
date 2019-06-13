#!/usr/bin/env node

const Chalk = require('chalk');
const fs = require('mz/fs');
const co = require('co');
const { confirm } = require('co-prompt');
const jsdiff = require('diff');
const Program = require('commander');
const path = require('path');
const ShopwareStoreCommander = require('../shopwareStoreCommander');
const util = require('../util');
const programVersion = require('../version');
const spinner = require('../cliStatusIndicator');
const getPassword = require('../passwordPrompt');

// Define CLI
Program
    .version(programVersion)
    .arguments('<file>')
    .option('-u, --username <username>', 'The shopware username.')
    .option('-p, --plugin <plugin>', 'The name of the plugin, for which the description shall be updated.')
    .option('-l, --locale <locale>', 'The locale, for which the description shall be updated, e.g. de_DE, en_GB etc.')
    .option('--backup', 'Create a backup file for the old description text')
    .option('--patch', 'Show diff and interactively ask before updating')
    .option(
        '--max-update-retries <retry-count>',
        'How often to retry updating the description in case of failure',
        (givenValue) => {
            const parsedCount = parseInt(givenValue, 10);
            if (Number.isNaN(parsedCount) || parsedCount < 0) {
                throw new Error('retry-count for in --max-update-retries must be a non-negative integer');
            }

            return parsedCount;
        },
        0
    )
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
if (typeof Program.plugin === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No plugin name given!'));
    process.exit(1);
}
if (typeof Program.locale === 'undefined') {
    console.error(Chalk.white.bgRed.bold('No locale given!'));
    process.exit(1);
}

async function main() {
    try {
        const password = await getPassword(Program);
        const commander = new ShopwareStoreCommander(Program.username, password);
        spinner(commander.logEmitter);

        const filePath = path.resolve(process.cwd(), Program.args[0]);
        const exists = await fs.exists(filePath);
        if (!exists) {
            throw new Error(`File ${filePath} does not exist`);
        }

        let plugin = await commander.findPlugin(Program.plugin);
        if (!plugin) {
            process.exit(1);
        }

        // Try to find info for locale
        const info = plugin.infos.find(data => data.locale.name === Program.locale);
        if (!info) {
            console.error(Chalk.white.bgRed.bold(`Locale '${Program.locale}' is not available!`));
            console.error(`Available locales for plugin ${plugin.name}`);
            plugin.infos.forEach((data) => {
                console.error(`- ${data.locale.name}`);
            });
            process.exit(1);
        }

        // Create a backup file if requested
        let backupFilePath = filePath;
        if (Program.backup) {
            backupFilePath = `${backupFilePath}~`;
            await fs.writeFile(backupFilePath, info.description);
            console.error('Backup written to ', backupFilePath);
        }

        // Read the description file
        const description = await fs.readFile(filePath, 'utf-8');

        if (Program.patch) {
            if (info.description === description) {
                console.error('No changes');
            } else {
                // Write the diff to the output
                const unifiedDiff = jsdiff.createTwoFilesPatch(backupFilePath, filePath, info.description, description);
                console.log(unifiedDiff);

                // Ask for confirmation to update the description
                const confirmed = await co(function* () {
                    const result = yield confirm('Upload changes? (y/n) ');
                    // For some reason we have to explicitly pause stdin here (see: https://github.com/tj/co-prompt/issues/9)
                    process.stdin.pause();

                    return result;
                });
                if (!confirmed) {
                    console.error('Declined uploading changes.');
                    process.exit(1);
                }
            }
        }

        // Update plugin description
        info.description = description;

        // Save changes
        plugin = await commander.savePlugin(plugin, {
            retryCount: Program.maxUpdateRetries,
        });

        const successMessage = `Description of plugin ${plugin.name} for locale '${Program.locale}' successfully updated! \u{1F389}`;
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
