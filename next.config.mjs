import path from 'path';

// Set fallback SWC WebAssembly engine for robust cross-platform compilation
process.env.NEXT_TEST_WASM_DIR = path.resolve('./node_modules/@next/swc-wasm-nodejs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
