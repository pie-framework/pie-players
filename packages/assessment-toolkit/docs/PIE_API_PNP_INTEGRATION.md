# PIE API PNP Integration Plan

Recommendations for integrating Personal Needs Profile (PNP) support into pie-api-aws based on architecture analysis.

## Executive Summary

**Recommendation**: Make PNP a **first-class citizen** with explicit TypeScript types and database schema structure.

**What "First-Class Citizen" Means**:

- **Explicit TypeScript interfaces** defining PNP structure (not just `[key: string]: any`)
- **Visible database schema fields** showing PNP as intentional, documented structure
- **Type-safe APIs** with proper GraphQL types for PNP-specific operations
- **Clear intent in codebase** - developers know PNP exists and how to use it

**Current State**:

- `settings` field exists on Assessment, Question, Section as untyped `Object`
- `SettingsMetaDataEntity` interface has `settings?: SettingsMetaData` where `SettingsMetaData = { [key: string]: any }`
- No PNP-specific types or structure visible in the codebase

**Why NOT searchMetaData**:

- Already indexed for search (PNP doesn't need indexing)
- Loose typing and mixed purposes (reporting, external IDs, imports)
- Hard to distinguish PNP data from other metadata

**Proposed Approach**:

1. Create explicit PNP TypeScript interfaces
2. Replace generic `SettingsMetaData` with structured types that include PNP
3. Add PNP-specific fields to Organization (district defaults)
4. Extend Item and Passage schemas to include settings
5. Create PNP-specific GraphQL types and operations

## First-Class PNP Type System

To make PNP a first-class citizen, we define explicit TypeScript interfaces that are visible throughout the codebase:

```typescript
// packages/datastore/src/types/pnp.types.ts (NEW FILE)

/**
 * QTI 3.0 Personal Needs Profile (PNP) type definitions
 *
 * These types make PNP configuration visible and type-safe across the entire codebase.
 * All PNP fields use QTI 3.0 standard access feature IDs from IMS AfA 3.0 specification.
 *
 * @see https://www.imsglobal.org/spec/qti/v3p0
 * @see https://www.imsglobal.org/spec/afa/v3p0
 */

/**
 * District-level PNP defaults and policies
 * Set by district administrators, applies to all assessments in the organization
 */
export interface OrganizationPNPDefaults {
  /** District-level governance rules (absolute veto and requirements) */
  districtPolicy?: {
    /** Tools blocked by district policy (e.g., state test rules) */
    blockedTools?: string[];     // QTI 3.0 feature IDs
    /** Tools required by district policy (e.g., ELL mandates) */
    requiredTools?: string[];    // QTI 3.0 feature IDs
  };

  /** Default PNP features for new assessments in this district */
  defaultFeatures?: string[];    // QTI 3.0 feature IDs

  /** District-wide tool provider configurations */
  toolConfigs?: Record<string, ToolConfig>;
}

/**
 * Assessment-level PNP configuration
 * Defines which accessibility features are available for the entire assessment
 */
export interface AssessmentPNPSettings {
  /** QTI 3.0 PNP features enabled for this assessment */
  supports?: string[];          // QTI 3.0 feature IDs

  /** Features explicitly prohibited for this assessment */
  prohibitedSupports?: string[];

  /** Features to auto-activate when assessment starts */
  activateAtInit?: string[];

  /** Test administration session control */
  testAdministration?: {
    /** Testing mode: practice, test, or benchmark */
    mode?: "practice" | "test" | "benchmark";
    /** Session-specific tool overrides (proctor control) */
    toolOverrides?: Record<string, boolean>;
    /** Testing window */
    startDate?: string;
    endDate?: string;
  };

  /** Tool provider configurations (TTS, calculator, etc.) */
  toolConfigs?: Record<string, ToolConfig>;
}

/**
 * Section-level PNP settings
 * Inherits from assessment but can override for specific sections
 */
export interface SectionPNPSettings {
  /** Override PNP features for this section only */
  supports?: string[];

  /** Block tools for this section (e.g., calculator on mental math section) */
  restrictedTools?: string[];

  /** Require tools for this section (e.g., graph on coordinate geometry section) */
  requiredTools?: string[];

  /** Section-specific tool configurations */
  toolParameters?: Record<string, any>;
}

/**
 * Item/Passage-level PNP settings
 * Per-item accessibility requirements/restrictions
 */
export interface ItemPNPSettings {
  /** Tools required for this specific item */
  requiredTools?: string[];

  /** Tools blocked for this specific item */
  restrictedTools?: string[];

  /** Item-specific tool parameters (e.g., calculator type: basic vs scientific) */
  toolParameters?: Record<string, any>;
}

/**
 * Student-level PNP profile (from IEP/504)
 * This is stored in Session or User context, not in content
 */
export interface StudentPNPProfile {
  /** Student's documented accessibility needs */
  supports?: string[];          // QTI 3.0 feature IDs

  /** Features explicitly prohibited for this student */
  prohibitedSupports?: string[];

  /** Features to auto-activate for this student */
  activateAtInit?: string[];
}

/**
 * Tool-specific configuration
 * Generic structure for tool provider settings
 */
export interface ToolConfig {
  provider?: string;
  [key: string]: any;  // Tool-specific options
}

// Re-export for convenience
export type PNPFeatureId = string;  // QTI 3.0 standard access feature ID
```

Now update the base types to use these explicit interfaces:

```typescript
// packages/datastore/src/types.ts (UPDATED)
import type {
  AssessmentPNPSettings,
  SectionPNPSettings,
  ItemPNPSettings,
  OrganizationPNPDefaults
} from './types/pnp.types';

/**
 * DEPRECATED: Use specific typed settings instead
 * This interface remains for backward compatibility but new code should
 * use explicit types like AssessmentPNPSettings
 */
export interface SettingsMetaData {
  pnp?: AssessmentPNPSettings | SectionPNPSettings | ItemPNPSettings;
  [key: string]: any;  // Allow other settings
}

/**
 * Entities that contain settings metadata (NOT indexed for search)
 */
export interface SettingsMetaDataEntity {
  settings?: SettingsMetaData;
}
```

**Key Design Principles**:

- **Optional Everywhere**: All PNP fields are optional (`?:`) - works without any PNP configuration
- **Sensible Defaults**: Assessment Toolkit provides K-12 defaults when no PNP is configured
- **Progressive Enhancement**: Add PNP configuration only where needed (district → assessment → section → item)
- **Discoverability**: Developers see `pnp?: AssessmentPNPSettings` in autocomplete
- **Type Safety**: TypeScript catches invalid PNP structure at compile time
- **Documentation**: JSDoc comments explain what each field means and references QTI 3.0 specs
- **Backward Compatible**: Existing untyped `settings` still works via `[key: string]: any`

**Default Behavior (No PNP Configured)**:

When no PNP configuration exists at any level, the Assessment Toolkit provides sensible K-12 defaults:

- Basic accessibility tools enabled: TTS, magnifier, highlighter, answer eliminator
- Calculator enabled by default (unless content author explicitly restricts)
- No district policy restrictions
- No test administration overrides
- Standard tool configurations (browser TTS, basic calculator)

This ensures that assessments work out-of-the-box for K-12 education without requiring PNP configuration.

## Integration Points Analysis

### 1. **Organization Level (District Defaults)**

**Current State**: `OrganizationEntity` has no PNP or settings field

**Recommendation**: Add explicit `pnpDefaults` field with typed interface

```typescript
// packages/datastore/src/schemas/Organization.schema.ts
import type { OrganizationPNPDefaults } from '../types/pnp.types';

export interface OrganizationEntity extends BaseEntity {
  name: string;
  defaultCollection?: string | CollectionEntity;
  pnpDefaults?: OrganizationPNPDefaults; // NEW: Explicit PNP field
}

export const OrganizationSchema = new Schema<OrganizationEntity>({
  name: { type: String, required: true },
  defaultCollection: { type: String, ref: 'Collection' },
  pnpDefaults: { type: Object, required: false }, // NEW
});
```

**Use Case**: District administrator sets defaults for all assessments in the district

**Data Flow**:
```
Organization.pnpDefaults
  ↓ (used as seed when creating new assessments)
Assessment.settings.pnp
  ↓ (inherited by sections unless overridden)
Section.settings.pnp
```

### 2. **Assessment/ActivityDefinition Level**

**Current State**:

- `AssessmentEntity` has generic `settings?: Object` field ✅
- `ActivityDefinitionEntity` has NO `settings` field ❌

**Recommendation**: Add explicit PNP typing to Assessment, add `settings` to ActivityDefinition

```typescript
// packages/datastore/src/schemas/Assessment.schema.ts
import type { AssessmentPNPSettings } from '../types/pnp.types';

// Update interface to show explicit PNP structure
export interface AssessmentEntity extends BaseEntity, SearchMetaDataEntity {
  name?: string;
  questions?: QuestionEntity[];
  sections?: AssessmentSection[];
  settings?: {
    pnp?: AssessmentPNPSettings;  // NEW: Explicit PNP type
    [key: string]: any;            // Allow other settings
  };
}

// Schema remains flexible but developers see typed interface
export const AssessmentSchema = new Schema<AssessmentEntity>({
  // ... existing fields
  settings: { type: Object, required: false },  // Existing - no breaking change
});

// packages/datastore/src/schemas/ActivityDefinition.schema.ts
export interface ActivityDefinitionEntity extends BaseEntity, SearchMetaDataEntity {
  identifier: string;
  itemVIds: string[];
  settings?: {                          // NEW field
    pnp?: AssessmentPNPSettings;        // NEW: Explicit PNP type
    [key: string]: any;
  };
  searchMetaData?: any;
}

export const ActivityDefinitionSchema = new Schema<ActivityDefinitionEntity>({
  // ... existing fields
  settings: { type: Object, required: false },  // NEW
});
```

**Use Case**: Assessment author configures which tools are available for entire assessment

### 3. **Section Level**

**Current State**: `AssessmentSection` has generic `settings` field ✅

**Recommendation**: Add explicit PNP typing to section interface

```typescript
// packages/datastore/src/schemas/Assessment.schema.ts
import type { SectionPNPSettings } from '../types/pnp.types';

export interface AssessmentSection extends SearchMetaDataEntity {
  id?: string;
  title?: string;
  questions: SectionQuestionRef[];
  settings?: {
    pnp?: SectionPNPSettings;     // NEW: Explicit PNP type
    [key: string]: any;           // Allow other settings
  };
}
```

**Use Case**: Section 1 allows calculator, Section 2 (mental math) blocks it

### 4. **Item/Passage Level (Content Settings)**

**Current State**:

- `ItemEntity` has NO `settings` field ❌
- `PassageEntity` has NO `settings` field ❌
- Both have only `searchMetaData` ❌

**Recommendation**: Add `settings` field with explicit PNP typing

```typescript
// packages/datastore/src/schemas/Item.schema.ts
import type { ItemPNPSettings } from '../types/pnp.types';

export interface ItemEntity extends VersionEntity, ConfigContainerEntity, SearchMetaDataEntity {
  name?: string;
  passage?: string | PassageEntity;
  config: ConfigEntity;
  settings?: {                  // NEW field
    pnp?: ItemPNPSettings;      // NEW: Explicit PNP type
    [key: string]: any;
  };
  retired?: boolean;
  published?: boolean;
  searchMetaData?: any;
}

export const ItemSchema = new Schema<ItemEntity>({
  // ... existing fields
  settings: { type: Object, required: false },  // NEW
});

// packages/datastore/src/schemas/Passage.schema.ts
export interface PassageEntity extends VersionEntity, ConfigContainerEntity, SearchMetaDataEntity {
  name?: string;
  config: ConfigEntity;
  settings?: {                  // NEW field
    pnp?: ItemPNPSettings;      // NEW: Same as Item
    [key: string]: any;
  };
  searchMetaData?: any;
}

export const PassageSchema = new Schema<PassageEntity>({
  // ... existing fields
  settings: { type: Object, required: false },  // NEW
});
```

**Use Case**: Item author requires calculator for computation question, blocks TTS for reading comprehension

**Why First-Class**:
- Clear semantics (not mixed with search metadata)
- Can version with item (part of item identity)
- Type-safe with schema validation
- Aligns with QTI 3.0 item-level accessibility settings

### 5. **Session Level (Student-Specific)**

**Current State**: `SessionEntity` is minimal, per-item only

**Critical Decision Point**: Session architecture needs clarification

**Option A: Extend Existing Item Session**
```typescript
// packages/datastore/src/schemas/Session.schema.ts
interface SessionEntity extends BaseEntity {
  item: string | ItemEntity;
  organization?: string | OrganizationEntity;
  assignment?: string | AssignmentEntity;
  student?: string | UserEntity; // NEW: Make explicit
  pnpProfile?: StudentPNPProfile; // NEW: Student's IEP/504 profile
  pnpSource?: 'student' | 'section' | 'assessment' | 'organization'; // NEW: Track origin
}

interface StudentPNPProfile {
  // Student's documented accessibility needs (from IEP/504)
  supports: string[];           // QTI 3.0 feature IDs
  prohibitedSupports?: string[]; // Features NOT allowed for this student
  activateAtInit?: string[];    // Auto-activate these features

  // Session-specific overrides
  sessionOverrides?: {
    enabled?: string[];
    disabled?: string[];
  };
}
```

**Option B: Create Assessment/Section Session Concept**
```typescript
// NEW: packages/datastore/src/schemas/AssessmentSession.schema.ts
interface AssessmentSessionEntity extends BaseEntity {
  assessment: string | AssessmentEntity | ActivityDefinitionEntity;
  organization: string | OrganizationEntity;
  assignment?: string | AssignmentEntity;
  student: string | UserEntity;
  pnpProfile?: StudentPNPProfile; // Student's PNP for this assessment attempt
  itemSessions: string[];         // References to individual item sessions
  startedAt?: Date;
  completedAt?: Date;
}

// Link item sessions to assessment session
interface SessionEntity extends BaseEntity {
  item: string | ItemEntity;
  assessmentSession?: string | AssessmentSessionEntity; // NEW: Parent session
  // ... existing fields
}
```

**Recommendation**: **Option A for now, Option B later if needed**

- Option A is simpler and works with current per-item session model
- Option B requires significant architectural changes
- Can migrate A → B later without breaking changes

## Optional Configuration with Sensible Defaults

**Critical Design Principle**: PNP configuration is **optional at every level**.

The Assessment Toolkit must work perfectly for K-12 education without requiring any PNP configuration. This means:

### When Nothing Is Configured

If an integrator uses pie-api-aws and assessment-toolkit without configuring any PNP fields:

- ✅ **Organization** has no `pnpDefaults` → System defaults used
- ✅ **Assessment** has no `settings.pnp` → System defaults used
- ✅ **Section** has no `settings.pnp` → Inherits from assessment (or system defaults)
- ✅ **Item** has no `settings.pnp` → No item-level restrictions, all defaults available
- ✅ **Session** has no `pnpProfile` → Student gets system defaults

**Result**: Basic accessibility tools (TTS, magnifier, highlighter, answer eliminator, calculator) work immediately.

### Progressive Enhancement

Integrators add PNP configuration **only where needed**:

```typescript
// Level 1: No PNP anywhere - uses system defaults
const assessment1 = {
  name: "Default Assessment",
  sections: [{ items: [...] }]
  // No settings.pnp - uses system defaults
};

// Level 2: District sets policy for all assessments
const organization = {
  name: "Springfield School District",
  pnpDefaults: {
    districtPolicy: {
      blockedTools: ['calculator']  // District rule: no calculators on state tests
    }
  }
};

// Level 3: Assessment overrides for specific test
const assessment2 = {
  name: "Practice Test",
  settings: {
    pnp: {
      testAdministration: {
        mode: 'practice'  // Enable all tools in practice mode
      }
    }
  }
};

// Level 4: Item-level restrictions
const item = {
  href: "mental-math-question",
  settings: {
    pnp: {
      restrictedTools: ['calculator']  // This specific item blocks calculator
    }
  }
};
```

### Fallback Chain

```text
System Defaults (always present)
    ↑ (fallback)
Organization PNP Defaults (optional)
    ↑ (fallback)
Assessment PNP Settings (optional)
    ↑ (fallback)
Section PNP Settings (optional)
    ↑ (override per-item)
Item PNP Settings (optional)
```

**Key Point**: The chain starts with **sensible defaults** and adds configuration only where governance or content requirements demand it.

## PNP Resolution Service

Create centralized resolution service:

```typescript
// packages/services/src/services/Pnp.service.ts
export class PnpService {
  constructor(
    private datastore: DatastoreService,
    private cache: CacheService
  ) {}

  /**
   * Resolve effective PNP profile for a session
   *
   * Implements waterfall precedence with sensible K-12 defaults.
   * ALL LEVELS ARE OPTIONAL - defaults provided when nothing configured.
   */
  async resolveSessionPnp(sessionId: string): Promise<ResolvedPNPProfile> {
    // 1. Load session (optional)
    const session = await this.datastore.sessions.get(sessionId);
    if (session.pnpProfile) {
      return { profile: session.pnpProfile, source: 'session' };
    }

    // 2. Load assessment/activity definition (optional)
    const assessment = await this.getAssessmentForSession(session);
    if (assessment?.settings?.pnp) {
      return { profile: assessment.settings.pnp, source: 'assessment' };
    }

    // 3. Load organization defaults (optional)
    if (session.organization) {
      const org = await this.datastore.organizations.get(session.organization);
      if (org?.pnpDefaults) {
        return { profile: org.pnpDefaults, source: 'organization' };
      }
    }

    // 4. System defaults (always available)
    // Provides sensible K-12 defaults when nothing else configured
    return { profile: this.getSystemDefaults(), source: 'system' };
  }

  /**
   * System-level K-12 defaults
   *
   * These defaults ensure assessments work out-of-the-box without
   * requiring any PNP configuration.
   */
  private getSystemDefaults(): AssessmentPNPSettings {
    return {
      // Basic accessibility tools enabled by default
      supports: [
        'textToSpeech',
        'magnification',
        'highlighting',
        'answerEliminator',
        'calculator',
        'lineReader',
      ],

      // Standard tool configurations
      toolConfigs: {
        tts: {
          provider: 'browser',  // Use browser built-in TTS
          rate: 1.0,
        },
        calculator: {
          provider: 'browser',  // Use browser calculator component
          type: 'basic',
        },
      },
    };
  }

  /**
   * Merge PNP profiles with precedence rules
   * Applies PIE Player's precedence hierarchy
   */
  mergePnpProfiles(
    sessionProfile?: StudentPNPProfile,
    assessmentProfile?: AssessmentPNPSettings,
    orgProfile?: OrganizationPNPDefaults
  ): MergedPNPProfile {
    // Implement PIE Player precedence hierarchy:
    // 1. District blocks (from org)
    // 2. Test admin overrides (from assessment)
    // 3. Item restrictions (from item.settings - handled separately)
    // 4. Item requirements (from item.settings - handled separately)
    // 5. District requirements (from org)
    // 6. PNP supports (from session/student)

    const blocked = new Set(orgProfile?.districtPolicy?.blockedTools || []);
    const required = new Set(orgProfile?.districtPolicy?.requiredTools || []);
    const requested = new Set(sessionProfile?.supports || []);

    // Apply precedence
    const allowed = new Set<string>();

    // Add required tools (district requirement)
    required.forEach(id => allowed.add(id));

    // Add requested tools (if not blocked)
    requested.forEach(id => {
      if (!blocked.has(id)) {
        allowed.add(id);
      }
    });

    // Apply test admin overrides
    const overrides = assessmentProfile?.testAdministration?.toolOverrides || {};
    Object.entries(overrides).forEach(([toolId, enabled]) => {
      if (enabled) {
        allowed.add(toolId);
      } else {
        allowed.delete(toolId);
      }
    });

    return {
      allowedFeatures: Array.from(allowed),
      blockedFeatures: Array.from(blocked),
      requiredFeatures: Array.from(required),
      toolConfigs: {
        ...orgProfile?.toolConfigs,
        ...assessmentProfile?.toolConfigs
      }
    };
  }
}
```

## GraphQL API Design

### Types

```graphql
# QTI 3.0 PNP Profile Types
type PersonalNeedsProfile {
  supports: [String!]!
  prohibitedSupports: [String]
  activateAtInit: [String]
}

type OrganizationPNPDefaults {
  districtPolicy: DistrictPolicy
  defaultFeatures: [String!]
  toolConfigs: ToolConfigsJSON
}

type DistrictPolicy {
  blockedTools: [String!]
  requiredTools: [String!]
}

type AssessmentPNPSettings {
  supports: [String!]
  testAdministration: TestAdministration
  toolConfigs: ToolConfigsJSON
}

type TestAdministration {
  mode: TestMode
  toolOverrides: ToolOverridesJSON
}

enum TestMode {
  PRACTICE
  TEST
  BENCHMARK
}

type ItemPNPSettings {
  requiredTools: [String!]
  restrictedTools: [String!]
  toolParameters: ToolParametersJSON
}

# Use JSON scalars for flexible configuration
scalar ToolConfigsJSON
scalar ToolOverridesJSON
scalar ToolParametersJSON
```

### Queries

```graphql
extend type Query {
  # Resolve effective PNP for a session
  resolveSessionPnp(sessionId: ID!): ResolvedPNPProfile!

  # Get org defaults
  organizationPnpDefaults(organizationId: ID!): OrganizationPNPDefaults

  # List standard QTI 3.0 features (from pnp-standard-features.ts)
  listStandardAccessFeatures(category: String): [AccessFeature!]!
}

type ResolvedPNPProfile {
  profile: PersonalNeedsProfile!
  source: PNPSource!
  precedence: PrecedenceTrace!
}

enum PNPSource {
  SESSION
  SECTION
  ASSESSMENT
  ORGANIZATION
  SYSTEM
}

type PrecedenceTrace {
  allowedFeatures: [String!]!
  blockedFeatures: [String!]!
  requiredFeatures: [String!]!
  precedenceApplied: [PrecedenceRule!]!
}

type PrecedenceRule {
  level: String!
  feature: String!
  action: String!
  reason: String!
}
```

### Mutations

```graphql
extend type Mutation {
  # Organization level (district defaults)
  setOrganizationPnpDefaults(
    organizationId: ID!
    pnpDefaults: OrganizationPNPDefaultsInput!
  ): Organization!

  # Assessment level
  updateAssessmentPnp(
    assessmentId: ID!
    pnp: AssessmentPNPSettingsInput!
  ): Assessment!

  # Section level
  updateSectionPnp(
    assessmentId: ID!
    sectionId: String!
    pnp: SectionPNPSettingsInput!
  ): AssessmentSection!

  # Item level
  updateItemPnp(
    itemId: ID!
    pnp: ItemPNPSettingsInput!
  ): Item!

  # Session level (student-specific)
  setSessionPnp(
    sessionId: ID!
    pnp: PersonalNeedsProfileInput!
  ): ItemSession!
}

# Input types mirror the type definitions
input PersonalNeedsProfileInput {
  supports: [String!]!
  prohibitedSupports: [String!]
  activateAtInit: [String!]
}

input OrganizationPNPDefaultsInput {
  districtPolicy: DistrictPolicyInput
  defaultFeatures: [String!]
  toolConfigs: JSON
}

input DistrictPolicyInput {
  blockedTools: [String!]
  requiredTools: [String!]
}

# ... etc
```

## Data Model Changes

### Schema Migrations

**Phase 1: Add Optional Fields (Non-Breaking)**

```typescript
// 1. Organization.schema.ts
export const OrganizationSchema = new Schema({
  // ... existing fields
  pnpDefaults: { type: Object, required: false }, // NEW
});

// 2. Session.schema.ts
export const SessionSchema = new Schema({
  // ... existing fields
  pnpProfile: { type: Object, required: false }, // NEW
  pnpSource: { type: String, enum: ['student', 'section', 'assessment', 'organization', 'system'], required: false }, // NEW
  student: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // NEW: Make student explicit
});

// 3. Item.schema.ts
export const ItemSchema = new Schema({
  // ... existing fields
  settings: { type: Object, required: false }, // NEW
});

// 4. Passage.schema.ts
export const PassageSchema = new Schema({
  // ... existing fields
  settings: { type: Object, required: false }, // NEW
});

// 5. ActivityDefinition.schema.ts
export const ActivityDefinitionSchema = new Schema({
  // ... existing fields
  settings: { type: Object, required: false }, // NEW
});
```

**Migration Script**:
```typescript
// migrations/add-pnp-fields.ts
export async function up(db: Db) {
  // All new fields are optional, so no data migration needed
  // Just ensure indexes if needed
  await db.collection('organizations').createIndex({ 'pnpDefaults.districtPolicy.blockedTools': 1 }, { sparse: true });
}
```

### Type Definitions

Create shared PNP types:

```typescript
// packages/datastore/src/types/pnp.ts
export interface PersonalNeedsProfile {
  supports: string[];
  prohibitedSupports?: string[];
  activateAtInit?: string[];
}

export interface OrganizationPNPDefaults {
  districtPolicy?: {
    blockedTools?: string[];
    requiredTools?: string[];
  };
  defaultFeatures?: string[];
  toolConfigs?: Record<string, any>;
}

export interface AssessmentPNPSettings {
  supports?: string[];
  testAdministration?: {
    mode?: "practice" | "test" | "benchmark";
    toolOverrides?: Record<string, boolean>;
  };
  toolConfigs?: Record<string, any>;
}

export interface ItemPNPSettings {
  requiredTools?: string[];
  restrictedTools?: string[];
  toolParameters?: Record<string, any>;
}

// Export for use in other packages
export type {
  PersonalNeedsProfile,
  OrganizationPNPDefaults,
  AssessmentPNPSettings,
  ItemPNPSettings
};
```

## Player Service Integration

### Context Enhancement

```typescript
// packages/services/src/services/Player.service.ts
interface PlayerContext {
  env?: Partial<Env>;
  overrides?: ConfigElements;
  pnp?: ResolvedPNPProfile; // NEW: Resolved PNP for this request
  isAdmin?: boolean;
  timestamp?: string;
  skipCached?: boolean;
}

interface Env {
  mode: ModeType;
  role: RoleType;
  partialScoring: boolean;
  pnp?: ResolvedPNPProfile; // NEW: PNP profile in env
}

interface ResolvedPNPProfile {
  allowedFeatures: string[];
  blockedFeatures: string[];
  requiredFeatures: string[];
  toolConfigs: Record<string, any>;
  source: 'session' | 'section' | 'assessment' | 'organization' | 'system';
}
```

### Player Methods

```typescript
export class PlayerService {
  private pnpService: PnpService;

  async load(
    organizationId: string,
    sessionId: string,
    itemId: string,
    assignmentId: string,
    ctx: PlayerContext
  ): Promise<LoadResponse> {
    // Resolve PNP profile for this session
    const resolvedPnp = await this.pnpService.resolveSessionPnp(sessionId);

    // Inject into context
    ctx.pnp = resolvedPnp;
    ctx.env = { ...ctx.env, pnp: resolvedPnp };

    // Load item with PNP-aware configuration
    const itemData = await this.getItemWithPnp(itemId, resolvedPnp);

    // Controllers receive PNP in env
    const controllers = await this.buildControllers(itemData, ctx);

    return { controllers, env: ctx.env };
  }

  private async getItemWithPnp(
    itemId: string,
    pnp: ResolvedPNPProfile
  ): Promise<ItemEntity> {
    const item = await this.datastore.items.get(itemId);

    // Merge item-level PNP settings
    if (item.settings?.pnp) {
      // Apply item restrictions/requirements on top of resolved profile
      pnp.allowedFeatures = this.applyItemRules(
        pnp.allowedFeatures,
        item.settings.pnp
      );
    }

    return item;
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add PNP type definitions to datastore/types
- [ ] Add optional fields to Organization, Session, Item, Passage, ActivityDefinition schemas
- [ ] Create database migrations (non-breaking)
- [ ] Update TypeScript interfaces

### Phase 2: Service Layer (Week 2)
- [ ] Create PnpService with resolution logic
- [ ] Integrate with PlayerService context
- [ ] Add caching for resolved PNP profiles
- [ ] Write unit tests for precedence logic

### Phase 3: GraphQL API (Week 3)
- [ ] Add PNP GraphQL types
- [ ] Implement query resolvers (resolveSessionPnp, etc.)
- [ ] Implement mutation resolvers (setPnp at each level)
- [ ] Update existing GraphQL schemas to expose settings.pnp

### Phase 4: PIEOneer Integration (Week 4)
- [ ] Add district admin UI for pnpDefaults
- [ ] Add assessment editor UI for settings.pnp
- [ ] Add item editor UI for settings.pnp
- [ ] Add student profile management UI

### Phase 5: Migration (Week 5)
- [ ] CLI tool to migrate any existing PNP from searchMetaData
- [ ] Data validation scripts
- [ ] Documentation updates

## Validation and Testing

### GraphQL API Tests
```typescript
describe('PNP GraphQL API', () => {
  it('should set organization PNP defaults', async () => {
    const result = await client.mutate({
      mutation: SET_ORG_PNP_DEFAULTS,
      variables: {
        organizationId: 'org-123',
        pnpDefaults: {
          districtPolicy: {
            blockedTools: ['calculator'],
            requiredTools: ['textToSpeech']
          }
        }
      }
    });
    expect(result.data.setOrganizationPnpDefaults.pnpDefaults).toBeDefined();
  });

  it('should resolve session PNP with precedence', async () => {
    // Create hierarchy: org defaults → assessment → session
    const resolved = await client.query({
      query: RESOLVE_SESSION_PNP,
      variables: { sessionId: 'session-456' }
    });
    expect(resolved.data.resolveSessionPnp.source).toBe('session');
    expect(resolved.data.resolveSessionPnp.precedence).toBeDefined();
  });
});
```

### Precedence Tests
```typescript
describe('PNP Precedence Resolution', () => {
  it('district block overrides student PNP', async () => {
    // Org blocks calculator, student has calculator in PNP
    const resolved = await pnpService.resolveSessionPnp(sessionId);
    expect(resolved.profile.allowedFeatures).not.toContain('calculator');
  });

  it('item requirement forces enable', async () => {
    // Item requires calculator, student doesn't have it
    const resolved = await pnpService.resolveSessionPnp(sessionId);
    expect(resolved.profile.allowedFeatures).toContain('calculator');
  });
});
```

## Benefits of This Approach

1. **Type Safety**: Structured types instead of loose metadata
2. **Clear Semantics**: settings.pnp is unambiguous
3. **Efficiency**: Not indexed for search (searchMetaData is)
4. **Extensibility**: Easy to add fields without breaking changes
5. **Standards Alignment**: Matches QTI 3.0 structure
6. **Governance Support**: District policies and session overrides
7. **Backward Compatible**: All new fields are optional
8. **Player Integration**: Natural fit with existing settings pattern

## Open Questions for Discussion

1. **Assessment Session**: Should we create an AssessmentSessionEntity for multi-item sessions?
2. **Student Entity**: Should we create explicit Student profiles separate from sessions?
3. **Versioning**: Should item.settings be versioned with the item or separate?
4. **Caching**: How long should resolved PNP profiles be cached?
5. **Real-time Updates**: Should PNP changes trigger re-rendering of active sessions?

## Next Steps

1. Review this plan with architecture team
2. Get buy-in from PIEOneer team on UI requirements
3. Create detailed technical design doc
4. Implement Phase 1 (foundation) as POC
5. Validate with real IEP/504 data from partner districts
