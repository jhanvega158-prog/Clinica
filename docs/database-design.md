# Diseno de base de datos - Clinica VitaDenti

## Analisis del proyecto actual

El workspace contiene una aplicacion Angular standalone conectada directamente a Supabase. No se encontro proyecto Spring Boot en el repositorio: no hay `pom.xml`, `build.gradle` ni estructura `src/main/java`.

Modulos Angular detectados:

- Login: usa Supabase Auth y un acceso local temporal `admin/admin`.
- Usuarios: se consulta la tabla `usuarios` para cargar perfil.
- Pacientes: CRUD, busqueda, fotografia y documentos.
- Historia clinica: formulario basico; actualmente signos vitales, examen y diagnosticos se guardan como JSON/texto.
- Odontograma: piezas FDI, hallazgos y RPC `calcular_cpo`.
- Agenda: CRUD de citas sobre `agenda`.
- Tratamientos: CRUD basico con diagnostico, procedimiento, prescripcion, costo y estado.
- Facturacion: facturas e items.
- Inventario: insumos, stock minimo y vencimiento.
- Dashboard/Reportes: views `vw_dashboard_resumen` y `vw_dashboard_citas`.

## Modelo entidad-relacion resumido

Relaciones principales:

- `auth.users` 1:1 `usuarios`.
- `usuarios` N:M `roles` mediante `usuario_roles`.
- `roles` N:M `permisos` mediante `rol_permisos`.
- `usuarios` 1:1 `odontologos`; `odontologos` N:M `especialidades`.
- `pacientes` 1:N `historias_clinicas`, `citas`, `tratamientos`, `facturas`, `archivos_clinicos`.
- `pacientes` N:M `seguros` mediante `paciente_seguros`.
- `historias_clinicas` 1:N `constantes_vitales`, `diagnosticos`, `odontogramas`, `examenes`, `archivos_clinicos`.
- `historias_clinicas` 1:1 `indicadores_salud_bucal`.
- `historias_clinicas` N:M `examen_estomatognatico_items` mediante `examen_estomatognatico`.
- `odontogramas` 1:N `odontograma_detalles`.
- `odontogramas` 1:1 `odontograma_cpo_manual`.
- `historias_clinicas` N:M `piezas_dentales` mediante `piezas_examinadas`.
- `tratamientos` 1:N `sesiones_tratamiento`.
- `sesiones_tratamiento` 1:N `recetas`; `recetas` 1:N `receta_medicamentos`.
- `citas` 1:N `recordatorios_whatsapp`.
- `examenes` 1:N `archivos_clinicos`.
- Todas las tablas operativas alimentan `auditoria`.

## Tablas y motivo

- `roles`, `permisos`, `rol_permisos`, `usuarios`, `usuario_roles`: login, perfiles, permisos y control de acceso.
- `odontologos`, `especialidades`, `odontologo_especialidades`: agenda por odontologo, firma profesional y especialidades.
- `pacientes`: ficha principal del paciente, compatible con el formulario actual.
- `seguros`, `paciente_seguros`: reemplazan el campo de alergias por seguros en la historia, sin perder alergias del paciente como dato clinico.
- `historias_clinicas`: cabecera de la historia MSP; mantiene columnas JSON actuales para compatibilidad, pero los modulos clinicos nuevos se normalizan.
- `constantes_vitales`: temperatura, pulso, frecuencia respiratoria y presion arterial.
- `examen_estomatognatico_items`, `examen_estomatognatico`: checklist y observaciones del examen.
- `indicadores_salud_bucal`: higiene oral, enfermedad periodontal, oclusion y fluorosis.
- `piezas_dentales`: catalogo FDI permanente y temporal con cuadrante, posicion y figura visual.
- `estados_piezas`, `odontogramas`, `odontograma_detalles`: odontograma interactivo multiestado por pieza.
- `odontograma_cpo_manual`: C, P, O, ceo y total editable manualmente.
- `piezas_examinadas`: tabla exacta de piezas examinadas con checkbox.
- `diagnosticos`: multiples diagnosticos por historia con codigo CIE, tipo y observaciones.
- `tratamientos`, `sesiones_tratamiento`: plan/procedimiento y sesiones clinicas.
- `medicamentos`, `recetas`, `receta_medicamentos`: prescripciones estructuradas.
- `citas`: agenda/calendario con estados solicitados y bloqueo de doble reserva.
- `agenda`: vista compatible con Angular actual sobre `citas`.
- `recordatorios_whatsapp`: registro de mensajes de recordatorio y seguimiento.
- `examenes`: examenes adicionales solicitados en historia clinica.
- `archivos_clinicos`: metadatos de PDF, Word, Excel e imagenes en Supabase Storage.
- `documentos_clinicos`: vista compatible con Angular actual sobre `archivos_clinicos`.
- `facturas`, `factura_items`: modulo de facturacion existente.
- `inventario`, `inventario_movimientos`: modulo de inventario existente y trazabilidad de stock.
- `configuracion_sistema`: parametros editables de clinica, agenda y WhatsApp.
- `auditoria`: trazabilidad automatica de inserciones, cambios y eliminaciones.

## Supabase Storage

Buckets creados por la migracion:

- `pacientes`: fotografias.
- `radiografias`: imagenes y PDF radiograficos.
- `documentos`: PDF, Word, Excel e imagenes clinicas.
- `examenes`: adjuntos de examenes adicionales.
- `firmas`: firmas de odontologos y sesiones.

Los buckets se crean privados con policies para usuarios autenticados. Para publicar archivos con URL publica habria que cambiar el bucket a publico o migrar el frontend a signed URLs.

## Seguridad

La migracion activa RLS en todas las tablas. Las policies permiten lectura/escritura a usuarios autenticados y eliminacion solo a administradores. La auditoria solo puede ser leida por administradores.

Importante: el login local `admin/admin` del frontend no genera una sesion Supabase, por lo tanto no pasara RLS. Para funcionamiento real se debe crear un usuario en Supabase Auth; el trigger `handle_new_auth_user` crea automaticamente su fila en `usuarios`.

## Archivos generados

- Migracion SQL: `supabase/migrations/202607200001_initial_vitadenti_schema.sql`.
