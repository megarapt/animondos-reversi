const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');
//const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const sharp = require('sharp');
const pkg = require('./package.json');

// --- Build Versioning Logic ---
const now = new Date();
const buildNumber = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
const fullVersion = `${pkg.version}.${buildNumber}`;

module.exports = {
    mode: 'production',
    entry: './src/js/index.js',
    output: {
        filename: 'js/[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
        // Standard path for assets called via JS/CSS
        assetModuleFilename: 'assets/[name][ext]' 
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    //MiniCssExtractPlugin.loader,
                    'style-loader', // <--- VOLVEMOS A STYLE-LOADER
                    {
                        loader: 'css-loader',
                        options: {
                            importLoaders: 1,
                            modules: false
                        }
                    }
                ],
            },
            {
                // Process PNGs requested by CSS/JS and convert to WebP
                test: /\.png$/i,
                type: 'asset/resource',
                generator: {
                    // This ensures that even if CSS asks for .png, 
                    // the output file is .webp
                    filename: 'img/[name].webp'
                }
            },
            {
                test: /\.m4a$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'audio/[name][ext]'
                }
            }
        ],
    },
    optimization: {
        minimizer: [
            `...`, 
            new ImageMinimizerPlugin({
                minimizer: {
                    implementation: ImageMinimizerPlugin.sharpMinify,
                    options: {
                        encodeOptions: {
                            // High-performance WebP conversion
                            webp: { quality: 75 },
                        },
                    },
                },
                // This handles the optimization of images found in the dependency graph
                generator: [
                    {
                        preset: "webp",
                        filter: (asset) => !/background|splash/.test(asset.filename),
                        implementation: ImageMinimizerPlugin.sharpGenerate,
                        options: {
                            encodeOptions: { webp: { quality: 75 } },
                            // ASPECT RATIO PRESERVATION: Only constrain the width to 500px.
                            // Height will scale proportionally (auto-calculated).
                            resize: { 
                                width: 500, 
                                // height is omitted to avoid forcing a square bounding box
                                fit: "inside", 
                                withoutEnlargement: true 
                            }
                        },
                    },
                ],
            }),
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            '__APP_VERSION__': JSON.stringify(fullVersion)
        }),
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html',
            minify: {
                removeComments: true,
                collapseWhitespace: true
            }
        }),
        /*new MiniCssExtractPlugin({
            filename: 'css/style.[contenthash].css' 
        }),*/
        new CopyWebpackPlugin({
            patterns: [
                { from: "src/favicon/", to: "" },
                { from: 'src/data', to: 'data' },
                { from: 'src/audio', to: 'audio' },
                { 
                    from: 'etc/hd-img', 
                    to: 'img/[name].webp',
                    transform(content) {
                        // FIXED: Using object notation to only constrain width.
                        // Height will now scale proportionally.
                        return sharp(content)
                            .resize({ 
                                width: 500, 
                                withoutEnlargement: true 
                            })
                            .webp({ quality: 75 })
                            .toBuffer();
                    },
                    noErrorOnMissing: true,
                    info: { minimized: true }
                }
            ]
        }),
        new WorkboxPlugin.GenerateSW({
            clientsClaim: true,
            skipWaiting: true,
            swDest: 'sw.js',
            maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
        })
    ]
};