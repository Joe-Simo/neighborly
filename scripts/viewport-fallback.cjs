
const dynamic = /(\d*\.?\d+)[sdl]v(h|w|min|max|i|b)\b/g;

// Safari before 15.4 (iOS 15.0 to 15.3) drops any declaration that uses small, large or dynamic viewport units.
// Each such declaration is preceded by the same one in plain viewport units, so those browsers keep a size.
/** @type {import("postcss").PluginCreator<void>} */
const viewportFallback = () => ({
  postcssPlugin: "viewport-fallback",
  Declaration(decl) {
    const value = decl.value.replace(dynamic, "$1v$2");
    if (value === decl.value) return;
    const before = decl.prev();
    if (before?.type === "decl" && before.prop === decl.prop && before.value === value) return;
    decl.cloneBefore({ value });
  },
});
viewportFallback.postcss = true;

module.exports = viewportFallback;
