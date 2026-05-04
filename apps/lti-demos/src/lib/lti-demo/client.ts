import type {
	AssessmentSessionSnapshot,
	VerifiedLtiLaunchContext,
} from "./types";

function sessionQuery(assessmentId: string, attemptId: string): string {
	return new URLSearchParams({ assessmentId, attemptId }).toString();
}

export async function loadVerifiedLaunchContext(
	options: { newAttempt?: boolean } = {},
): Promise<VerifiedLtiLaunchContext> {
	const query = options.newAttempt ? "?newAttempt=true" : "";
	const response = await fetch(`/api/lti-demo/launch${query}`, {
		cache: "no-store",
	});
	if (!response.ok) {
		throw new Error(`Failed to load mock LTI launch (${response.status})`);
	}
	const payload = await response.json();
	if (!payload?.launchContext) {
		throw new Error("Mock LTI launch response did not include launchContext");
	}
	return payload.launchContext as VerifiedLtiLaunchContext;
}

export async function loadAssessmentSessionSnapshot(args: {
	assessmentId: string;
	attemptId: string;
}): Promise<AssessmentSessionSnapshot | null> {
	const response = await fetch(
		`/api/lti-demo/session?${sessionQuery(args.assessmentId, args.attemptId)}`,
		{ cache: "no-store" },
	);
	if (!response.ok) return null;
	const payload = await response.json().catch(() => ({}));
	return (payload?.snapshot as AssessmentSessionSnapshot | null) || null;
}

export async function saveAssessmentSessionSnapshot(args: {
	assessmentId: string;
	attemptId: string;
	snapshot: AssessmentSessionSnapshot | null;
}): Promise<void> {
	const response = await fetch("/api/lti-demo/session", {
		method: "PUT",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(args),
	});
	if (!response.ok) {
		throw new Error(`Failed to save LTI demo session (${response.status})`);
	}
}

export async function deleteAssessmentSessionSnapshot(args: {
	assessmentId: string;
	attemptId: string;
}): Promise<void> {
	const response = await fetch(
		`/api/lti-demo/session?${sessionQuery(args.assessmentId, args.attemptId)}`,
		{ method: "DELETE" },
	);
	if (!response.ok) {
		throw new Error(`Failed to delete LTI demo session (${response.status})`);
	}
}
