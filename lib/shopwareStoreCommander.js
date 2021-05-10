const fs = require('fs');
const EventEmitter = require('events');
const { backOff } = require('exponential-backoff');
const FormData = require('form-data');
const concat = require('concat-stream');
const { promisify } = require('util');

const ShopwareAuthenticator = require('./client/shopwareAuthenticator');
const shopwareStoreClient = require('./client/shopwareStoreClient');

const sleep = promisify(setTimeout);

function getPostDataFromFile(filePath) {
    // eslint-disable-next-line promise/avoid-new
    return new Promise((resolve) => {
        const fd = new FormData();
        fd.append('file', fs.createReadStream(filePath));
        fd.pipe(concat({ encoding: 'buffer' }, data => resolve({
            data,
            headers: fd.getHeaders(),
        })));
    });
}

module.exports = class ShopwareStoreCommander {
    /**
     * @constructor
     * @param {String} username
     * @param {String} password
     * @param {EventEmitter} emitter - optional
     */
    constructor(username, password, emitter = new EventEmitter()) {
        this.logEmitter = emitter;
        this.accountData = null;
        this.statics = {};
        this.client = shopwareStoreClient(emitter);
        this.shopwareAuthenticator = new ShopwareAuthenticator(username, password, this.client);
        this.shopwareAuthenticator.registerAuthenticationInterceptors();
    }

    /**
     * @return {Object}
     */
    async getAccountData() {
        if (this.accountData) {
            return this.accountData;
        }

        if (!this.shopwareAuthenticator.userId) {
            await this.shopwareAuthenticator.login();
        }

        const producers = await this.client.get('producers', {
            params: {
                companyId: this.shopwareAuthenticator.userId,
            },
        });

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
        const pluginStatics = await this.client.get('pluginstatics/all');

        this.statics = pluginStatics.data;

        return this.accountData;
    }

    /**
     * @param {String} pluginName
     * @param {Object} extraFields - optional
     * @return {Object}
     */
    async findPlugin(pluginName, extraFields) {
        const accountData = await this.getAccountData();

        if (!accountData.plugins[pluginName]) {
            this.logEmitter.emit('error', `Plugin ${pluginName} not found!`);

            return null;
        }
        if (extraFields && extraFields.length > 0) {
            return this.loadExtraPluginFields(accountData.plugins[pluginName], extraFields);
        }

        return accountData.plugins[pluginName];
    }

    /**
     * @param {Object} plugin
     * @param {Object} [options]
     * @param {number} [options.retryCount] how often the save operation should be retried in case of failure
     * @return {Object}
     */
    async savePlugin(plugin, options) {
        this.logEmitter.emit('info', `Saving changes in plugin ${plugin.name}...`);

        const numOfAttempts = ((options && options.retryCount) || 0) + 1;
        const res = await backOff(
            () => this.client.put(`plugins/${plugin.id}`, plugin),
            { numOfAttempts },
        );
        // Save the updated data locally
        const accountData = await this.getAccountData();
        this.updatePluginData(accountData.plugins[plugin.name], res.data);

        return accountData.plugins[plugin.name];
    }

    /**
     * @param {Object} plugin
     * @param {String} filePath
     * @return {Object}
     */
    async uploadPluginBinary(plugin, filePath) {
        const binaryName = filePath.split(/(\\|\/)/g).pop();
        this.logEmitter.emit('info', `Uploading binary ${binaryName} for plugin ${plugin.name}...`);

        const { data, headers } = await getPostDataFromFile(filePath);
        const res = await this.client.post(`plugins/${plugin.id}/binaries`, data, { headers });

        // Add the binary info to the plugin
        plugin.binaries = res.data;
        plugin.latestBinary = plugin.binaries[plugin.binaries.length - 1];

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @param {Object} binary
     * @param {String} filePath
     * @return {Object}
     */
    async updatePluginBinary(plugin, binary, filePath) {
        const binaryName = filePath.split(/(\\|\/)/g).pop();
        this.logEmitter.emit('info', `Uploading updated binary ${binaryName} for plugin ${plugin.name}...`);

        const { data, headers } = await getPostDataFromFile(filePath);
        const res = await this.client.post(`plugins/${plugin.id}/binaries/${binary.id}/file`, data, { headers });

        // Add the binary info to the plugin
        plugin.binaries = res.data;
        plugin.latestBinary = plugin.binaries[plugin.binaries.length - 1];

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @param {Object} binary
     * @return {Object}
     */
    async savePluginBinary(plugin, binary) {
        this.logEmitter.emit('info', `Saving binary version ${binary.version} of plugin ${plugin.name}...`);

        const res = await this.client.put(`plugins/${plugin.id}/binaries/${binary.id}`, binary);
        // Save the updated data locally
        binary.changelogs = res.data.changelogs;
        binary.compatibleSoftwareVersions = res.data.compatibleSoftwareVersions;
        binary.status = res.data.status;

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @return {Object}
     */
    async requestBinaryReview(plugin) {
        this.logEmitter.emit('info', `Requesting review of plugin ${plugin.name}...`);

        // "Pending" status IDs:
        //     1: pending
        //     4: in review
        const isReviewPending = review => [1, 4].includes(review.status.id);

        const res = await this.client.post(`plugins/${plugin.id}/reviews`);
        // Save the review
        const review = res.data[0];
        plugin.reviews.push(review);

        // Wait for the review to finish
        let pollCount = 0;
        do {
            this.logEmitter.emit('waitingReview');

            // eslint-disable-next-line no-await-in-loop
            await sleep(3000);
            pollCount += 1;

            // Get review status
            // eslint-disable-next-line no-await-in-loop
            const reviews = await this.client.get(`plugins/${plugin.id}/reviews`);
            // Update polled review
            const updatedReview = reviews.data.find(rev => rev.id === review.id);
            review.status = updatedReview.status;
            review.comment = updatedReview.comment;
        } while (isReviewPending(review) && pollCount < 100);

        if (isReviewPending(review)) {
            // Max polls reached
            throw new Error(
                'Reviews is taking longer than expected. Please check the review status online at '
                + 'https://account.shopware.com/',
            );
        }

        return plugin;
    }

    /**
     * @param {Object} plugin
     * @return {Object}
     */
    async enablePartialIonCubeEncryption(plugin) {
        // Check the plugin for the 'encryptionIonCube' addon
        const encryptionAddon = plugin.addons.find(addon => addon.name === 'encryptionIonCube');
        if (!encryptionAddon) {
            // The plugin is not encrypted, hence don't enable partial encryption either
            return plugin;
        }

        // Check the plugin for the 'partialIonCubeEncryptionAllowed' addon
        const partialEncryptionAddonName = 'partialIonCubeEncryptionAllowed';
        let partialEncryptionAddon = plugin.addons.find(addon => addon.name === partialEncryptionAddonName);
        if (partialEncryptionAddon) {
            this.logEmitter.emit('info', `Partial ionCube encryption for plugin ${plugin.name} already enabled`);

            return plugin;
        }

        // Find and add the addon for partial ionCube encryption
        partialEncryptionAddon = this.statics.addons.find(addon => addon.name === partialEncryptionAddonName);
        if (!partialEncryptionAddon) {
            throw new Error(
                `Cannot enable partial ionCube encryption for plugin ${plugin.name} due to missing plugin addon option`,
            );
        }
        plugin.addons.push(partialEncryptionAddon);

        this.logEmitter.emit('info', `Enabling partial ionCube encryption for plugin ${plugin.name}...`);

        const res = await this.client.put(`plugins/${plugin.id}`, plugin);
        // Save the updated data locally
        const accountData = await this.getAccountData();
        this.updatePluginData(accountData.plugins[plugin.name], res.data);

        return accountData.plugins[plugin.name];
    }

    /**
     * @param {Object} plugin
     * @param {Array} fields
     * @return {Object}
     */
    async loadExtraPluginFields(plugin, fields) {
        plugin.scsLoadedExtraFields = plugin.scsLoadedExtraFields || [];
        // Load all extra fields
        const extraFieldPromises = fields.map(async (field) => {
            const res = await this.client.get(`plugins/${plugin.id}/${field}`);
            plugin[field] = res.data;
            // Mark the extra field as loaded
            if (plugin.scsLoadedExtraFields.indexOf(field) === -1) {
                plugin.scsLoadedExtraFields.push(field);
            }
        });
        await Promise.all(extraFieldPromises);

        return plugin;
    }

    /**
     * Apply the given data to the plugin, without overwriting any extra fields that were previously loaded and stored
     * in the plugin using 'loadExtraPluginFields()'.
     *
     * @param {Object} plugin
     * @param {Object} data
     */
    updatePluginData(plugin, data) {
        Object.keys(data).forEach((key) => {
            // Only overwrite the field, if it is not a loaded extra field
            if (plugin[key] && plugin.scsLoadedExtraFields && plugin.scsLoadedExtraFields.indexOf(key) === -1) {
                plugin[key] = data[key];
            }
        });
    }
};
