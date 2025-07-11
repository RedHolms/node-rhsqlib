import esbuild from "esbuild";

(async () => {

  if (process.argv[2] === "-w") {
    process.stdout.end();
    process.stderr.end();
  }

  const context = await esbuild.context({
    entryPoints: ["./src/index.ts"],
    outfile: "./dist/index.js",
    platform: "node",
    bundle: true,
    packages: "external",
    treeShaking: true,
    format: "esm",
    sourcemap: "inline"
  });

  if (process.argv[2] === "-w") {
    await context.watch();
  }
  else {
    await context.rebuild();
    await context.dispose();
  }

})();
