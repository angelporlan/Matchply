import test from 'node:test';
import assert from 'node:assert/strict';
import { contactFieldKey, contactFieldLayout, setContactFieldValue } from '@/lib/cv-contact-fields';
import { parseCvDocument, serializeCvDocument } from '@/lib/cv-document';

test('contact fields recognize Spanish/English labels and generic imports without reclassifying custom details', () => {
  for (const label of ['Email', 'E-mail', 'Correo electrónico']) assert.equal(contactFieldKey({ label, value: '' }), 'email');
  for (const label of ['Teléfono', 'Phone', 'Tel.']) assert.equal(contactFieldKey({ label, value: '' }), 'phone');
  for (const label of ['Ubicación', 'Dirección', 'Location']) assert.equal(contactFieldKey({ label, value: '' }), 'location');
  assert.equal(contactFieldKey({ label: 'Dato', value: 'https://www.linkedin.com/in/person' }), 'linkedin');
  assert.equal(contactFieldKey({ label: 'Contacto', value: 'name@example.com' }), 'email');
  assert.equal(contactFieldKey({ label: 'Enlace', value: 'https://example.com' }), 'website');
  assert.equal(contactFieldKey({ label: 'GitHub', value: 'https://github.com/person' }), null);
  assert.equal(contactFieldKey({ label: 'Publicaciones', value: 'https://example.com/papers' }), null);
  assert.equal(contactFieldKey({ label: 'Ciudadanía', value: 'España' }), null);
});

test('contact field edits retain custom labels, duplicate entries, ordering and unrelated document sections', () => {
  const doc = parseCvDocument('# Candidate\n\n**Correo electrónico:** first@example.com | **Email:** second@example.com | **GitHub:** https://github.com/person\n\n## Experiencia\nTrabajo preservado.');
  const original = structuredClone(doc);
  assert.deepEqual(contactFieldLayout(doc.contact), { primary: { email: 0 }, custom: [1, 2] });
  doc.contact = setContactFieldValue(doc.contact, 'email', 'new@example.com', 'Email');
  assert.equal(doc.contact[0].label, 'Correo electrónico');
  assert.deepEqual(doc.contact.slice(1), original.contact.slice(1));
  doc.contact = setContactFieldValue(doc.contact, 'phone', '+34 600 000 000', 'Teléfono');
  const roundTrip = parseCvDocument(serializeCvDocument(doc));
  assert.deepEqual(roundTrip, doc);
  assert.deepEqual(roundTrip.sections, original.sections);
  const removed = setContactFieldValue(doc.contact, 'email', '', 'Email');
  assert.equal(removed[0].value, 'second@example.com');
  assert.equal(removed.find(item => item.label === 'GitHub')?.value, 'https://github.com/person');
  assert.equal(original.contact[0].value, 'first@example.com');
  assert.equal(setContactFieldValue([], 'location', ' ', 'Ubicación').length, 0);
});
