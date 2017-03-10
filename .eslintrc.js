module.exports = {
    'extends': 'airbnb-base',
    'plugins': [
        'import'
    ],
    'rules': {
        'no-console': 0,
        'max-len': ['error', 120],
        'no-param-reassign': 0,
        'comma-dangle': ['error', {
            arrays: 'always-multiline',
            objects: 'always-multiline',
            imports: 'always-multiline',
            exports: 'always-multiline',
            functions: 'never',
        }],
        'class-methods-use-this': 0,
        'func-names': 0,
        'newline-before-return': ['error'],
        'indent': ['error', 4],
    }
};
