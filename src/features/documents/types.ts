export type BusinessDetails = { name: string; address: string; email: string; phone: string; signer: string; role: string };
export type DocumentType = 'letter' | 'estimate';
export type BaseDocument = { id: string; type: DocumentType; clientName: string; clientAddress: string; projectName: string; siteId: string; date: string; business: BusinessDetails; createdAt: string; updatedAt: string };
export type ConsultancyDoc = BaseDocument & { type: 'letter'; areaSqFt: string; floors: string; fee: number; advancePercent: number; subject: string; scope: string; execution: string; terms: string; closing: string };
export type EstimateItem = { id: string; description: string; quantity: number; unit: string; rate: number };
export type EstimateSection = { id: string; title: string; items: EstimateItem[] };
export type EstimateDoc = BaseDocument & { type: 'estimate'; projectType: string; space: string; pricing: 'lump' | 'itemized'; lumpTotal: number; notes: string; sections: EstimateSection[] };
export type DocumentRecord = ConsultancyDoc | EstimateDoc;

/** Minimal contract implemented by an existing Site Diary notebook. */
export type DocumentHostData = {
  sites: Array<{ id: string; name: string; location?: string; active?: boolean }>;
  documents: DocumentRecord[];
  documentDefaults: { letter: BusinessDetails; estimate: BusinessDetails };
};
