/**
 * The layout elements' host methods, callable from the moment the element
 * exists.
 *
 * A Svelte custom element defines each exported function as a getter over its
 * mounted component, and mounts a microtask after it connects, so until then the
 * method is `undefined` and calling it throws. The subclass this returns defines
 * every {@link SectionPlayerRuntimeHostContract} method itself. Once the
 * component is mounted each one delegates to it. Before that a read returns what
 * the element returns while its kernel is still binding, a navigation returns
 * `false`, and `waitForSectionController` waits for the toolkit's
 * `toolkit-ready` to bubble out of the element with the controller in place, or
 * for the timeout.
 *
 * It also wraps the `session` property: a read returns the assigned value until
 * the section's controller is published, and the controller's current session
 * after it.
 */

import type {
	SectionControllerHandle,
	SectionControllerSessionState,
} from "@pie-players/pie-assessment-toolkit";
import type {
	SectionPlayerRuntimeHostContract,
	SectionPlayerSnapshot,
} from "../../contracts/runtime-host-contract.js";
import { waitForToolkitReady } from "./toolkit-ready-wait.js";

export const BOOTSTRAP_SNAPSHOT = {
	composition: {
		itemsCount: 0,
		passagesCount: 0,
	},
	navigation: {
		currentIndex: 0,
		totalItems: 0,
		canNext: false,
		canPrevious: false,
	},
} as const satisfies SectionPlayerSnapshot;

type HostMethodName = keyof SectionPlayerRuntimeHostContract;

/**
 * For a layout element's `customElement.extend`. `unmountedSnapshot` is what
 * that element's `getSnapshot` returns while its kernel is not bound.
 */
export function withHostMethods(unmountedSnapshot: SectionPlayerSnapshot | null) {
	return <Base extends CustomElementConstructor>(ElementClass: Base) => {
		const mountedMethod = (
			element: HTMLElement,
			name: HostMethodName,
		): ((...args: unknown[]) => unknown) | null => {
			const method = Reflect.get(ElementClass.prototype, name, element);
			return typeof method === "function" ? method : null;
		};

		return class extends ElementClass {
			getSnapshot(): SectionPlayerSnapshot | null {
				const method = mountedMethod(this, "getSnapshot");
				return method
					? (method() as SectionPlayerSnapshot | null)
					: unmountedSnapshot;
			}

			navigateTo(index: number): boolean {
				return mountedMethod(this, "navigateTo")?.(index) === true;
			}

			navigateNext(): boolean {
				return mountedMethod(this, "navigateNext")?.() === true;
			}

			navigatePrevious(): boolean {
				return mountedMethod(this, "navigatePrevious")?.() === true;
			}

			getSectionController(): SectionControllerHandle | null {
				const method = mountedMethod(this, "getSectionController");
				return (method?.() as SectionControllerHandle | null) ?? null;
			}

			/**
			 * A fresh snapshot on each read once the controller is published. The
			 * item player instead returns the host's own object, kept current by
			 * projection; no host reads a section session by reference.
			 */
			get session(): SectionControllerSessionState | null {
				const published = this.getSectionController()?.getSession?.();
				if (published) return published;
				return (
					(Reflect.get(ElementClass.prototype, "session", this) as
						| SectionControllerSessionState
						| null
						| undefined) ?? null
				);
			}

			set session(value: SectionControllerSessionState | null) {
				Reflect.set(ElementClass.prototype, "session", value, this);
			}

			async waitForSectionController(
				timeoutMs = 5000,
			): Promise<SectionControllerHandle | null> {
				const deadline = Date.now() + timeoutMs;
				// Resolving the controller advances the player's stage, so the first
				// lookup waits a microtask: a host that calls this from a reactive
				// effect would otherwise read and write the player's state inside it.
				await Promise.resolve();
				const controller = this.getSectionController();
				if (controller) return controller;
				const remaining = deadline - Date.now();
				if (remaining <= 0) return null;
				return waitForToolkitReady(
					this,
					() => this.getSectionController(),
					remaining,
				);
			}
		};
	};
}
