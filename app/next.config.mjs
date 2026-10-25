/** @type {import('next').NextConfig} */
const nextConfig = {
  // No ESLint in this practice app, so don't make the build look for it.
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
