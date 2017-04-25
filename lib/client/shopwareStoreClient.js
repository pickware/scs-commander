const axios = require('axios');
const spinnerInterceptors = require('./spinnerInterceptors');
const shopwareAuthentication = require('./shopwareAuthentication');

const baseURL = 'https://api.shopware.com/';

/**
 * Create the axios instance, attach the emitter to it and register all interceptors.
 *
 * @param {String} username
 * @param {String} password
 * @param {EventEmitter} emitter
 * @return {Object}
 */
module.exports = (user, pass, emitter) => {
    const customAxios = axios.create({
        baseURL,
    });
    customAxios.emitter = emitter;
    spinnerInterceptors(customAxios);
    shopwareAuthentication(customAxios, user, pass);

    return customAxios;
};
