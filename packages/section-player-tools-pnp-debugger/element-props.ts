/** Inputs shared by the component and its native element declaration. */
export interface PnpDebuggerProps {
	sectionData: any;
	roleType: 'candidate' | 'scorer';
	editable?: boolean;
	toolkitCoordinator?: any;
	persistenceScope?: string;
	persistencePanelId?: string;
}
