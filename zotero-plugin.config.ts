import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

const tailwindCli = "./node_modules/tailwindcss/lib/cli.js";
const tailwindConfig = "tailwind.config.cjs";
const tailwindInput = "src/react/styles/ui.css";

function buildTailwind(output: string) {
  mkdirSync(dirname(output), { recursive: true });
  execFileSync(
    process.execPath,
    [
      tailwindCli,
      "-i",
      tailwindInput,
      "-o",
      output,
      "--config",
      tailwindConfig,
      "--minify",
    ],
    { stdio: "inherit" },
  );
}

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
      {
        entryPoints: ["src/react/window.tsx"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        jsx: "automatic",
        platform: "browser",
        format: "iife",
        target: "firefox115",
        outfile: ".scaffold/build/addon/content/scripts/ui.js",
      },
    ],
    hooks: {
      "build:bundle"(ctx) {
        buildTailwind(`${ctx.dist}/addon/content/styles/ui.css`);
      },
    },
  },

  server: {
    hooks: {
      "serve:prebuild"(ctx) {
        buildTailwind(`${ctx.dist}/addon/content/styles/ui.css`);
      },
      "serve:onChanged"(ctx) {
        buildTailwind(`${ctx.dist}/addon/content/styles/ui.css`);
      },
    },
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
