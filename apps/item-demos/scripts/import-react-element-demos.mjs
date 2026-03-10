import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemDemosRoot = path.resolve(__dirname, "..");
const elementsRoot = path.resolve(itemDemosRoot, "../../../pie-elements-ng/packages/elements-react");
const outputPath = path.resolve(
	itemDemosRoot,
	"src/lib/content/react-demos.generated.json",
);

function slugify(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function humanizePackageName(packageName) {
	const acronyms = new Set(["ebsr"]);
	return packageName
		.split("-")
		.map((part) =>
			acronyms.has(part.toLowerCase())
				? part.toUpperCase()
				: part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join(" ");
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value) {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&#8217;/gi, "'")
		.replace(/&#8220;/gi, '"')
		.replace(/&#8221;/gi, '"');
}

function stripMarkup(value) {
	return decodeHtmlEntities(String(value || ""))
		.replace(/<math[\s\S]*?<\/math>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\{\{[^}]+\}\}/g, " ")
		.replace(/\\\([^)]+\\\)/g, " ")
		.replace(/\\\[[^\]]+\\\]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function sentenceCase(value) {
	if (!value) return value;
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncateWords(value, maxWords = 8) {
	const words = value.split(/\s+/).filter(Boolean);
	return words.slice(0, maxWords).join(" ").trim();
}

function cleanPromptPrefix(value) {
	return value
		.replace(/^(question|prompt|problem|task)\s*:\s*/i, "")
		.replace(/^(part\s+[a-z0-9]+[.)]?\s*)/i, "")
		.replace(/^[a-z][.)]\s+/i, "")
		.trim();
}

function derivePromptLabel(rawPrompt) {
	const plain = cleanPromptPrefix(stripMarkup(rawPrompt));
	if (!plain) return "";

	if (
		/^(this is the question prompt|select correct answers\.?|default demo)$/i.test(plain)
	) {
		return "";
	}

	const sentences = plain
		.split(/(?<=[.?!])\s+/)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
	const preferredSentence =
		sentences.find((sentence) =>
			/\b(drag|drop|match|graph|plot|shade|choose|select|complete|find|which)\b/i.test(sentence),
		) ||
		sentences.find((sentence) => sentence.split(/\s+/).length <= 14) ||
		sentences[0] ||
		plain;

	const trimmed = truncateWords(preferredSentence, 8);
	return sentenceCase(trimmed.replace(/[.:;,-]+$/, ""));
}

function isGenericDemoName(name, packageName) {
	const normalized = String(name || "").trim().toLowerCase();
	if (!normalized) return true;
	if (normalized === "default demo") return true;
	if (normalized === humanizePackageName(packageName).toLowerCase()) return true;
	if (normalized === `${humanizePackageName(packageName).toLowerCase()} demo`) return true;
	return false;
}

function deriveNameFromModel(packageName, model) {
	const promptLabel = derivePromptLabel(model?.prompt);
	if (promptLabel) return promptLabel;

	const stimulusLabel = derivePromptLabel(model?.stimulus);
	if (stimulusLabel) return stimulusLabel;

	const nestedPromptLabel =
		derivePromptLabel(model?.partA?.prompt) ||
		derivePromptLabel(model?.partB?.prompt) ||
		derivePromptLabel(model?.prompts?.[0]?.prompt);
	if (nestedPromptLabel) return nestedPromptLabel;

	if (Array.isArray(model?.passages) && model.passages.length > 0) {
		const firstTitle = model.passages.find((passage) => stripMarkup(passage?.title))?.title;
		if (firstTitle) return stripMarkup(firstTitle);
	}

	if (Array.isArray(model?.prompts) && model.prompts.length > 0) {
		const promptTitle = model.prompts.find((prompt) => stripMarkup(prompt?.title))?.title;
		if (promptTitle) return stripMarkup(promptTitle);
	}

	if (Array.isArray(model?.choices) && model.choices.length > 0) {
		const firstChoice = model.choices.find((choice) => stripMarkup(choice?.label || choice?.content));
		if (firstChoice) {
			return `${humanizePackageName(packageName)}: ${truncateWords(stripMarkup(firstChoice.label || firstChoice.content), 5)}`;
		}
	}

	if (Array.isArray(model?.headers) && model.headers.length > 0) {
		return `${humanizePackageName(packageName)}: ${truncateWords(stripMarkup(model.headers.join(" / ")), 5)}`;
	}

	if (Array.isArray(model?.rowLabels) && model.rowLabels.length > 0) {
		return `${humanizePackageName(packageName)}: ${truncateWords(stripMarkup(model.rowLabels[0]), 6)}`;
	}

	if (Array.isArray(model?.scales) && model.scales.length > 0) {
		const firstTrait = model.scales[0]?.traits?.[0]?.name;
		if (firstTrait) {
			return `${humanizePackageName(packageName)}: ${stripMarkup(firstTrait)}`;
		}
	}

	if (model?.rubricType) {
		return `${humanizePackageName(packageName)}: ${sentenceCase(model.rubricType.replace(/([A-Z])/g, " $1").trim())}`;
	}

	return humanizePackageName(packageName);
}

function clone(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getElementTagName(packageName) {
	return packageName.includes("-") ? packageName : `${packageName}-element`;
}

function normalizeSessionEntry(entry, modelId, elementName) {
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		return { id: modelId, element: elementName, value: entry };
	}

	return {
		...entry,
		id: modelId,
		element: elementName,
	};
}

function isStructuralOnlySessionEntry(entry) {
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		return false;
	}

	const keys = Object.keys(entry);
	return keys.length > 0 && keys.every((key) => key === "id" || key === "element");
}

function normalizeInitialSession({
	demoId,
	modelId,
	elementName,
	demoSession,
	sessionTemplate,
}) {
	const source = demoSession ?? sessionTemplate ?? [];

	if (Array.isArray(source) && source.every((entry) => isStructuralOnlySessionEntry(entry))) {
		return {
			id: `${demoId}-session`,
			data: [],
		};
	}

	if (isStructuralOnlySessionEntry(source)) {
		return {
			id: `${demoId}-session`,
			data: [],
		};
	}

	if (source && typeof source === "object" && !Array.isArray(source) && Array.isArray(source.data)) {
		return {
			id:
				typeof source.id === "string" && source.id
					? source.id
					: `${demoId}-session`,
			data: source.data.map((entry) => normalizeSessionEntry(entry, modelId, elementName)),
		};
	}

	if (Array.isArray(source)) {
		return {
			id: `${demoId}-session`,
			data: source.map((entry) => normalizeSessionEntry(entry, modelId, elementName)),
		};
	}

	if (source && typeof source === "object") {
		return {
			id: `${demoId}-session`,
			data: [normalizeSessionEntry(source, modelId, elementName)],
		};
	}

	return {
		id: `${demoId}-session`,
		data: [],
	};
}

function toVariantList(packageName, configModule) {
	if (Array.isArray(configModule?.demos)) {
		return configModule.demos.map((demo, index) => ({
			...demo,
			__variantIndex: index,
		}));
	}

	if (Array.isArray(configModule?.models)) {
		return configModule.models.map((model, index) => ({
			id: model?.id || "default",
			title:
				index === 0
					? humanizePackageName(packageName)
					: `${humanizePackageName(packageName)} ${index + 1}`,
			description: `${humanizePackageName(packageName)} demo`,
			model,
			__variantIndex: index,
		}));
	}

	return [];
}

async function importDefaultIfExists(filePath) {
	try {
		await fs.access(filePath);
		const moduleUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
		const loaded = await import(moduleUrl);
		return loaded.default;
	} catch {
		return undefined;
	}
}

async function collectReactDemos() {
	const dirents = await fs.readdir(elementsRoot, { withFileTypes: true });
	const packageNames = dirents
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));

	const demos = [];

	for (const packageName of packageNames) {
		const demoDir = path.join(elementsRoot, packageName, "docs/demo");
		const configPath = path.join(demoDir, "config.mjs");
		const configModule = await importDefaultIfExists(configPath);

		if (!configModule) {
			continue;
		}

		const sessionTemplate = await importDefaultIfExists(path.join(demoDir, "session.mjs"));
		const tagName = getElementTagName(packageName);
		const packageRef = `@pie-element/${packageName}@latest`;
		const variants = toVariantList(packageName, configModule);

		for (const variant of variants) {
			const model = clone(variant.model);
			if (!model || typeof model !== "object") {
				continue;
			}

			const modelId =
				typeof model.id === "string" && model.id ? model.id : `${packageName}-model`;
			model.element =
				typeof model.element === "string" && model.element ? model.element : packageName;

			const rawVariantId = variant.id || modelId || `demo-${variant.__variantIndex + 1}`;
			const variantId = slugify(rawVariantId) || `demo-${variant.__variantIndex + 1}`;
			const demoId = `${packageName}-${variantId}`;
			const variantName = variant.title || variant.name || humanizePackageName(packageName);
			const name = isGenericDemoName(variantName, packageName)
				? deriveNameFromModel(packageName, model)
				: variantName;
			const description =
				variant.description ||
				`${humanizePackageName(packageName)} demo`;

			demos.push({
				id: demoId,
				name,
				description,
				sourcePackage: packageName,
				sourceVariantId: String(rawVariantId),
				tags: Array.isArray(variant.tags) ? variant.tags : [],
				initialSession: normalizeInitialSession({
					demoId,
					modelId,
					elementName: model.element,
					demoSession: clone(variant.session),
					sessionTemplate: clone(sessionTemplate),
				}),
				item: {
					id: demoId,
					name,
					config: {
						id: "",
						markup: `<${tagName} id="${modelId}"></${tagName}>`,
						elements: {
							[tagName]: packageRef,
						},
						models: [model],
					},
				},
			});
		}
	}

	return demos.sort((left, right) => {
		const pkgCompare = left.sourcePackage.localeCompare(right.sourcePackage);
		return pkgCompare === 0 ? left.id.localeCompare(right.id) : pkgCompare;
	});
}

async function main() {
	const demos = await collectReactDemos();
	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await fs.writeFile(outputPath, `${JSON.stringify(demos, null, 2)}\n`, "utf8");
	console.log(`Wrote ${demos.length} demos to ${path.relative(itemDemosRoot, outputPath)}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
