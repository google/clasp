import webpack from 'webpack';
import { IgnorePlugin } from 'webpack';

const path = require('path');
const { readdirSync, statSync } = require('fs');

const cleanWebpackPlugin = require('clean-webpack-plugin');
const gasPlugin = require('gas-webpack-plugin');
const lodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const uglifyJSPlugin = require('uglifyjs-webpack-plugin');
const terserPlugin = require('terser-webpack-plugin');

const getSubDirs = (p: string) => {
  try {
    return readdirSync(p).filter((f: string) => statSync(path.join(p, f)).isDirectory());
  } catch (err) {
    return [];
  }
};

const createCacheGroups = (dir: string) => {
  const cacheGroups: any = {
    vendor: {
      test: /[/]node_modules[/]/,
      name: 'node-modules',
      priority: 1,
    },
  };
  getSubDirs(dir).forEach((name: string) => {
    const basename = path.basename(name);
    cacheGroups[basename] = {
      name: basename,
      test: new RegExp(`[/]${name}[/]`),
      reuseExistingChunk: true,
      enforce: true,
    };
  });
  return cacheGroups;
};

const gasEslintBaseConfig = {
  parser: 'babel-eslint',
  extends: ['eslint:recommended', 'google'],
  plugins: ['googleappsscript'],
  env: {
    node: true, // CJS
    es6: true, // ESM
    'googleappsscript/googleappsscript': true,
  },
  rules: {
    'no-console': 'off',
    'import/prefer-default-export': 'off',
    'require-jsdoc': 'off',
    'max-len': [
      2,
      {
        code: 110, // default 80
        tabWidth: 2,
        ignoreUrls: true,
        ignorePattern: '^goog.(module|require)',
      },
    ],
  },
};

const gasBabelLoaderConfig = {
  cwd: __dirname,
  babelrc: false,
  caller: {
    name: 'babel-loader',
    supportsStaticESM: true, // webpack tree shaking; https://github.com/babel/babel/pull/8485
  },
  presets: ['@babel/preset-env'],
  plugins: [
    'transform-async-to-promises',
    [
      '@babel/plugin-transform-runtime',
      {
        corejs: 2,
        helpers: true,
        regenerator: true,
        useESModules: true, // webpack tree shaking
      },
    ],
    'transform-member-expression-literals', // GAS lang spec
    'transform-property-literals', // GAS lang spec
    'lodash', // https://github.com/lodash/babel-plugin-lodash
  ],
};

/**
 * Create GAS-specific Webpack4 configuration object
 * @param options.src {string} Source path, default './src'
 * @param options.dist {string} Build path, default './dist'
 * @param options.entry {string} Entry point filename (relative to src), default 'index.js'
 * @param options.lint {boolean} Enable eslint, default true
 * @returns webpack.Configuration
 */
export const buildWebpackConfig = (options: {
  src?: string,
  dist?: string,
  entry?: string,
  lint?: boolean,
}): webpack.Configuration => {
  const opt = {
    src: './src',
    dist: './dist',
    entry: 'index.js',
    lint: true,
    ...options,
  };
  const _cwd = process.cwd();
  const config: webpack.Configuration = {
    mode: 'production', //! 'development' bypass uglify & breaks Promise.catch()
    devtool: false,
    context: _cwd,
    performance: {
      hints: false,
    },
    entry: {
      main: path.resolve(_cwd, opt.src, path.basename(opt.entry)),
    },
    resolve: {
      mainFiles: ['index'], // default
      extensions: ['.js'],
      modules: ['node_modules', path.resolve(__dirname, '../node_modules')],
    },
    resolveLoader: {
      modules: ['node_modules', path.resolve(__dirname, '../node_modules')],
    },
    output: {
      path: path.resolve(_cwd, opt.dist),
      filename: `[name].js`,
      chunkFilename: `[name].js`,
      globalObject: 'this',
      libraryTarget: 'umd', // 'this', 'var'
      // library: 'MyLibrary',
      pathinfo: true,
    },
    node: {
      // defaults; https://webpack.js.org/configuration/node/
      console: false,
      global: true,
      process: true,
      __filename: 'mock',
      __dirname: 'mock',
      Buffer: true,
      setImmediate: true,
    },
    module: {
      rules: [
        opt.lint ? {
          enforce: 'pre',
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'eslint-loader',
          options: {
            cwd: _cwd,
            fix: true,
            cache: false,
            quiet: false,
            failOnError: true,
            useEslintrc: true, // allow local rc file override
            baseConfig: gasEslintBaseConfig,
          },
        } : {},
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader?cacheDirectory=true',
          options: gasBabelLoaderConfig,
        },
      ],
    },
    plugins: [
      new gasPlugin(), // https://github.com/fossamagna/gas-webpack-plugin
      new IgnorePlugin(/^\.\/locale$/, /moment$/),
      new lodashModuleReplacementPlugin(),
      new cleanWebpackPlugin(path.resolve(_cwd, opt.dist, '**/*.js'), {
        root: _cwd,
        verbose: false,
        exclude: [
          path.resolve(_cwd, opt.dist, '**/appsscript.json'),
          path.resolve(_cwd, opt.dist, '**/*.html'),
          path.resolve(_cwd, opt.dist, '**/*.md'),
        ],
      }),
    ],
    optimization: {
      providedExports: true,
      usedExports: true,
      concatenateModules: true,
      runtimeChunk: {
        name: 'runtime-loader',
      },
      splitChunks: {
        // https://webpack.js.org/plugins/split-chunks-plugin/#optimization-splitchunks
        chunks: 'all',
        cacheGroups: createCacheGroups(path.resolve(_cwd, opt.src)),
      },
      // mode: 'production' only!
      minimizer: [
        // ES3, don't minimize chunks, preserve comments starting with !, @license, @preserve
        new uglifyJSPlugin({
          parallel: true,
          uglifyOptions: {
            // https://github.com/mishoo/UglifyJS2/tree/harmony#minify-options
            ie8: true,
            mangle: false,
            compress: false,
            output: {
              beautify: true,
              indent_level: 2,
              width: 110,
              comments: /(?:^!|@(?:license|preserve))/i,
            },
          },
        }),
        // ES6+, minimize node modules
        new terserPlugin({
          test: /node-modules\.js(\?.*)?$/i,
          parallel: true,
          cache: true,
          terserOptions: {
            // https://github.com/fabiosantoscode/terser#minify-options
            ie8: true,
            compress: {
              properties: false,
            },
            output: {
              max_line_len: 110,
              preamble: '/* terser minified */',
            },
          },
        }),
      ],
    },
  };
  return config;
};
