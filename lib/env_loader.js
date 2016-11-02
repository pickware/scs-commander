'use strict';

var os = require('os');
var path = require('path');
var dotenv = require('dotenv');

var defaultMappings = {
    username: 'SCS_USERNAME',
    password: 'SCS_PASSWORD'
};

module.exports = {

    /**
     * @param {Object} program
     * @param {Object} argumentMappings - optional
     */
    loadConfig(program, argumentMappings) {
        // Try to load the config from the user home
        dotenv.config({
            path: path.resolve(os.homedir(), '.scs-commander'),
            silent: true
        });

        // Copy env values to the program, but don't overwrite passed arguments
        var mappings = argumentMappings || defaultMappings;
        Object.keys(mappings).forEach(argKey => {
            var envKey = mappings[argKey];
            if (envKey in process.env && !(argKey in program)) {
                program[argKey] = process.env[envKey];
            }
        });
    }

}
