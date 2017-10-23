/**
 * Sleeps for given amount of seconds
 *
 * @param seconds
 * @returns {Promise}
 */
function sleep(seconds) {
    return new Promise(resolve => setTimeout(() => resolve(), seconds * 1000));
}

/**
 * Attach the retry interceptor to the axios instance to transparently ensure all requests are going through eventually.
 *
 * @param {Object} customAxios axios instance
 * @return {Object}
 */
module.exports = (customAxios) => {
    // on 429 Too Many Requests responses retry after 5 seconds
    customAxios.interceptors.response.use(
        response => response,
        async (error) => {
            if (error.response && error.response.status === 429) {
                await sleep(5);

                return customAxios(error.config);
            }

            return Promise.reject(error);
        }
    );

    return customAxios;
};
