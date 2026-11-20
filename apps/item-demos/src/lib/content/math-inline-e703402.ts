import type { DemoInfo } from "./types";

// Production item E703402, version 0.0.4 (baseId 8a80808192924bdd019295ed3a5220f8): four
// math-inline answer fields in a table in the item markup. Every field carries the same rationale.
const rationale =
	'<div>The correct responses are&#160;</div><ul><li>Horizontal Asymptote: <em>y</em> = <strong>3</strong></li><li>Vertical Asymptote: <em>x</em> = <strong>&#8211;6</strong></li><li>Zero: <strong>-2</strong></li><li>y-intercept:<strong> 1</strong></li></ul><p></p><p>The vertical asymptote is found by setting the denominator equal to 0 and solving for <em>x</em>: <em>x</em> + 6 = 0; <em>x</em> = &#8211;6.</p><p>The horizontal asymptote is found by comparing the degree of the numerator and the denominator. They both have the same degree (of 1) so the horizontal asymptote is equal to the ratio of the coefficients: 3/1 = 3.&#160;</p><p>The zero of the function will be the function&#160;<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>f</mi><mfenced><mi>x</mi></mfenced><mo>=</mo><mfrac><mrow><mn>3</mn><mi>x</mi><mo>+</mo><mn>6</mn></mrow><mrow><mi>x</mi><mo>+</mo><mn>6</mn></mrow></mfrac></math>&#160;set equal to 0;&#160;<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>0</mn><mo>=</mo><mfrac><mrow><mn>3</mn><mi>x</mi><mo>+</mo><mn>6</mn></mrow><mrow><mi>x</mi><mo>+</mo><mn>6</mn></mrow></mfrac></math>;&#160;<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>0</mn><mo>(</mo><mi>x</mi><mo>+</mo><mn>6</mn><mo>)</mo><mo>=</mo><mn>3</mn><mi>x</mi><mo>+</mo><mn>6</mn></math>; 0 = 3<em>x</em> + 6; 3<em>x</em> = &#8211;6; <span class="variable">x</span> = &#8211;2.</p><p>The <span class="variable">y</span>-intercept of the function will be where x = 0 , so&#160;<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>&#160;</mo><mo>=</mo><mo>&#160;</mo><mfrac><mrow><mn>3</mn><mo>(</mo><mn>0</mn><mo>)</mo><mo>&#160;</mo><mo>+</mo><mo>&#160;</mo><mn>6</mn></mrow><mrow><mn>0</mn><mo>+</mo><mn>6</mn></mrow></mfrac></math>; <span class="variable">y</span> = 1.</p><p></p>';

const demo: DemoInfo = {
	id: "math-inline-e703402",
	name: "E703402: Key features of a rational function",
	description:
		"Production item E703402: four math-inline answer fields in a table in the item markup.",
	sourcePackage: "math-inline",
	sourceVariantId: "e703402",
	tags: ["math-inline", "production", "table", "multiple-elements"],
	item: {
		id: "math-inline-e703402",
		name: "E703402",
		config: {
			id: "",
			markup:
				'<p>Damien&#39;s teacher asks him&#160;to graph the rational function&#160;<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>f</mi><mfenced><mi>x</mi></mfenced><mo>=</mo><mfrac><mrow><mn>3</mn><mi>x</mi><mo>+</mo><mn>6</mn></mrow><mrow><mi>x</mi><mo>+</mo><mn>6</mn></mrow></mfrac></math>. Before graphing this function, he creates a table with the key features that will help him to graph the function correctly. What are the key features of the rational function as shown in the table? Type your responses in the boxes below.</p><table class="KdsTable01">\n\t<tbody>\n\t\t<tr>\n\t\t\t<th width="250px"><strong>Asymptotes or Zeros</strong></th>\n\t\t\t<th width="100px"><strong>Number</strong></th>\n\t\t</tr>\n\t\t<tr>\n\t\t\t<td>Horizontal Asymptote: <em>y</em> = ___</td>\n\t\t\t<td><math-inline id="1"></math-inline></td>\n\t\t</tr>\n\t\t<tr>\n\t\t\t<td>Vertical Asymptote: <em>x</em> = ___</td>\n\t\t\t<td><math-inline id="2"></math-inline></td>\n\t\t</tr>\n\t\t<tr>\n\t\t\t<td>Zero: ___</td>\n\t\t\t<td><math-inline id="3"></math-inline></td>\n\t\t</tr>\n\t\t<tr>\n\t\t\t<td><em>y</em>-intercept: ___</td>\n\t\t\t<td><math-inline id="4"></math-inline></td>\n\t\t</tr>\n\t</tbody>\n</table>\n',
			elements: {
				"math-inline": "@pie-element/math-inline@latest",
			},
			models: [
				{
					id: "1",
					element: "math-inline",
					equationEditor: 8,
					responseType: "Advanced Multi",
					expression: "{{response}}",
					responses: [
						{
							allowTrailingZeros: false,
							answer: "3",
							id: "1",
							validation: "literal",
						},
					],
					rationale,
				},
				{
					id: "2",
					element: "math-inline",
					equationEditor: 8,
					responseType: "Advanced Multi",
					expression: "{{response}}",
					responses: [
						{
							allowTrailingZeros: false,
							answer: "-6",
							id: "1",
							validation: "literal",
						},
					],
					rationale,
				},
				{
					id: "3",
					element: "math-inline",
					equationEditor: 8,
					responseType: "Advanced Multi",
					expression: "{{response}}",
					responses: [
						{
							allowTrailingZeros: false,
							answer: "-2",
							id: "1",
							validation: "literal",
						},
					],
					rationale,
				},
				{
					id: "4",
					element: "math-inline",
					equationEditor: 8,
					responseType: "Advanced Multi",
					expression: "{{response}}",
					responses: [
						{
							allowTrailingZeros: false,
							answer: "1",
							id: "1",
							validation: "literal",
						},
					],
					rationale,
				},
			],
		},
	},
};

export default demo;
