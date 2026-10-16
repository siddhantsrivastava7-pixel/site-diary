import type { DocumentHostData } from './types';
import { estimateBusiness, letterBusiness, validateBusiness, validateDocument } from './documents';

export type DocumentFields = Pick<DocumentHostData, 'documents' | 'documentDefaults'>;

/** Spread into new notebook initialization. Creates fresh arrays/objects each time. */
export function emptyDocumentFields(): DocumentFields {
  return {
    documents: [],
    documentDefaults: { letter: { ...letterBusiness }, estimate: { ...estimateBusiness } }
  };
}

/** Spread into the EXISTING validated backup result; old notebooks become valid automatically. */
export function validateDocumentFields(raw: unknown): DocumentFields {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (o.documents != null && !Array.isArray(o.documents)) throw new Error('Invalid document list in backup.');
  const docs = Array.isArray(o.documents) ? o.documents : [];
  if (docs.length > 1000) throw new Error('Too many documents in backup.');
  const defaults = o.documentDefaults && typeof o.documentDefaults === 'object' && !Array.isArray(o.documentDefaults) ? o.documentDefaults as Record<string, unknown> : {};
  return {
    documents: docs.map(validateDocument),
    documentDefaults: {
      letter: validateBusiness(defaults.letter, letterBusiness),
      estimate: validateBusiness(defaults.estimate, estimateBusiness)
    }
  };
}
