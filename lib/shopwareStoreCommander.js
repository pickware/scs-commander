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
    async loadAccountData() {
        const producers = await this.client.get('producers');

        // Save producer ID (required to load e.g. plugins)
        this.accountData = {
            producerId: producers.data[0].id,
        };

        const plugins = await this.client.get('plugins', {
            params: {
                offset: 0,
                limit: 1000,
                producerId: this.accountData.producerId,
            },
        });

        // Save plugins
        this.accountData.plugins = {};
        plugins.data.forEach((plugin) => {
            this.accountData.plugins[plugin.name] = plugin;
        });

        // Load static definitions like error codes etc.
        const pluginStatistics = await this.client.get('pluginstatics/all');

        this.statics = pluginStatistics.data;

        return this.accountData;
    }

    /**
     * @param {String} pluginName
     * @param {Object} extraFields - optional
     * @return {Promise}
     */
    async findPlugin(pluginName, extraFields) {
        const accountData = await ((!this.accountData.plugins)
            ? this.loadAccountData()
            : (Promise.resolve(this.accountData)));

        if (!accountData.plugins[pluginName]) {
            this.logger('error', `Plugin ${pluginName} not found!`);
            process.exit(1);
        }
        if (extraFields && extraFields.length > 0) {
            return this.loadExtraPluginFields(accountData.plugins[pluginName], extraFields);
        }

        return accountData.plugins[pluginName];
    }

    /**
     * @param {Object} plugin
     * @return {Promise}
     */
    async savePlugin(plugin) {
        this.logger.emit('info', `Saving changes in plugin ${plugin.name}...`);

        const res = await this.client.put(`plugins/${plugin.id}`, plugin);
        // Save the updated data locally
        this.updatePluginData(this.accountData.plugins[plugin.name], res.data);

        return this.accountData.plugins[plugin.name];
    }

    /**
     * @param {Object} plugin
     * @param {String} filePath
     * @return {Promise}
     */
    async uploadPluginBinary(plugin, filePath) {
        const binaryName = filePath.split(/(\\|\/)/g).pop();
        this.logger.emit('info', `Uploading binary ${binaryName} for plugin ${plugin.name}...`);

        const res = await this.client.post(`plugins/${plugin.id}/binaries`, fs.createReadStream(filePath));
        // Add the binary info to the plugin
        plugin.binaries = res.data;
        plugin.latestBinary = plugin.binaries[plugin.binaries.length - 1];

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @param {Object} binary
     * @param {String} filePath
     * @return {Promise}
     */
    async updatePluginBinary(plugin, binary, filePath) {
        const binaryName = filePath.split(/(\\|\/)/g).pop();
        this.logger.emit('info', `Uploading updated binary ${binaryName} for plugin ${plugin.name}...`);

        const res = await this.client.post(`plugins/${plugin.id}/binaries/${binary.id}/file`,
            fs.createReadStream(filePath));

        // Add the binary info to the plugin
        plugin.binaries = res.data;
        plugin.latestBinary = plugin.binaries[plugin.binaries.length - 1];

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @param {Object} binary
     * @return {Promise}
     */
    async savePluginBinary(plugin, binary) {
        this.logger.emit('info', `Saving binary version ${binary.version} of plugin ${plugin.name}...`);

        const res = await this.client.put(`plugins/${plugin.id}/binaries/${binary.id}`, binary);
        // Save the updated data locally
        binary.changelogs = res.data.changelogs;
        binary.compatibleSoftwareVersions = res.data.compatibleSoftwareVersions;
        binary.status = res.data.status;

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @return {Promise}
     */
    async requestBinaryReview(plugin) {
        // Create a function for polling the review status every 3 seconds until review is finished
        let pollCount = 0;
        const pollReviewStatus = async (review) => {
            this.logger.emit('waitingReview');

            await new Promise((resolve) => {
                setTimeout(resolve, 3000);
            });
            // Get review status
            pollCount += 1;

            const reviews = await this.client.get(`plugins/${plugin.id}/reviews`);
            // Update polled review
            const updatedReview = reviews.data.find(rev => rev.id === review.id);
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
        };

        this.logger.emit('info', `Requesting review of plugin ${plugin.name}...`);

        const res = await this.client.post(`plugins/${plugin.id}/reviews`);
        // Save the review
        const review = res.data;
        plugin.reviews.push(review);

        // Wait for the review to finish
        await pollReviewStatus(review);

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @return {Promise}
     */
    async enablePartialIonCubeEncryption(plugin) {
        // Check the plugin for the 'encryptionIonCube' addon
        const encryptionAddon = plugin.addons.find(addon => addon.name === 'encryptionIonCube');
        if (!encryptionAddon) {
            // The plugin is not encrpyted, hence don't enable partial encrpytion either
            return plugin;
        }

        // Check the plugin for the 'partialIonCubeEncryptionAllowed' addon
        const partialEncryptionAddonName = 'partialIonCubeEncryptionAllowed';
        let partialEncryptionAddon = plugin.addons.find(addon => addon.name === partialEncryptionAddonName);
        if (partialEncryptionAddon) {
            this.logger.emit('info', `Partial ionCube encryption for plugin ${plugin.name} already enabled`);

            return plugin;
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

        const res = await this.client.put(`plugins/${plugin.id}`, plugin);
        // Save the updated data locally
        this.updatePluginData(this.accountData.plugins[plugin.name], res.data);

        return this.accountData.plugins[plugin.name];
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
