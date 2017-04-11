const axios = require('axios');
const EventEmitter = require('events');
const spinnerInterceptors = require('./spinner_interceptors');
const authInterceptors = require('./auth_interceptors');

const baseURL = 'https://api.shopware.com/';

module.exports = (user, pass, emitter = new EventEmitter()) => {
    const customAxios = axios.create({
        baseURL,
    });

    customAxios.emitter = emitter;

    spinnerInterceptors(customAxios);

    authInterceptors(customAxios, user, pass);

    return customAxios;
};
