import type { ContactInfo } from './cv-document';

export const CONTACT_FIELD_KEYS = ['email', 'phone', 'location', 'linkedin', 'website'] as const;
export type ContactFieldKey = typeof CONTACT_FIELD_KEYS[number];
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function contactFieldKey(item: ContactInfo): ContactFieldKey | null {
  const label = fold(item.label).replace(/[:.]+$/, '').trim();
  if (/^(?:e-?mail(?: address)?|correo(?: electronico)?)$/.test(label)) return 'email';
  if (/^(?:telefono(?: movil)?|tel|movil|phone(?: number)?|mobile(?: phone)?|cell)$/.test(label)) return 'phone';
  if (/^(?:ubicacion|direccion|ciudad|localidad|location|address|city)$/.test(label)) return 'location';
  if (/^linkedin(?: profile)?$/.test(label)) return 'linkedin';
  if (/^(?:portfolio|portafolio|web|website|sitio web|pagina web|personal website|portfolio\s*\/\s*web)$/.test(label)) return 'website';
  // Only infer unnamed/generic imported fields. Named custom fields stay editable as-is.
  if (!/^(?:dato|valor|contacto|contact|enlace|link)?$/.test(label)) return null;
  const value = item.value.trim();
  if (/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\//i.test(value)) return 'linkedin';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
  if (/^\+?[\d\s().-]{7,}$/.test(value) && value.replace(/\D/g, '').length >= 7) return 'phone';
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(value)) return 'website';
  return null;
}

export function contactFieldLayout(contacts: ContactInfo[]) {
  const primary: Partial<Record<ContactFieldKey, number>> = {}, custom: number[] = [];
  contacts.forEach((item, index) => {
    const key = contactFieldKey(item);
    if (key && primary[key] === undefined) primary[key] = index;
    else custom.push(index);
  });
  return { primary, custom };
}

export function setContactFieldValue(contacts: ContactInfo[], key: ContactFieldKey, value: string, newLabel: string): ContactInfo[] {
  const next = contacts.map(item => ({ ...item }));
  const index = contactFieldLayout(contacts).primary[key];
  if (index !== undefined) {
    if (!value.trim()) next.splice(index, 1);
    else next[index].value = value;
  } else if (value.trim()) next.push({ label: newLabel, value });
  return next;
}
