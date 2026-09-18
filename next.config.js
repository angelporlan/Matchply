/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
    optimizePackageImports: ['lucide-react'],
  },
  env: {
    AI_PROMPTS_DEBUG: process.env.AI_PROMPTS_DEBUG || process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG || '',
  },
  async redirects() {
    return [
      { source: '/dashboard/kanban', destination: '/dashboard/applications', permanent: true },
      { source: '/dashboard/kanban/archived', destination: '/dashboard/applications?view=archived', permanent: true },
      { source: '/dashboard/applications/archived', destination: '/dashboard/applications?view=archived', permanent: true },
      { source: '/dashboard/kanban/offer/:id', destination: '/dashboard/applications/offer/:id', permanent: true },
    ];
  },
};

module.exports = nextConfig;
