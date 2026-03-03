export function coerceMode(
	value: string | null,
	role: "student" | "instructor" = "student",
): "gather" | "view" | "evaluate" {
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
