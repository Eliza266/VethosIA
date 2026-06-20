import { readFileSync } from 'fs';
import { join } from 'path';

interface FirestoreIndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

interface FirestoreIndex {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: FirestoreIndexField[];
}

interface FirestoreIndexesFile {
  indexes: FirestoreIndex[];
}

const indexesPath = join(__dirname, '..', '..', '..', 'firestore.indexes.json');

function loadIndexes(): FirestoreIndex[] {
  return (JSON.parse(readFileSync(indexesPath, 'utf8')) as FirestoreIndexesFile).indexes;
}

function signature(index: FirestoreIndex): string {
  const fields = index.fields
    .map((field) => `${field.fieldPath}:${field.order ?? field.arrayConfig ?? 'ASCENDING'}`)
    .join('|');
  return `${index.collectionGroup}:${index.queryScope}:${fields}`;
}

function expectedIndex(
  collectionGroup: string,
  fields: Array<[string, 'ASCENDING' | 'DESCENDING']>,
): string {
  return `${collectionGroup}:COLLECTION:${fields.map(([field, order]) => `${field}:${order}`).join('|')}`;
}

describe('firestore.indexes Runtime V2', () => {
  it('cubre consultas V2 por accountId/entidadId/veterinariaId y conserva legacy', () => {
    const signatures = new Set(loadIndexes().map(signature));

    const expected = [
      expectedIndex('consultas', [
        ['veterinarioId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['orgId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['accountId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['accountId', 'ASCENDING'],
        ['pacienteId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['entidadId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['entidadId', 'ASCENDING'],
        ['pacienteId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['veterinariaId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
      expectedIndex('consultas', [
        ['veterinariaId', 'ASCENDING'],
        ['pacienteId', 'ASCENDING'],
        ['fechaHora', 'DESCENDING'],
      ]),
    ];

    for (const item of expected) {
      expect(signatures).toContain(item);
    }
  });

  it('no duplica definiciones compuestas equivalentes', () => {
    const all = loadIndexes().map(signature);
    expect(new Set(all).size).toBe(all.length);
  });
});
