import * as esbuild from 'esbuild';

async function build() {
  console.log("Building with esbuild (Go-based TypeScript compiler)...");

  try {
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm', // Use ESM to support top-level await
      target: 'node18', // Or appropriate Node version
      outfile: 'dist/index.js',
      sourcemap: true,
      minify: false, // Set to true for production minification
      external: [
        'pg-native', // Typically externalized in Node backend builds
        'mock-aws-s3',
        'aws-sdk',
        'nock',
      ],
    });
    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
