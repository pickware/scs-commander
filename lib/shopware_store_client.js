const Chalk = require('chalk');
const co = require('co');
const Prompt = require('co-prompt');
const Request = require('superagent');
const url = require('url');
const Spinner = require('cli-spinner').Spinner;

module.exports = class ShopwareStoreClient {

    /**
     * @constructor
     * @param {String} username
     * @param {String} password - optional
     */
    constructor(username, password) {
        this.baseURL = 'https://api.shopware.com/';
        this.username = username;
        this.password = password;
        // Prepare the loading spinner
        this.spinner = new Spinner();
        this.spinner.setSpinnerString(11);
    }

    /**
     * @param {String} path
     * @param {Object} queryParams - optional
     * @return {Promise}
     */
    GET(path, queryParams) {
        return this.getAccessToken().then((token) => {
            this.startCLISpinner();
            return Request
                .get(url.resolve(this.baseURL, path))
                .query(queryParams || {})
                .set('X-Shopware-Token', token);
        }).then(this.successHandler()).catch(this.errorHandler());
    }

    /**
     * @param {String} path
     * @param {Object} params
     * @param {String} filePath - optional
     * @return {Promise}
     */
    POST(path, params, filePath) {
        return this.getAccessToken().then((token) => {
            this.startCLISpinner();
            let req = Request
                .post(url.resolve(this.baseURL, path))
                .send(params)
                .set('X-Shopware-Token', token);
            if (filePath) {
                req = req.attach('file', filePath);
            }
            return req;
        }).then(this.successHandler()).catch(this.errorHandler());
    }

    /**
     * @param {String} path
     * @param {Object} params
     * @return {Promise}
     */
    PUT(path, params) {
        return this.getAccessToken().then((token) => {
            this.startCLISpinner();
            return Request
                .put(url.resolve(this.baseURL, path))
                .send(params)
                .set('X-Shopware-Token', token);
        }).then(this.successHandler()).catch(this.errorHandler());
    }

    /**
     * @param {String} path
     * @return {Promise}
     */
    DELETE(path) {
        return this.getAccessToken().then((token) => {
            this.startCLISpinner();
            return Request
                .delete(url.resolve(this.baseURL, path))
                .set('X-Shopware-Token', token);
        }).then(this.successHandler()).catch(this.errorHandler());
    }

    /**
     * @return {Promise}
     */
    getAccessToken() {
        if (this.token) {
            return Promise.resolve(this.token);
        }

        // Login to get an access token
        return this.login().then(() => this.token);
    }

    /**
     * @return {Promise}
     */
    login() {
        return this.getPassword()
            .then((password) => {
                // Exchange password for access token
                console.log('Logging in...');
                this.startCLISpinner();
                return Request
                    .post(url.resolve(this.baseURL, 'accesstokens'))
                    .send({
                        shopwareId: this.username,
                        password,
                    });
            })
            .then(this.successHandler()).then((res) => {
                this.stopCLISpinner();
                console.log(Chalk.green.bold('Login successful! \u{1F513}'));
                // Save userId and access token
                this.userId = res.body.userId;
                this.token = res.body.token;

                return this;
            })
            .catch(this.errorHandler());
    }

    /**
     * @return {Promise}
     */
    getPassword() {
        if (this.password) {
            // Use given password
            return Promise.resolve(this.password);
        }

        // Prompt for password
        return co.wrap(function* () {
            return yield Prompt.password('Password: ');
        })();
    }

    /**
     * @return {Promise}
     */
    successHandler() {
        return (res) => {
            this.stopCLISpinner();
            return res;
        };
    }

    /**
     * @return {Promise}
     */
    errorHandler() {
        return (err) => {
            if (err.response && err.response.unauthorized) {
                throw new Error(`Login failed: ${err.message}`);
            }

            throw err;
        };
    }

    startCLISpinner() {
        this.spinner.start();
    }

    stopCLISpinner() {
        this.spinner.stop(true);
    }

};
