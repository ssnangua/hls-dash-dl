import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["cjs"],
  splitting: true,
  cjsInterop: true,
  dts: {
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
    },
  },
  minify: false,
  sourcemap: false,
  clean: true,
});
