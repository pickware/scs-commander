

const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

const defaultMappings = {
  username: 'SCS_USERNAME',
  password: 'SCS_PASSWORD',
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
      silent: true,
    });

        // Check for a 'username' passed as an argument to the program, because we don't
        // want to set the password from the .env file, if a different username was passed
    const originalUsername = program.username;

        // Copy env values to the program, but don't overwrite passed arguments
    const mappings = argumentMappings || defaultMappings;
    Object.keys(mappings).forEach((argKey) => {
      const envKey = mappings[argKey];
      if (envKey in process.env && !(argKey in program)) {
        program[argKey] = process.env[envKey];
      }
    });

        // Reset the password set in the porogram, if the passed username and the one
        // now in the program don't match. This allows to overwrite the account to be
        // used, even if all account data is set in the .env file.
    if (originalUsername && originalUsername.length > 0 && process.env[defaultMappings.username] !== originalUsername) {
      delete program.password;
    }
  },

};
