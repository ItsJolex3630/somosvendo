/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "libsql", "bcryptjs"],
    // El panel siempre debe reflejar el último estado tras una mutación.
    // Sin caché de rutas dinámicas en el cliente (evita RSC prefetch obsoleto).
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
