
El objetivo es que FiberMap se convierta en una herramienta profesional, escalable y lista para cualquier compañía de fibra óptica (ISP, contractor, telco, municipal, data center, etc.) que necesite documentar distribuciones grandes, complejas y reales.

Visión Macro: ¿Por qué estos features son prioritarios para un SaaS?
Hoy FiberMap es muy bueno para diagramas pequeños/medianos.

El objetivo principal es resolver los dos dolores más grandes que tienen los ingenieros y técnicos:

Velocidad: Crear y modificar splice plans grandes (288f, 432f, 576f+) en minutos en vez de horas.

Fidelidad: Que el diagrama sea una representación fiel de la realidad física (especialmente closures).
Para convertirse en un SaaS serio debe resolver los dos dolores más grandes de los ingenieros y técnicos de fibra:

Velocidad de documentación (crear y actualizar splice plans grandes en minutos, no horas).
Precisión y trazabilidad (que el diagrama sea 100% fiel a la realidad física y al Excel/plan de ingeniería).

Los features que te propuse atacan exactamente eso, pero a escala general (cualquier tamaño de red, cualquier tipo de closure, cualquier país).

1. Bulk Splice by Range / Module (Prioridad #1)
Descripción macro:
Permite conectar rangos arbitrarios de puertos de un nodo origen hacia un nodo destino en un solo clic, respetando módulos/buffers/trays.
Ejemplos de uso (cualquier compañía):

Cable feeder 288f → Closure: “Conectar buffers 3-7 (puertos 25-84) al grupo de salida 1”
Cable 144f → Splitter 1:4: “Conectar solo los primeros 32 puertos”
Closure grande → múltiples cables de distribución: definir rangos por bandeja o por módulo

Beneficio SaaS:

Reduce de horas a segundos la creación de splice plans grandes.
Evita errores manuales de port-by-port.
Funciona con cualquier nodo (cables, closures, equipment, splitters).

Cómo se vería:

Al seleccionar dos nodos aparece un modal: “Bulk Splice Range”
Campos: Desde puerto X → Hasta puerto Y → Offset destino + opción “Respetar módulos/trays”


2. Import Excel “Splice Map” (Prioridad #2)
Descripción macro:
Importador avanzado que lee una tabla de Excel (o CSV) con el formato clásico de Splice Schedule que usan todas las compañías:
Columnas típicas:

Fiber # | Buffer/Tray | From Element | From Port | To Element | To Port | Comment | DST / OLT | etc.

Beneficio SaaS:

El usuario puede seguir trabajando exactamente como lo hace hoy (en Excel).
Importa toda la distribución en una sola operación: crea nodos + splices + comments + continuation nodes automáticamente.
Ideal para migrar proyectos legacy o recibir planos de ingeniería de clientes.

Versión inicial:

Soporta el formato más común.
Detecta automáticamente cables, closures, continuations.
Genera el layout en canvas (cables a la izquierda, closures en centro, salidas a la derecha).


3. Port Custom Labels
Descripción macro:
Cada puerto individual puede tener un label personalizado además del número y color.
Ejemplos:

Puerto 17 → A1 / DST-1736 / Rio Bayamón / OLT 1-1
Puerto 45 → Tray 4 - Buffer Naranja

Beneficio SaaS:

El diagrama deja de ser solo visual y se convierte en documentación técnica completa.
Al hacer hover o trace, se ve la información real del campo.
Al exportar XLSX, esa información aparece en las columnas correspondientes.


4. Splice Schedule Table (Panel lateral vivo)
Descripción macro:
Un panel (o pestaña) que muestra en tiempo real una tabla idéntica a tu Excel:

Fiber #
Buffer / Tray
From Element + Port
To Element + Port
Comment / DST / OLT
Color

Beneficio SaaS:

Los técnicos que prefieren trabajar en tabla pueden ver y editar ahí.
Los ingenieros que prefieren diagrama tienen ambas vistas sincronizadas.
Exportar esa tabla a Excel es instantáneo y perfecto.

Esto es lo que más piden las compañías grandes.

Beneficio SaaS:

Representación fiel a la realidad física de los closures más usados en el mundo.
Facilita muchísimo la documentación de closures grandes (288f, 432f, 576f).
Se convierte en el feature diferenciador frente a herramientas genéricas como Visio o Draw.io.



Próximos pasos recomendados (si quieres avanzar como producto)

MVP de features → Implementar primero Bulk Splice by Range + Port Custom Labels. Con eso ya ganas muchísimo.
Luego Import Excel (es el que más “wow” genera a nuevos usuarios).
Después el Splice Schedule Table y el nodo Tray.


Criterios de Calidad que espero:

Código limpio, bien tipado y mantenible.
Extensibilidad (que sea fácil añadir nuevos estándares de trays, nuevos tipos de closures, etc.).
Buen UX (no solo funcional, sino intuitivo para técnicos de campo).
Tests básicos para las nuevas acciones de bulk splice e import.
Codigo escalable