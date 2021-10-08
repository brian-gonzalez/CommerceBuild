const path = require('path');
const webpackMerge = require('webpack-merge');
const ESLintPlugin = require('eslint-webpack-plugin');
const StylelintPlugin = require('stylelint-webpack-plugin');
const RevolverPlugin = require('revolver-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const FixStyleOnlyEntriesPlugin = require('webpack-fix-style-only-entries');

const buildHelpers = require('./helpers');

// Set to 'production' to disable mapping and enable minification:
const envType = buildHelpers.getFlagValue('type', 'development');
const isProduction = envType === 'production';
const cwd = process.cwd();

function _getJSConfig(currentCartridge, options) {
    const jsPathData = buildHelpers.getJSPaths(currentCartridge, options);

    // Only generate a config if there's an `jsPathData.entryObject`.
    if (Object.keys(jsPathData.entryObject).length) {
        const outputPath = path.join(cwd, jsPathData.outputPath);

        // This call should be removed once upgrading to Webpack 5.20+, since it comes with a built-in.
        buildHelpers.cleanDirs(outputPath);

        return {
            mode: envType,
            entry: jsPathData.entryObject,
            name: `js-${currentCartridge}`,
            output: {
                path: outputPath,
                filename: '[name].js',
                chunkFilename: '[name].js',
                // clean: true
            },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: [/node_modules/],
                        use: ['babel-loader'],
                    },
                ],
            },
            plugins: [new ESLintPlugin()],
            resolve: {
                plugins: (function (useRevolver) {
                    const plugins = [];

                    if (useRevolver) {
                        plugins.push(
                            new RevolverPlugin({
                                directoryList: options.revolverPaths.paths,
                            }),
                        );
                    }

                    return plugins;
                }(options.revolverPaths.useRevolver)),
                alias: options.revolverPaths.aliases,
            },
            optimization: {
                splitChunks: {
                    minChunks: 2,
                },
            },
        };
    }
}

function _getStylesConfig(currentCartridge, options) {
    const scssPathData = buildHelpers.getSCSSPaths(currentCartridge, options);

    // Only generate a config if there's an `scssPathData.entryObject`.
    if (Object.keys(scssPathData.entryObject).length) {
        return {
            mode: envType,
            entry: scssPathData.entryObject,
            name: `scss-${currentCartridge}`,
            output: {
                path: path.join(cwd, scssPathData.outputPath),
                filename: '[name].js',
            },
            devtool: !isProduction ? 'source-map' : '',
            module: {
                rules: [
                    {
                        test: /\.scss$/,
                        use: [
                            {
                                loader: MiniCssExtractPlugin.loader,
                            },
                            {
                                loader: 'css-loader',
                                options: {
                                    url: false,
                                    sourceMap: true,
                                },
                            },
                            {
                                loader: 'postcss-loader',
                                options: {
                                    sourceMap: true,
                                },
                            },
                            {
                                loader: 'sass-loader',
                                options: {
                                    sourceMap: true,
                                    sassOptions: {
                                        includePaths:
                                            buildHelpers.getIncludePaths(),
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            resolve: {
                alias: options.revolverPaths.aliases,
            },
            plugins: [
                // Fixes: https://github.com/webpack-contrib/mini-css-extract-plugin/issues/151
                new FixStyleOnlyEntriesPlugin({ silent: true }),
                new MiniCssExtractPlugin({ filename: '[name].css' }),
                new StylelintPlugin({}),
            ],
            stats: {
                chunksSort: 'name',
                modules: false,
                children: false,
                entrypoints: false,
                chunkOrigins: false,
            },
        };
    }
}

/**
 * Sets the configuration object per cartridge.
 * Only push configurations if there are <main>.js files found.
 * @param {[Array]} configList [description]
 * @param {[String]} currentCartridge  [description]
 */
function _setConfig(configList, options, currentCartridge) {
    // Push back the new config into the configList.
    if (buildHelpers.getFlagValue('js')) {
        const currentConfig = _getJSConfig(currentCartridge, options);

        if (currentConfig) {
            configList.push(currentConfig);
        }
    }

    if (buildHelpers.getFlagValue('css')) {
        const currentConfig = _getStylesConfig(currentCartridge, options);

        if (currentConfig) {
            configList.push(currentConfig);
        }
    }
}

/**
 * Updates the build using a provided `customConfigList`.
 * This object is merged into the default build, `curentConfig`.
 * Matching properties are replaced.
 */
function _updateConfig(configList, customConfigList, mergeStrategy = {}) {
    configList.forEach((curentConfig, index) => {
        customConfigList.forEach((currentCustomConfig) => {
            if (
                curentConfig.name.indexOf(`${currentCustomConfig.name}`) !== -1
            ) {
                // See https://github.com/survivejs/webpack-merge#merging-with-strategies
                configList[index] = webpackMerge.smartStrategy(mergeStrategy)(
                    curentConfig,
                    currentCustomConfig,
                );
            }
        });
    });
}

/**
 * Starts the build.
 * @return {[Array]}     [description]
 */
function initConfig(customConfigList, mergeStrategy) {
    const scope = buildHelpers.getFlagValue('css') ? 'styles' : 'js';
    const cartridgeList = buildHelpers.getCartridgeBuildList(scope);
    const options = {
        mainFiles: buildHelpers
            .getConfigValue('mainFiles', 'main.js', scope)
            .split(/(?:,| )+/),
        getRootFiles: buildHelpers.getConfigValue('rootFiles', false, scope),
        mainEntryName: buildHelpers.getConfigValue(
            'mainEntryName',
            'main',
            scope,
        ),
        revolverPaths: buildHelpers.getRevolverPaths(scope),
    };
    const configList = [];

    cartridgeList.forEach(_setConfig.bind(this, configList, options));

    if (customConfigList) {
        _updateConfig(configList, customConfigList, mergeStrategy);
    }

    return configList;
}

exports.initConfig = initConfig;
