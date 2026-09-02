# Matchply se reescribe en otro repo

Esta rama (`rebuild/v2`) no es el código nuevo. Es un cartel.

El rebuild desde cero está en:

**https://github.com/angelporlan/matchply-v2**

`main` de este repositorio queda como archivo de la v1 (producto, ideas, prompts, integraciones). No se sigue construyendo encima.

Por qué otro repo y no vaciar esta rama: una rama nueva creada desde `main` arrastra los 28 MB, las fuentes, el `tsbuildinfo` y los archivos de 100 KB. Empezar de cero de verdad implica un árbol vacío, no un `git checkout -b` sobre el monstruo.
