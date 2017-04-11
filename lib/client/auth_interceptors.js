let accessToken = null;
let username = null;
let password = null;
let axios = null;


function login() {
    // Exchange password for access token
    axios.emitter.emit('loggingIn');

    return axios
        .post('accesstokens', {
            shopwareId: username,
            password,
        }, {
            noToken: true,
        })
        .then((res) => {
            axios.emitter.emit('loginSuccessful');
            // Save access token
            accessToken = res.data.token;

            return this;
        })
        .catch((err) => {
            if (err.response && err.response.unauthorized) {
                throw new Error(`Login failed: ${err.message}`);
            }

            throw err;
        });
}

function getAccessToken() {
    if (accessToken) {
        return Promise.resolve(accessToken);
    }

    // Login to get an access token
    return login().then(() => accessToken);
}

module.exports = (customAxios, user, pass) => {
    username = user;
    password = pass;
    axios = customAxios;
    customAxios.interceptors.request.use((config) => {
        if (!config.noToken) {
            return getAccessToken().then((token) => {
                config.headers = { 'X-Shopware-Token': token };

                return config;
            });
        }

        return config;
    },
        error => Promise.reject(error)
    );

    return customAxios;
};
