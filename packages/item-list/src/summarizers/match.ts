import { idOf, promptOf, records, summarizer, text } from "./shared.js";

/** One part per row; its answer is the column, or columns, the row takes. */
export const match = summarizer((model) => {
	const headers = Array.isArray(model.headers) ? model.headers.map((header) => text(header) ?? "") : [];
	return {
		prompt: promptOf(model),
		parts: records(model.rows).map((row, index) => {
			const values = Array.isArray(row.values) ? row.values : [];
			// `values[j]` answers the column headed `headers[j + 1]`; `headers[0]` heads the rows.
			const columns = values.flatMap((value, column) => (value === true ? headers[column + 1] || [] : []));
			return {
				id: idOf(row.id, index),
				prompt: text(row.title),
				...(columns.length > 0 ? { answer: columns.join(", ") } : {}),
			};
		}),
	};
});
