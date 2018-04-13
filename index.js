#!/usr/bin/env node

const Program = require('commander');
const version = require('./lib/version');

// Define CLI
Program
    .version(version)
    .command('changelog', 'Echos a plugin zip file\'s changelog.')
    .command('compatibility', 'Updates the minimum Shopware version compatibility of all binaries of a plugin.')
    .command('description', 'Updates the plugin description of a supported locale.')
    .command('dump-plugin', 'Outputs all information for a specified plugin.')
    .command('upload', 'Uploads a plugin zip file and makes it available for download.')
    .command('list', 'Lists all available plugins.', { isDefault: true })
    .parse(process.argv);
