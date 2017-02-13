'use strict';

const semver = require('semver');

module.exports = class PluginInfo {

    /**
     * @constructor
     * @param {String} name
     * @param {Object} info
     */
    constructor(name, info) {
        this.name = name;
        this.info = info;
    }

    /**
     * @return {String}
     */
    getName() {
        return this.name;
    }

    /**
     * @return {String}
     */
    getCurrentVersion() {
        return this.info.currentVersion;
    }

    /**
     * @return {String}
     */
    getAuthor() {
        return this.info.author;
    }

    /**
     * @return {String}
     */
    getCopyright() {
        return this.info.copyright;
    }

    /**
     * @return {String}
     */
    getLicense() {
        return this.info.license;
    }

    /**
     * @return {String}
     */
    getLink() {
        return this.info.link;
    }

    /**
     * @param {String} language - optional; default 'en'
     * @return {String}
     * @throws {Error}
     */
    getLabel(language) {
        const lang = language || 'en';
        if (!this.info.label[lang]) {
            throw new Error(`Label for language ${lang} not available`);
        };

        return this.info.label[lang];
    }

    /**
     * @return {String}
     */
    getCompatibility() {
        return this.info.compatibility;
    }

    /**
     * @param {String} version
     * @return {Boolean}
     */
    isCompatible(version) {
        const compatibility = this.getCompatibility(),
            minVersion = compatibility.minimumVersion || '0.0.0',
            maxVersion = compatibility.maximumVersion || '99.99.99',
            blacklist = compatibility.blacklist || [];

        return semver.gte(version, minVersion) && semver.lte(version, maxVersion) && blacklist.indexOf(version) === -1;
    }

    /**
     * @param {String} language - optional; default 'en'
     * @return {Array}
     * @throws {Error}
     */
    getChangelogs(language) {
        const lang = language || 'en';
        if (!this.info.changelogs[lang]) {
            throw new Error(`Changelog for language ${lang} not available`);
        }

        return this.info.changelogs[lang];
    }

    /**
     * @param {String} language - optional; default 'en'
     * @param {String} version - optional
     * @return {String}
     * @throws {Error}
     */
    getChangelog(language, version) {
        const changelogs = this.getChangelogs(language),
            useVersion = version || this.getCurrentVersion();
        if (!changelogs[useVersion]) {
            throw new Error(`Changelog for language ${language} and version ${useVersion} not available`);
        }

        return changelogs[useVersion];
    }

}
