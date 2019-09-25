module.exports = class ShopwareAuthenticator {
    /**
     * @param {String} username
     * @param {String} password
     * @param {Object} axios instance
     */
    constructor(username, password, axios) {
        this.accessToken = undefined;
        this.userId = undefined;
        this.username = username;
        this.password = password;
        this.axios = axios;
    }

    /**
     * Login to the Shopware Community Store to obtain the token to authenticate further requests.
     *
     * @return {String}
     * @throws {Error}
     */
    async login() {
        // Exchange password for access token
        this.axios.emitter.emit('loggingIn');

        try {
            const res = await this.axios
                .post('accesstokens', {
                    shopwareId: this.username,
                    password: this.password,
                }, {
                    noToken: true,
                });

            this.axios.emitter.emit('loginSuccessful');

            this.accessToken = res.data.token;
            this.userId = res.data.userId;
        } catch (err) {
            if (err.response && err.response.unauthorized) {
                throw new Error(`Login failed: ${err.message}`);
            }

            throw err;
        }
    }

    /**
     * Handles login and token renewal
     */
    registerAuthenticationInterceptors() {
        this.registerAccessTokenInterceptor();
        this.registerAuthenticationRenewalInterceptor();
    }

    /**
     * The interceptor will cause the client to authenticate if no accessToken is set
     */
    registerAccessTokenInterceptor() {
        // if no accessToken is stored yet, first login and obtain one
        this.axios.interceptors.request.use(
            async (config) => {
                if (!config.noToken) {
                    if (!this.accessToken) {
                        // Login to get an access token
                        await this.login();
                    }

                    if (config.headers) {
                        config.headers['X-Shopware-Token'] = this.accessToken;
                    } else {
                        config.headers = { 'X-Shopware-Token': this.accessToken };
                    }
                }

                return config;
            },
            Promise.reject,
        );
    }

    /**
     * On 401 Unauthenticated responses (token expired) first obtain a new accessToken and then retry the request once
     */
    registerAuthenticationRenewalInterceptor() {
        this.axios.interceptors.response.use(
            response => response,
            (error) => {
                if (error.response && error.response.status === 401 && error.config && !error.config.isRetryRequest) {
                    error.config.isRetryRequest = true;
                    this.accessToken = undefined;
                    this.axios.emitter.emit('info', 'Renewing auth data...');

                    return this.axios(error.config);
                }

                return Promise.reject(error);
            },
        );
    }
}
