import { LTI_DEMO_ASSESSMENT_ID } from "$lib/content/lti-assessment";
import type { VerifiedLtiLaunchContext } from "$lib/lti-demo/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const DEMO_PLATFORM_ISSUER = "https://lms.example.edu";
const DEMO_DEPLOYMENT_ID = "deployment-pie-demo";
const DEMO_CONTEXT_ID = "course-civics-101";
const DEMO_RESOURCE_LINK_ID = "resource-link-lti-launch-demo";
const DEMO_USER_ID = "student-demo-42";

function createAttemptId(newAttempt: boolean): string {
	const base = `${DEMO_PLATFORM_ISSUER}:${DEMO_DEPLOYMENT_ID}:${DEMO_CONTEXT_ID}:${DEMO_RESOURCE_LINK_ID}:${DEMO_USER_ID}`;
	const suffix = newAttempt ? Date.now().toString(36) : "current";
	return `lti-attempt-${Buffer.from(`${base}:${suffix}`).toString("base64url")}`;
}

export const GET: RequestHandler = ({ url }) => {
	const newAttempt = url.searchParams.get("newAttempt") === "true";
	const launchContext: VerifiedLtiLaunchContext = {
		platformIssuer: DEMO_PLATFORM_ISSUER,
		deploymentId: DEMO_DEPLOYMENT_ID,
		contextId: DEMO_CONTEXT_ID,
		contextTitle: "Civics 101",
		resourceLinkId: DEMO_RESOURCE_LINK_ID,
		resourceTitle: "LTI Launch Integration Demo",
		userId: DEMO_USER_ID,
		userDisplayName: "Demo Student",
		roles: ["Learner"],
		assessmentId: LTI_DEMO_ASSESSMENT_ID,
		attemptId: createAttemptId(newAttempt),
		launchedAt: new Date().toISOString(),
	};

	return json({ ok: true, launchContext });
};
