/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
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
