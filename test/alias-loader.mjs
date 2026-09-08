export function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return {
      url: new URL("../node_modules/next/server.js", import.meta.url).href,
      format: "commonjs",
      shortCircuit: true,
    };
  }
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
  const path = specifier.slice(2);
  const target = new URL(`../${path}${path.endsWith(".js") ? "" : ".js"}`, import.meta.url);
  return { url: target.href, format: "module", shortCircuit: true };
}
