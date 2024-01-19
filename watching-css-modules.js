const fs = require("fs");
const postcss = require("postcss");
const selectorParse = require("postcss-selector-parser");
const prettier = require("prettier");
const path = require("path");
const srcDir = path.join(process.cwd(), "src");

const removeDupStrFromArray = (arr) => {
  const uniqueArray = [];

  for (const str of arr) {
    if (!uniqueArray.includes(str)) {
      uniqueArray.push(str);
    }
  }
  return uniqueArray;
};
function isCSSSelectorValid(selector) {
  try {
    selectorParse().processSync(selector);
    return true; // If no errors occurred, the selector is valid
  } catch (error) {
    console.error(`Invalid CSS selector: ${selector}`);
    return false; // If an error occurred, the selector is not valid
  }
}
const typeDeceleration = async (classArray) => {
  const data = `declare const styles: {${classArray
    ?.map((el, index) => `readonly '${el}': string;\n`)
    .join("")}};export default styles;`;
  const formattedData = await prettier.format(data, {
    parser: "typescript",
  });
  return formattedData;
};

function isDir(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
function createUniquesClassName(fullPath) {
  return new Promise((resolve, reject) => {
    let css = fs.readFileSync(fullPath);
    const classNames = [];
    postcss()
      .process(css, { from: fullPath, to: fullPath?.replace(".css", ".d.css") })
      .then(async (result) => {
        result.root.walkRules((rule) => {
          if (!isCSSSelectorValid(rule.selector)) return;
          selectorParse((selectors) => {
            selectors.walkClasses((selector) => {
              classNames.push(selector.value);
            });
          }).process(rule.selector);
        });

        const uniquesClassName = await removeDupStrFromArray(classNames);
        resolve(uniquesClassName);
      })
      .catch(reject);
  });
}

async function createDecelerationFile(fullPath) {
  const uniquesClassName = await createUniquesClassName(fullPath);

  if (uniquesClassName?.length > 0) {
    const decelerationPath = fullPath?.replace(
      ".module.css",
      ".module.css.d.ts"
    );
    const formattedDeceleration = await typeDeceleration(uniquesClassName);

    try {
      fs.writeFileSync(decelerationPath, formattedDeceleration, (error) =>
        console.log("error in writeFileSync:", error)
      );
    } catch (err) {
      console.log("error in writing file:", err);
    }
  }
}

function getCssModulesFiles(pathDir) {
  let directory = pathDir ?? srcDir;

  if (isDir(directory)) {
    fs.readdirSync(directory).forEach(async (dir) => {
      const fullPath = path.join(directory, dir);
      if (isDir(fullPath)) return getCssModulesFiles(fullPath);
      if (!fullPath.endsWith(".module.css")) return;

      try {
        createDecelerationFile(fullPath);
      } catch (e) {
        console.log(e);
      }
    });
  } else {
    if (!directory.endsWith(".module.css")) return;
    createDecelerationFile(directory);
  }
}

class CssModuleTypes {
  constructor(rootDir = "./src/") {
    this.rootDir = rootDir ?? "";
  }
  apply(compiler) {
    compiler.hooks.emit.tapAsync("TranslatePlugin", (compilation, callback) => {
      compilation.contextDependencies.add(
        path.resolve(__dirname, this.rootDir)
      );
      callback();
    });
    compiler.hooks.invalid.tap("Invalid", (fileName, changeTime) => {
      getCssModulesFiles(fileName);
    });
  }
}

function withCssTypes(nextConfig = {}) {
  return Object.assign({}, nextConfig, {
    webpack: (config) => {
      config.plugins.push(new CssModuleTypes());
      return config;
    },
  });
}

module.exports = withCssTypes;
