/**
 * The full set of built-in DaisyUI theme ids. `<pie-theme>`'s DaisyUI
 * provider adapter maps any of these onto the `--pie-*` token contract, so
 * every demo host offering a DaisyUI theme picker draws from this one list
 * instead of each hand-typing its own copy.
 */
export const DAISYUI_THEME_CATALOG = [
	"light",
	"dark",
	"cupcake",
	"bumblebee",
	"emerald",
	"corporate",
	"synthwave",
	"retro",
	"cyberpunk",
	"valentine",
	"halloween",
	"garden",
	"forest",
	"aqua",
	"lofi",
	"pastel",
	"fantasy",
	"wireframe",
	"black",
	"luxury",
	"dracula",
	"cmyk",
	"autumn",
	"business",
	"acid",
	"lemonade",
	"night",
	"coffee",
	"winter",
	"dim",
	"nord",
	"sunset",
	"caramellatte",
	"abyss",
	"silk",
] as const;

export type DaisyUIThemeId = (typeof DAISYUI_THEME_CATALOG)[number];
