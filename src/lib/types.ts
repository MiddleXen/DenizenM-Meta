export interface SearchableHelpers {
  perfectMatches: string[];
  synonyms: string[];
  strongs: string[];
  decents: string[];
  backups: string[];
}

export type MetaType =
  | 'Command'
  | 'Mechanism'
  | 'Event'
  | 'Action'
  | 'Language'
  | 'Tag'
  | 'ObjectType'
  | 'Property'
  | 'Extension'
  | 'Data'
  | 'GuidePage';

export interface BaseMetaObject {
  type: MetaType;
  name: string;
  cleanName: string;
  searchName: string;
  group: string;
  synonyms: string[];
  warnings: string[];
  plugin?: string;
  sourceFile?: string;
  deprecated?: string;
  rawValues?: Record<string, string[]>;
  searchHelper: SearchableHelpers;
  htmlContent: string;
  groupingString: string;
}

export interface MetaCommandObject extends BaseMetaObject {
  type: 'Command';
  commandName: string;
  required: number;
  maximum: number;
  syntax: string;
  short: string;
  description: string;
  tags: string[];
  guide?: string;
  usages: string[];
}

export interface MetaTagObject extends BaseMetaObject {
  type: 'Tag';
  tagFull: string;
  cleanedName: string;
  beforeDot: string;
  afterDotCleaned: string;
  returns: string;
  description: string;
  mechanism?: string;
  examples: string[];
  allowsParam: boolean;
  requiresParam: boolean;
  parsedFormatParts?: Array<{ text: string; parameter?: string }>;
}

export interface MetaEventObject extends BaseMetaObject {
  type: 'Event';
  events: string[];
  cleanEvents: string[];
  overlyCleanedEvents: string[];
  triggers: string;
  context: string[];
  determinations: string[];
  player?: string;
  npc?: string;
  cancellable: boolean;
  hasLocation: boolean;
  examples: string[];
  switches: string[];
  switchNames: string[];
}

export interface MetaMechanismObject extends BaseMetaObject {
  type: 'Mechanism';
  fullName: string;
  mechObject: string;
  mechName: string;
  input: string;
  description: string;
  tags: string[];
  examples: string[];
}

export interface MetaActionObject extends BaseMetaObject {
  type: 'Action';
  actions: string[];
  cleanActions: string[];
  triggers: string;
  context: string[];
  determinations: string[];
}

export interface MetaLanguageObject extends BaseMetaObject {
  type: 'Language';
  langName: string;
  description: string;
}

export interface MetaObjectTypeObject extends BaseMetaObject {
  type: 'ObjectType';
  typeName: string;
  prefix: string;
  baseTypeName: string;
  format: string;
  description: string;
  implementsNames: string[];
  exampleValues: string[];
  generatedExampleTagBase?: string;
  generatedExampleAdjust?: string;
  generatedReturnUsageExample?: string[];
  matchable?: string;
  extendedBy?: string[];
}

export type AnyMetaObject =
  | MetaCommandObject
  | MetaTagObject
  | MetaEventObject
  | MetaMechanismObject
  | MetaActionObject
  | MetaLanguageObject
  | MetaObjectTypeObject
  | BaseMetaObject;

export interface MetaDocsData {
  commands: Record<string, MetaCommandObject>;
  tags: Record<string, MetaTagObject>;
  events: Record<string, MetaEventObject>;
  mechanisms: Record<string, MetaMechanismObject>;
  actions: Record<string, MetaActionObject>;
  languages: Record<string, MetaLanguageObject>;
  objectTypes: Record<string, MetaObjectTypeObject>;
  allObjects: AnyMetaObject[];
  loadErrors: string[];
  lastReload: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  author: string;
  bootstrapUrl: string;
  bootstrapFooterText: string;
  colorCss: string;
  footer: string;
  isDark: boolean;
}

export interface DocViewModel {
  isAll: boolean;
  currentlyShown: number;
  max: number;
  contentHtml: string;
  searchText: string | null;
  categories: string[];
}
