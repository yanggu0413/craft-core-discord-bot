/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  outputFileTracing: false,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
