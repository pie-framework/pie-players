export type FloatingPanelState = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type FloatingPanelViewportSizing = {
	widthRatio: number;
	heightRatio: number;
	minWidth: number;
	maxWidth: number;
	minHeight: number;
	maxHeight: number;
	alignX: "left" | "center" | "right";
	alignY: "top" | "center" | "bottom";
	paddingX?: number;
	paddingY?: number;
};

export function computePanelSizeFromViewport(
	viewport: { width: number; height: number },
	sizing: FloatingPanelViewportSizing,
): FloatingPanelState {
	const clamp = (value: number, min: number, max: number) =>
		Math.max(min, Math.min(value, max));
	const width = clamp(
		Math.round(viewport.width * sizing.widthRatio),
		sizing.minWidth,
		sizing.maxWidth,
	);
	const height = clamp(
		Math.round(viewport.height * sizing.heightRatio),
		sizing.minHeight,
		sizing.maxHeight,
	);
	const paddingX = sizing.paddingX ?? 16;
	const paddingY = sizing.paddingY ?? 16;
	const maxX = Math.max(paddingX, viewport.width - width - paddingX);
	const maxY = Math.max(paddingY, viewport.height - height - paddingY);
	const x =
		sizing.alignX === "left"
			? paddingX
			: sizing.alignX === "right"
				? maxX
				: Math.max(paddingX, Math.round((viewport.width - width) / 2));
	const y =
		sizing.alignY === "top"
			? paddingY
			: sizing.alignY === "bottom"
				? maxY
				: Math.max(paddingY, Math.round((viewport.height - height) / 2));
	return { x, y, width, height };
}

type PointerControllerArgs = {
	getState: () => FloatingPanelState;
	setState: (next: FloatingPanelState) => void;
	minWidth: number;
	minHeight: number;
	padding?: number;
};

export type FloatingPanelPointerController = {
	startDrag: (event: MouseEvent) => void;
	startResize: (event: MouseEvent) => void;
	stop: () => void;
};

export function createFloatingPanelPointerController(
	args: PointerControllerArgs,
): FloatingPanelPointerController {
	const padding = args.padding ?? 0;
	let isDragging = false;
	let isResizing = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartPanelX = 0;
	let dragStartPanelY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	const onDrag = (event: MouseEvent) => {
		if (!isDragging) return;
		const state = args.getState();
		const deltaX = event.clientX - dragStartX;
		const deltaY = event.clientY - dragStartY;
		const maxX = Math.max(padding, window.innerWidth - state.width - padding);
		const maxY = Math.max(padding, window.innerHeight - 100 - padding);
		args.setState({
			...state,
			x: Math.max(padding, Math.min(dragStartPanelX + deltaX, maxX)),
			y: Math.max(padding, Math.min(dragStartPanelY + deltaY, maxY)),
		});
	};

	const onResize = (event: MouseEvent) => {
		if (!isResizing) return;
		const state = args.getState();
		const deltaX = event.clientX - resizeStartX;
		const deltaY = event.clientY - resizeStartY;
		const maxWidth = Math.max(
			args.minWidth,
			window.innerWidth - state.x - padding,
		);
		const maxHeight = Math.max(
			args.minHeight,
			window.innerHeight - state.y - padding,
		);
		args.setState({
			...state,
			width: Math.max(
				args.minWidth,
				Math.min(resizeStartWidth + deltaX, maxWidth),
			),
			height: Math.max(
				args.minHeight,
				Math.min(resizeStartHeight + deltaY, maxHeight),
			),
		});
	};

	const stopDrag = () => {
		isDragging = false;
		document.removeEventListener("mousemove", onDrag);
		document.removeEventListener("mouseup", stopDrag);
	};

	const stopResize = () => {
		isResizing = false;
		document.removeEventListener("mousemove", onResize);
		document.removeEventListener("mouseup", stopResize);
	};

	return {
		startDrag(event: MouseEvent) {
			isDragging = true;
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			const state = args.getState();
			dragStartPanelX = state.x;
			dragStartPanelY = state.y;
			document.addEventListener("mousemove", onDrag);
			document.addEventListener("mouseup", stopDrag);
		},
		startResize(event: MouseEvent) {
			isResizing = true;
			resizeStartX = event.clientX;
			resizeStartY = event.clientY;
			const state = args.getState();
			resizeStartWidth = state.width;
			resizeStartHeight = state.height;
			document.addEventListener("mousemove", onResize);
			document.addEventListener("mouseup", stopResize);
			event.preventDefault();
			event.stopPropagation();
		},
		stop() {
			stopDrag();
			stopResize();
		},
	};
}
