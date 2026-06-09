export type DemoView = "delivery" | "author" | "source" | "controller";

export function demoViewFromPath(pathname: string): DemoView {
	const segment = pathname.split("/").filter(Boolean).at(-1);
	if (
		segment === "author" ||
		segment === "source" ||
		segment === "controller"
	) {
		return segment;
	}
	return "delivery";
}
