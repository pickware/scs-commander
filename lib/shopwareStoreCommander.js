const fs = require('fs');
const EventEmitter = require('events');
const shopwareStoreClient = require('./client/shopwareStoreClient');

module.exports = class ShopwareStoreCommander {

    /**
     * @constructor
     * @param {String} username
     * @param {String} password
     * @param {EventEmitter} logger - optional
     */
    constructor(username, password, logger = new EventEmitter()) {
        this.client = shopwareStoreClient(username, password, logger);
        this.logger = logger;
        this.accountData = {};
        this.statics = {};
    }

    /**
     * @return {Promise}
     */
    loadAccountData() {
        return this.client.get('producers').then((res) => {
            // Save producer ID (required to load e.g. plugins)
            this.accountData = {
                producerId: res.data[0].id,
            };

            return this.client.get('plugins', {
                params: {
                    offset: 0,
                    limit: 1000,
                    producerId: this.accountData.producerId,
                },
            });
        }).then((res) => {
            // Save plugins
            this.accountData.plugins = {};
            res.data.forEach((plugin) => {
                this.accountData.plugins[plugin.name] = plugin;
            });

            // Load static definitions like error codes etc.
            return this.client.get('pluginstatics/all');
        }).then((res) => {
            this.statics = res.data;

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
                this.logger('error', `Plugin ${pluginName} not found!`);
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
        this.logger.emit('info', `Saving changes in plugin ${plugin.name}...`);

        return this.client.put(`plugins/${plugin.id}`, plugin).then((res) => {
            // Save the updated data locally
            this.updatePluginData(this.accountData.plugins[plugin.name], res.data);

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
        this.logger.emit('info', `Uploading binary ${binaryName} for plugin ${plugin.name}...`);

        return this.client.post(`plugins/${plugin.id}/binaries`, fs.createReadStream(filePath)).then((res) => {
            // Add the binary info to the plugin
            plugin.binaries = res.data;
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
        this.logger.emit('info', `Uploading updated binary ${binaryName} for plugin ${plugin.name}...`);

        return this.client.post(`plugins/${plugin.id}/binaries/${binary.id}/file`, fs.createReadStream(filePath))
            .then((res) => {
                // Add the binary info to the plugin
                plugin.binaries = res.data;
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
        this.logger.emit('info', `Saving binary version ${binary.version} of plugin ${plugin.name}...`);

        return this.client.put(`plugins/${plugin.id}/binaries/${binary.id}`, binary).then((res) => {
            // Save the updated data locally
            binary.changelogs = res.data.changelogs;
            binary.compatibleSoftwareVersions = res.data.compatibleSoftwareVersions;
            binary.status = res.data.status;

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
            this.client.spinner.setSpinnerTitle('Waiting for review to finish...');
            this.client.startCLISpinner();

            return new Promise((resolve) => {
                setTimeout(resolve, 3000);
            }).then(() => {
                // Get review status
                pollCount += 1;

                return this.client.get(`plugins/${plugin.id}/reviews`).then((res) => {
                    // Update polled review
                    const updatedReview = res.data.find(rev => rev.id === review.id);
                    review.status = updatedReview.status;
                    review.comment = updatedReview.comment;

                    if (review.status.id !== 1) {
                        // Review finished
                        return review;
                    } else if (pollCount === 20) {
                        // Max polls reached
                        throw new Error(
                            'Reviews is taking longer than expected. Please check the review status online at ' +
                            'https://account.shopware.de/'
                        );
                    }

                    // Poll review again
                    return pollReviewStatus(review);
                });
            });
        };

        this.logger.emit('info', `Requesting review of plugin ${plugin.name}...`);

        return this.client.post(`plugins/${plugin.id}/reviews`).then((res) => {
            // Save the review
            const review = res.data;
            plugin.reviews.push(review);

            // Wait for the review to finish
            return pollReviewStatus(review).then(() => {
                this.client.resetCLISpinner();

                return plugin;
            });
        });
    }

    /**
     * @param {Object} plugin
     * @return {Promise}
     */
    enablePartialIonCubeEncryption(plugin) {
        // Check the plugin for the 'encryptionIonCube' addon
        const encryptionAddon = plugin.addons.find(addon => addon.name === 'encryptionIonCube');
        if (!encryptionAddon) {
            // The plugin is not encrpyted, hence don't enable partial encrpytion either
            return new Promise(resolve => resolve(plugin));
        }

        // Check the plugin for the 'partialIonCubeEncryptionAllowed' addon
        const partialEncryptionAddonName = 'partialIonCubeEncryptionAllowed';
        let partialEncryptionAddon = plugin.addons.find(addon => addon.name === partialEncryptionAddonName);
        if (partialEncryptionAddon) {
            this.logger.emit('info', `Partial ionCube encryption for plugin ${plugin.name} already enabled`);

            return new Promise(resolve => resolve(plugin));
        }

        // Find and add the addon for partial ionCube encryption
        partialEncryptionAddon = this.statics.addons.find(addon => addon.name === partialEncryptionAddonName);
        if (!partialEncryptionAddon) {
            throw new Error(
                `Cannot enable partial ionCube encryption for plugin ${plugin.name} due to missing plugin addon option`
            );
        }
        plugin.addons.push(partialEncryptionAddon);

        this.logger.emit('info', `Enabling partial ionCube encryption for plugin ${plugin.name}...`);

        return this.client.put(`plugins/${plugin.id}`, plugin).then((res) => {
            // Save the updated data locally
            this.updatePluginData(this.accountData.plugins[plugin.name], res.data);

            return this.accountData.plugins[plugin.name];
        });
    }

    /**
     * @param {Object} plugin
     * @param {Array} fields
     * @return {Promise}
     */
    loadExtraPluginFields(plugin, fields) {
        plugin.scsLoadedExtraFields = plugin.scsLoadedExtraFields || [];
        // Load all extra fields
        const extraFieldPromises = fields.map(field => this.client.get(plugin[field]).then((res) => {
            plugin[field] = res.data;
            // Mark the extra field as loaded
            if (plugin.scsLoadedExtraFields.indexOf(field) === -1) {
                plugin.scsLoadedExtraFields.push(field);
            }
        }));

        return Promise.all(extraFieldPromises).then(() => plugin);
    }

    /**
     * Apply the given data to the plugin, without overwriting any extra fields that were
     * previously loaded and stored in the plugin using 'loadExtraPluginFields()'.
     *
     * @param {Object} plugin
     * @param {Object} data
     */
    updatePluginData(plugin, data) {
        Object.keys(data).forEach((key) => {
            // Only overwrite the field, if it is not a loaded extra field
            if (plugin[key] && plugin.scsLoadedExtraFields.indexOf(key) === -1) {
                plugin[key] = data[key];
            }
        });
    }

};
