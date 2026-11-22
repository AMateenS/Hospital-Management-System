/** API calls go through the Next server, so the auth cookie stays same-origin (no CORS/cookie issues). */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://localhost:5000'}/api/:path*` }];
  },
};
