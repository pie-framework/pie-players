export function coerceMode(value: string | null): 'gather' | 'view' | 'evaluate' {
	if (value === 'view' || value === 'evaluate') return value;
	return 'gather';
}

export function coerceRole(value: string | null): 'student' | 'instructor' {
	if (value === 'instructor') return value;
	return 'student';
}
