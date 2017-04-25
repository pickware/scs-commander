/**
 * Login to the Shopware Community Store to obtain the token to authenticate further requests.
 *
 * @param {String} username
 * @param {String} password
 * @param {Object} axios instance
 * @return {String}
 * @throws {Error}
 */
async function login(username, password, axios) {
    // Exchange password for access token
    axios.emitter.emit('loggingIn');

    try {
        const res = await axios
            .post('accesstokens', {
                shopwareId: username,
                password,
            }, {
                noToken: true,
            });

        axios.emitter.emit('loginSuccessful');

        return res.data.token;
    } catch (err) {
        if (err.response && err.response.unauthorized) {
            throw new Error(`Login failed: ${err.message}`);
        }

        throw err;
    }
}

/**
 * Attach authentication interceptors to the axios instance to transparently ensure all requests are authenticated.
 *
 * @param {Object} axios instance
 * @param {String} username
 * @param {String} password
 * @return {Object}
 */
module.exports = (customAxios, user, pass) => {
    // accessToken state is saved across requests as the interceptors access these exact instances
    // when modifying the requests and responses
    let accessToken = null;

    // if no acessToken is stored yet, first login and obtain one
    customAxios.interceptors.request.use(async (config) => {
        if (!config.noToken) {
            if (!accessToken) {
                // Login to get an access token
                accessToken = await login(user, pass, customAxios);
            }

            if (config.headers) {
                config.headers['X-Shopware-Token'] = accessToken;
            } else {
                config.headers = { 'X-Shopware-Token': accessToken };
            }
        }

        return config;
    },
        error => Promise.reject(error)
    );

    // on 401 Unauthenticated responses (token expired) first obtain a new accessToken and then retry the request once
    customAxios.interceptors.response.use(async response => response,
        (error) => {
            if (error.response.status === 401 && error.config && !error.config.isRetryRequest) {
                error.config.isRetryRequest = true;
                accessToken = null;
                customAxios.emitter.emit('info', 'Renewing auth data...');

                return customAxios(error.config);
            }

            return Promise.reject(error);
        });

    return customAxios;
};
