/** @type {import('next').NextConfig} */
const nextConfig = {
  // GCP SDKs use Node streams/gRPC — bundling them breaks uploads (HashStreamValidator / writable).
  experimental: {
    serverComponentsExternalPackages: [
      "@google-cloud/storage",
      "@google-cloud/firestore",
      "@google-cloud/speech",
      "@google-cloud/text-to-speech",
      "google-gax",
      "google-auth-library",
      "@grpc/grpc-js",
      "@grpc/proto-loader",
    ],
  },
};

export default nextConfig;
