const axios = require('axios');
const spinnerInterceptors = require('./spinnerInterceptors');
const authInterceptors = require('./authInterceptors');

const baseURL = 'https://api.shopware.com/';

module.exports = (user, pass, emitter) => {
    const customAxios = axios.create({
        baseURL,
    });

    customAxios.emitter = emitter;

    spinnerInterceptors(customAxios);

    authInterceptors(customAxios, user, pass);

    return customAxios;
};
