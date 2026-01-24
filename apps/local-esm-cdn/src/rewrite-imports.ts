export type RewriteOptions = {
  esmShBaseUrl: string;
  pkg?: string; // e.g., "@pie-lib/render-ui"
  subpath?: string; // e.g., "controller/index" or empty
};

function shouldRewriteToEsmSh(specifier: string): boolean {
  if (!specifier) return false;
  if (specifier.startsWith('./') || specifier.startsWith('../')) return false;
  if (specifier.startsWith('/')) return false;
  if (specifier.startsWith('http://') || specifier.startsWith('https://')) return false;
  if (specifier.startsWith('@pie-element/')) return false;
  if (specifier.startsWith('@pie-lib/')) return false;
  if (specifier.startsWith('@pie-elements-ng/')) return false;
  if (specifier.startsWith('@pie-framework/')) return false;
  return true;
}

type BunModuleResolution = { packageName: string; subpath: string };

function parseBunNodeModulesSpecifier(specifier: string): BunModuleResolution | null {
  const marker = '/node_modules/.bun/';
  const markerIndex = specifier.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterMarker = specifier.slice(markerIndex + marker.length);
  const nestedIndex = afterMarker.indexOf('/node_modules/');
  if (nestedIndex === -1) return null;

  const afterNested = afterMarker.slice(nestedIndex + '/node_modules/'.length);
  if (!afterNested) return null;

  const parts = afterNested.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  if (parts[0].startsWith('@')) {
    if (parts.length < 2) return null;
    const packageName = `${parts[0]}/${parts[1]}`;
    const subpath = parts.slice(2).join('/');
    return { packageName, subpath };
  }

  const packageName = parts[0];
  const subpath = parts.slice(1).join('/');
  return { packageName, subpath };
}

function rewriteSpecifier(specifier: string, opts: RewriteOptions): string {
  // Rewrite PIE packages to use /@pie- prefix for local serving
  if (
    specifier.startsWith('@pie-element/') ||
    specifier.startsWith('@pie-lib/') ||
    specifier.startsWith('@pie-elements-ng/') ||
    specifier.startsWith('@pie-framework/')
  ) {
    return specifier.replace('@pie-', '/@pie-');
  }

  // Rewrite external packages to esm.sh
  if (shouldRewriteToEsmSh(specifier)) {
    const base = opts.esmShBaseUrl.endsWith('/') ? opts.esmShBaseUrl : `${opts.esmShBaseUrl}/`;
    return `${base}${specifier}`;
  }

  // Rewrite relative imports to absolute package imports
  if (opts.pkg && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    // SPECIAL CASE: Bun bundler creates relative imports to node_modules/.bun/
    // These should be treated as external dependencies and proxied to esm.sh
    if (specifier.includes('/node_modules/.bun/')) {
      // Extract the actual package name from the Bun internal path
      // e.g., "./node_modules/.bun/react-transition-group@4.4.5_abc/node_modules/react-transition-group/esm/CSSTransition.js"
      const parsed = parseBunNodeModulesSpecifier(specifier);
      if (parsed) {
        const base = opts.esmShBaseUrl.endsWith('/') ? opts.esmShBaseUrl : `${opts.esmShBaseUrl}/`;
        const suffix = parsed.subpath ? `/${parsed.subpath}` : '';
        return `${base}${parsed.packageName}${suffix}`;
      }
      // If we can't parse it, skip rewriting (will likely fail, but better than creating invalid path)
      return specifier;
    }

    // For relative imports, convert to absolute package path
    // e.g., "./feedback.js" in @pie-lib/render-ui becomes "/@pie-lib/render-ui/feedback.js"

    // Remove leading ./ or ../
    let cleaned = specifier;
    if (cleaned.startsWith('./')) {
      cleaned = cleaned.slice(2);
    } else if (cleaned.startsWith('../')) {
      // Handle ../ by going up in the subpath
      // For now, just remove the ../
      cleaned = cleaned.slice(3);
    }

    // Construct absolute path
    if (opts.subpath) {
      // If we're in a subpath, go up one level
      const parts = opts.subpath.split('/');
      parts.pop(); // Remove the file part
      if (parts.length > 0) {
        return `/${opts.pkg}/${parts.join('/')}/${cleaned}`;
      }
    }

    return `/${opts.pkg}/${cleaned}`;
  }

  return specifier;
}

async function tryRewriteWithEsModuleLexer(
  code: string,
  opts: RewriteOptions
): Promise<string | null> {
  try {
    // Optional dependency: present via workspace deps in many setups.
    // If it's missing, we'll fall back to a simple regex approach.
    const mod = (await import('es-module-lexer')) as unknown as {
      init: Promise<void>;
      parse: (source: string) => [{ s: number; e: number; d: number }[], unknown];
    };

    await mod.init;
    const [imports] = mod.parse(code);

    let out = '';
    let last = 0;
    for (const i of imports) {
      const spec = code.slice(i.s, i.e);

      // Skip if this is a dynamic import with a variable/expression (not a string literal)
      // Dynamic imports have d >= 0. Static imports have d === -1.
      if (i.d >= 0) {
        // Check if the specifier is actually a string literal
        const isStringLiteral =
          (spec.startsWith('"') && spec.endsWith('"')) ||
          (spec.startsWith("'") && spec.endsWith("'")) ||
          (spec.startsWith('`') && spec.endsWith('`'));

        if (!isStringLiteral) {
          // Skip rewriting variables/expressions like: import(variableName)
          continue;
        }

        // For string literals in dynamic imports, remove quotes before rewriting
        const quote = spec[0];
        const unquoted = spec.slice(1, -1);
        const next = rewriteSpecifier(unquoted, opts);
        if (next !== unquoted) {
          out += code.slice(last, i.s);
          out += `${quote}${next}${quote}`; // Re-wrap in same quotes
          last = i.e;
        }
      } else {
        // Static import - rewrite normally (specifier doesn't include quotes)
        const next = rewriteSpecifier(spec, opts);
        if (next !== spec) {
          out += code.slice(last, i.s);
          out += next;
          last = i.e;
        }
      }
    }
    out += code.slice(last);
    return out;
  } catch {
    return null;
  }
}

function rewriteWithRegexFallback(code: string, opts: RewriteOptions): string {
  // from "x" / from 'x'
  code = code.replace(
    /(\bfrom\s+["'])([^"']+)(["'])/g,
    (_m, a, spec, c) => `${a}${rewriteSpecifier(spec, opts)}${c}`
  );

  // import("x") / import('x')
  code = code.replace(
    /(\bimport\s*\(\s*["'])([^"']+)(["']\s*\))/g,
    (_m, a, spec, c) => `${a}${rewriteSpecifier(spec, opts)}${c}`
  );

  // import "x" / import 'x' (side-effect import)
  code = code.replace(
    /(\bimport\s+["'])([^"']+)(["'])/g,
    (_m, a, spec, c) => `${a}${rewriteSpecifier(spec, opts)}${c}`
  );

  return code;
}

export async function rewriteImports(code: string, opts: RewriteOptions): Promise<string> {
  const lexer = await tryRewriteWithEsModuleLexer(code, opts);
  if (lexer != null) return lexer;
  return rewriteWithRegexFallback(code, opts);
}
