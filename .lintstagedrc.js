module.exports = {
    'cartridges/**/cartridge/client/**/*.{js,json,css}': [
        'eslint --fix',
        'git add',
    ],
};
