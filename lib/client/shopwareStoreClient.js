const axios = require('axios');
const spinnerInterceptors = require('./spinnerInterceptors');
const retryInterceptor = require('./retryInterceptor');

const baseURL = 'https://api.shopware.com/';
const timeout = 2 * 60 * 1000; // 2 minutes
const maxBodyLength = 30 * (1024 ** 2); // 30MB

/**
 * Create the axios instance, attach the emitter to it and register all interceptors.
 *
 * @param {EventEmitter} emitter
 * @return {Object}
 */
module.exports = (emitter) => {
    const customAxios = axios.create({
        baseURL,
        timeout,
        maxBodyLength,
    });
    customAxios.emitter = emitter;
    spinnerInterceptors(customAxios);
    retryInterceptor(customAxios);

    return customAxios;
};
