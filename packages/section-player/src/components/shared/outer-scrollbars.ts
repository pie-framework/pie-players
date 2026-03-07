export function manageOuterScrollbars(args?: {
	managedClass?: string;
	activeClass?: string;
	idleTimeoutMs?: number;
}): () => void {
	const managedClass = args?.managedClass ?? "pie-outer-scrollbars-managed";
	const activeClass = args?.activeClass ?? "pie-outer-scrolling";
	const idleTimeoutMs = args?.idleTimeoutMs ?? 900;
	const html = document.documentElement;
	const body = document.body;
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

	html.classList.add(managedClass);
	body.classList.add(managedClass);

	const showOuterScrollbars = () => {
		html.classList.add(activeClass);
		body.classList.add(activeClass);
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}
		scrollTimeout = setTimeout(() => {
			html.classList.remove(activeClass);
			body.classList.remove(activeClass);
		}, idleTimeoutMs);
	};

	window.addEventListener("scroll", showOuterScrollbars, { passive: true });
	return () => {
		window.removeEventListener("scroll", showOuterScrollbars);
		html.classList.remove(activeClass);
		body.classList.remove(activeClass);
		html.classList.remove(managedClass);
		body.classList.remove(managedClass);
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}
	};
}
