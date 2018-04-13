module.exports = {
    extends: "./node_modules/viison-style-guide/javascript/eslintrc.js",
    plugins: [
        'filenames'
    ],
    rules: {
        'no-console': 'off',
        'max-len': ['warn', 120],
        'filenames/match-regex': 'error',
    },
};
