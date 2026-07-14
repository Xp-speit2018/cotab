import { barDocumentActions } from "./edit-bar";
import { beatDocumentActions } from "./edit-beat";
import { clipboardDocumentActions } from "./edit-clipboard";
import { historyDocumentActions } from "./edit-history";
import { masterBarDocumentActions } from "./edit-master-bar";
import { noteDocumentActions } from "./edit-note";
import { scoreDocumentActions } from "./edit-score";
import { staffDocumentActions } from "./edit-staff";
import { trackDocumentActions } from "./edit-track";

export const DOCUMENT_ACTIONS = [
  ...scoreDocumentActions,
  ...trackDocumentActions,
  ...staffDocumentActions,
  ...barDocumentActions,
  ...masterBarDocumentActions,
  ...beatDocumentActions,
  ...noteDocumentActions,
  ...historyDocumentActions,
  ...clipboardDocumentActions,
] as const;

export type AnyDocumentAction = (typeof DOCUMENT_ACTIONS)[number];
