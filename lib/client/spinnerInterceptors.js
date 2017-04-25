/**
 * Attach spinner interceptors to the axios instance to transparently ensure the spinner events are emitted.
 *
 * @param {Object} axios instance
 * @return {Object}
 */
module.exports = (customAxios) => {
    customAxios.interceptors.request.use((config) => {
        customAxios.emitter.emit('startHTTPRequest');

        return config;
    }, (error) => {
        customAxios.emitter.emit('endHTTPRequest');

        return Promise.reject(error);
    });

    customAxios.interceptors.response.use((response) => {
        customAxios.emitter.emit('endHTTPRequest');

        return response;
    }, (error) => {
        customAxios.emitter.emit('endHTTPRequest');

        return Promise.reject(error);
    });

    return customAxios;
};
