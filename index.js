#!/usr/bin/env node


const Program = require('commander');

const version = require('./lib/version');

// Define CLI
Program
    .version(version)
    .command('description', 'Updates the plugin description of a supported locale.')
    .command('upload', 'Uploads a plugin zip file and makes it available for download.')
    .command('list', 'Lists all available plugins.', { isDefault: true })
    .parse(process.argv);
