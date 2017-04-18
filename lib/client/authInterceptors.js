let accessToken = null;
let username = null;
let password = null;
let axios = null;


async function login() {
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
        // Save access token
        accessToken = res.data.token;

        return true;
    } catch (err) {
        if (err.response && err.response.unauthorized) {
            throw new Error(`Login failed: ${err.message}`);
        }

        throw err;
    }
}

async function getAccessToken() {
    if (accessToken) {
        return accessToken;
    }

    // Login to get an access token
    await login();

    return accessToken;
}

module.exports = (customAxios, user, pass) => {
    username = user;
    password = pass;
    axios = customAxios;
    customAxios.interceptors.request.use(async (config) => {
        if (!config.noToken) {
            const token = await getAccessToken();
            if (config.headers) {
                config.headers['X-Shopware-Token'] = token;
            } else {
                config.headers = { 'X-Shopware-Token': token };
            }

            return config;
        }

        return config;
    },
        error => Promise.reject(error)
    );

    return customAxios;
};
