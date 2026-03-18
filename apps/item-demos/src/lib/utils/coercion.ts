export function coerceMode(
	value: string | null,
	role: "student" | "instructor" = "student",
): "gather" | "view" | "evaluate" {
	// `browse` is legacy compatibility mode; map it to the current read-only `view` semantics.
	if (value === "browse") {
		return "view";
	}
	if (value === "evaluate" && role !== "instructor") {
		return "gather";
	}
	if (value === "view" || value === "evaluate") return value;
	return "gather";
}

export function coerceRole(value: string | null): "student" | "instructor" {
	if (value === "instructor") return value;
	return "student";
}
