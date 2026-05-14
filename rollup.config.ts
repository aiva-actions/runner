// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const config = {
    plugins: [typescript(), nodeResolve({ preferBuiltins: true }), json(), commonjs()],
};

const cliConfig = {
    ...config,
    input: 'src/cli.ts',
    output: {
        esModule: true,
        file: 'dist/cli.js',
        format: 'es',
        sourcemap: true,
    },
};

const libConfig = {
    ...config,
    input: 'src/index.ts',
    output: {
        esModule: true,
        file: 'dist/index.js',
        format: 'es',
        sourcemap: true,
    },
};

export default [cliConfig, libConfig];
