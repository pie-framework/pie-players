/**
 * TeX in summary HTML as MathML Core, which browsers render without MathJax. The converter loads
 * once per page, on the first HTML that holds TeX; HTML without it loads nothing.
 */

type Convert = (html: string) => string;
export type ConverterLoader = () => Promise<Convert>;

/** The markers `texToMathml` reads: MathJax's default delimiters and `[data-latex]`. */
const TEX = /\\\(|\\\[|\$\$|\\\$|\\begin\{|\\(?:eq)?ref\{|data-latex/;

const loadTexToMathml: ConverterLoader = async () =>
	(await import("@pie-element/shared-math-rendering-mathjax/mathml")).texToMathml;

let converter: Promise<Convert> | undefined;

/** `html` with its TeX as MathML, or as given when the converter fails to load or convert. */
export async function convertMath(
	html: string,
	load: ConverterLoader = loadTexToMathml,
): Promise<string> {
	if (!TEX.test(html)) return html;
	converter ??= load();
	try {
		return (await converter)(html);
	} catch {
		// A failed load is retried by the next conversion; this one shows the TeX source.
		converter = undefined;
		return html;
	}
}
