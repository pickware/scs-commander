const Chalk = require('chalk');
const ShopwareStoreClient = require('./shopware_store_client');

module.exports = class ShopwareStoreCommander {

  /**
   * @constructor
   * @param {String} username
   * @param {String} password - optional
   */
    constructor(username, password) {
        this.client = new ShopwareStoreClient(username, password);
        this.accountData = {};
        this.statics = {};
    }

  /**
   * @return {Promise}
   */
    loadAccountData() {
        return this.client.GET('producers').then((res) => {
      // Save producer ID (required to load e.g. plugins)
            this.accountData = {
                producerId: res.body[0].id,
            };

            return this.client.GET('plugins', {
                offset: 0,
                limit: 1000,
                producerId: this.accountData.producerId,
            });
        }).then((res) => {
      // Save plugins
            this.accountData.plugins = {};
            res.body.forEach((plugin) => {
                this.accountData.plugins[plugin.name] = plugin;
            });

            return this.client.GET('pluginstatics/all');
        }).then((res) => {
            this.statics = res.body;

            return this.accountData;
        });
    }

  /**
   * @param {String} pluginName
   * @param {Object} extraFields - optional
   * @return {Promise}
   */
    findPlugin(pluginName, extraFields) {
        const initialPromise = (!this.accountData.plugins) ? this.loadAccountData() : Promise.resolve(this.accountData);
        return initialPromise.then((data) => {
            if (!data.plugins[pluginName]) {
                console.error(Chalk.white.bgRed.bold(`Plugin ${pluginName} not found!`));
                process.exit(1);
            }
            if (extraFields && extraFields.length > 0) {
                return this.loadExtraPluginFields(data.plugins[pluginName], extraFields);
            }

            return data.plugins[pluginName];
        });
    }

  /**
   * @param {Object} plugin
   * @return {Promise}
   */
    savePlugin(plugin) {
        console.log(`Saving changes in plugin ${plugin.name}...`);
        return this.client.PUT(`plugins/${plugin.id}`, plugin).then((res) => {
      // Save the updated data locally
            this.accountData.plugins[plugin.name] = res.body;

            return this.accountData.plugins[plugin.name];
        });
    }

  /**
   * @param {Object} plugin
   * @param {String} filePath
   * @return {Promise}
   */
    uploadPluginBinary(plugin, filePath) {
        const binaryName = filePath.split(/(\\|\/)/g).pop();
        console.log(`Uploading binary ${binaryName} for plugin ${plugin.name}...`);
        return this.client.POST(`plugins/${plugin.id}/binaries`, {}, filePath).then((res) => {
      // Add the binary info to the plugin
            plugin.binaries = res.body;
            plugin.latestBinary = plugin.binaries[plugin.binaries.length - 1];

            return plugin;
        });
    }

  /**
   * @param {Object} plugin
   * @param {Object} binary
   * @param {String} filePath
   * @return {Promise}
   */
    updatePluginBinary(plugin, binary, filePath) {
        const binaryName = filePath.split(/(\\|\/)/g).pop();
        console.log(`Uploading updated binary ${binaryName} for plugin ${plugin.name}...`);
        return this.client.POST(`plugins/${plugin.id}/binaries/${binary.id}/file`, {}, filePath).then((res) => {
      // Add the binary info to the plugin
            plugin.binaries = res.body;
            plugin.latestBinary = plugin.binaries[plugin.binaries.length - 1];

            return plugin;
        });
    }

  /**
   * @param {Object} plugin
   * @param {Object} binary
   * @return {Promise}
   */
    savePluginBinary(plugin, binary) {
        console.log(`Saving binary version ${binary.version} of plugin ${plugin.name}...`);
        return this.client.PUT(`plugins/${plugin.id}/binaries/${binary.id}`, binary).then((res) => {
      // Save the updated data locally
            binary.changelogs = res.body.changelogs;
            binary.compatibleSoftwareVersions = res.body.compatibleSoftwareVersions;
            binary.status = res.body.status;

            return plugin;
        });
    }

  /**
   * @param {Object} plugin
   * @return {Promise}
   */
    requestBinaryReview(plugin) {
    // Create a function for polling the review status every 3 seconds until review is finished
        let pollCount = 0;
        const pollReviewStatus = (review) => {
            console.log('Waiting for review to finish...');
            return new Promise((resolve) => {
                setTimeout(resolve, 3000);
            }).then(() => {
        // Get review status
                pollCount += 1;
                return this.client.GET(`plugins/${plugin.id}/reviews`).then((res) => {
          // Update polled review
                    const updatedReview = res.body.find(rev => rev.id === review.id);
                    review.status = updatedReview.status;
                    review.comment = updatedReview.comment;

                    if (review.status.id !== 1) {
            // Review finished
                        return review;
                    } else if (pollCount === 20) {
            // Max polls reached
                        throw new Error(
              'Reviews is taking longer than expected. Please check the review status online at ' +
              'https:://account.shopware.de/'
            );
                    }

          // Poll review again
                    return pollReviewStatus(review);
                });
            });
        };

        console.log(`Requesting review of plugin ${plugin.name}...`);
        return this.client.POST(`plugins/${plugin.id}/reviews`, {}).then((res) => {
      // Save the review
            const review = res.body;
            plugin.reviews.push(review);

      // Wait for the review to finish
            return pollReviewStatus(review).then(() => plugin);
        });
    }

  /**
   * @param {Object} plugin
   * @param {Array} fields
   * @return {Promise}
   */
    loadExtraPluginFields(plugin, fields) {
    // Load all extra fields
        const extraFieldPromises = fields.map(field => this.client.GET(plugin[field]).then((res) => {
            plugin[field] = res.body;
        }));

        return Promise.all(extraFieldPromises).then(() => plugin);
    }

};
