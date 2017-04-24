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

module.exports = (customAxios, user, pass) => {
    const axios = customAxios;
    let accessToken = null;
    customAxios.interceptors.request.use(async (config) => {
        if (!config.noToken) {
            if (!accessToken) {
                // Login to get an access token
                accessToken = await login(user, pass, axios);
            }

            if (config.headers) {
                config.headers['X-Shopware-Token'] = accessToken;
            } else {
                config.headers = { 'X-Shopware-Token': accessToken };
            }

            return config;
        }

        return config;
    },
        error => Promise.reject(error)
    );

    customAxios.interceptors.response.use(async response => response,
        (error) => {
            // retry request once on 401
            if (error.response.status === 401 && error.config && !error.config.isRetryRequest) {
                error.config.isRetryRequest = true;
                accessToken = null;
                axios.emitter.emit('info', 'Renewing auth data...');

                return customAxios(error.config);
            }

            return Promise.reject(error);
        });

    return customAxios;
};
