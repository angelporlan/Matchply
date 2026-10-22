# Aceptación

| Requisito | Evidencia requerida |
| --- | --- |
| REQ-01 | Ocho artículos, fuentes/muestra/fecha, equivalencia ES/EN, metadata, sitemap, 404 y navegación sin JS; QA móvil/escritorio y temas. |
| REQ-02 | Oferta sin CV → importar → misma oferta; retorno seguro, cancelación, oferta eliminada/ajena, no duplicados. |
| REQ-03 | JSON inválido/resultado incompleto → error recuperable, sin consumo ni sobrescritura; replay válido consume una vez. |
| REQ-04 | Estado desde UI/API/lote; fecha omitida/null; completar/posponer/versiones; archivo/rechazo; importación sin eventos ficticios. |
| REQ-05 | Bytes iguales después de editar/borrar CV y reiniciar; variante/destino, permisos, claim, expiración y fallo de conservación visible. |
| REQ-06 | Profesiones distintas y primer empleo ES/EN; legacy sin pérdida; cancelar no escribe, repetir no duplica, fuentes nuevas al regenerar. |
| REQ-07 | Respuesta explícita, conteos/denominadores, no inferir respuesta del PDF/archivo; eventos blog con IDs editoriales. |

Ejecutar pruebas de integración en PostgreSQL local aislado, pruebas relevantes, typecheck, lint y build. Registrar solo comprobaciones realizadas en evidence.md.
