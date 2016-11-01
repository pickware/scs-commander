#!/usr/bin/env node
'use strict';

var Program = require('commander');


// Define CLI
Program
    .version('0.2.0')
    .command('description', 'Updates the plugin description of a supported locale.')
    .command('upload', 'Uploads a plugin zip file and makes it available for download.')
    .command('list', 'Lists all available plugins.', {isDefault: true})
    .parse(process.argv);
