# Informe de Costos y Viabilidad — Vethos AI

**Preparado para:** Nico y Roberto
**Fecha:** 29 de junio de 2026
**Moneda:** Pesos colombianos (COP). Conversiones de USD a tasa **3.700 COP/USD**.

---

## 1. ¿Por qué le conviene al veterinario? (Valor y retorno)

El corazón de Vethos AI es el **tiempo que le ahorra al veterinario**. Hoy el vet escribe a mano la historia clínica, la nota SOAP, la receta y luego se la envía al dueño. Con Vethos eso es automático: **graba la consulta → la IA arma el SOAP → genera el PDF → lo envía por WhatsApp**.

| | Manual (sin Vethos) | Con Vethos |
|---|---|---|
| Documentar una consulta (SOAP + receta + envío) | ~12 min | ~2 min (revisar y aprobar) |
| **Ahorro por consulta** | — | **~10 min** |
| Por día (5 consultas) | — | ~50 min |
| Por mes (~100 consultas) | — | **~16–17 horas** |
| Valor de ese tiempo (a ~30.000 COP/hora) | — | **~500.000 COP/mes** |
| Precio de Vethos | — | **150.000 COP/mes** |
| **Beneficio neto para el vet** | — | **~350.000 COP/mes (retorno ≈ 3x)** |

**Conclusión:** por cada peso que paga, el veterinario recupera cerca de **tres** solo en tiempo. Y además:

- Con esas ~16 horas libres al mes puede **atender más pacientes** (más ingresos).
- **Historias clínicas más completas y consistentes** (respaldo legal, menos errores).
- **PDF profesional + envío inmediato por WhatsApp** → mejor imagen ante el dueño de la mascota.
- **Menos desgaste**: no se lleva el trabajo de documentación a la casa.

Incluso en un escenario conservador (ahorro de solo 7 min por consulta), sigue siendo una ganancia clara para el veterinario.

---

## 2. Propuesta de precio

| Plan | Precio sugerido |
|---|---|
| Vethos AI — por veterinario / mes | **150.000 COP** |

Es el **punto dulce**: lo suficientemente bajo para ser muy atractivo para el vet (retorno ~3x), y con buen margen para la operación. A 100.000 sería casi un regalo; 150.000 equilibra valor y rentabilidad.

---

## 3. Inversión de desarrollo (pago único)

| Concepto | COP |
|---|---|
| Desarrollo — Andrés (todo el sistema) | 20.000.000 |
| Salario Elizabeth (3 meses de desarrollo) | 4.000.000 |
| Cursor (herramienta de desarrollo, $200 USD) | 740.000 |
| **TOTAL INVERSIÓN INICIAL** | **24.740.000 COP** |

> **Nota — Google One (Antigravity):** es una herramienta de desarrollo de **79.000 COP/mes** que **se sigue pagando mensualmente**. Por eso no se suma al total único, sino que aparece como costo recurrente en la sección 5.

---

## 4. Cronograma de pago a Andrés (20M en 4 cuotas)

| Fecha | Cuota |
|---|---|
| Semana del 1 al 4 de julio | 5.000.000 |
| 15 de julio | 5.000.000 |
| 1 de agosto | 5.000.000 |
| 15 de agosto | 5.000.000 |
| **Total** | **20.000.000 COP** |

---

## 5. Costos recurrentes de operación (mensual)

| Concepto | COP/mes |
|---|---|
| Google One (Antigravity) | 79.000 |
| Consumo de IA — por veterinario* | 44.000 – 67.000 |
| Mantenimiento (sueldo Elizabeth) | a definir |
| **Costo fijo mensual (sin IA por vet)** | 79.000 + sueldo |

\* Un veterinario activo: ~5 consultas/día × 5 días = ~100 consultas/mes, de 45–60 min cada una.

El **mantenimiento** de la plataforma, una vez lanzada, es básicamente el **sueldo de Elizabeth** más estos costos recurrentes (Google One + consumo de IA).

---

## 6. Costo de IA por consulta (detalle)

El consumo de IA cubre la transcripción del audio (STT) y la generación de la nota SOAP.

| | Consulta 45 min | Consulta 60 min |
|---|---|---|
| Por consulta | ~444 COP ($0.12) | ~666 COP ($0.18) |
| Por mes (~100 consultas) | ~44.400 COP | ~66.600 COP |
| Por año (~1.200 consultas) | ~533.000 COP | ~799.000 COP |

> Cifra **estimada y conservadora**. El gasto real medido hasta la fecha es muy bajo (~$1,26 USD en total de pruebas). Con la cuenta de Gemini con saldo (más económico que OpenAI), el costo real tiende a bajar.

---

## 7. Margen y punto de equilibrio

| Concepto | COP/mes por veterinario |
|---|---|
| Precio de venta | 150.000 |
| Costo directo de IA (promedio) | ~55.000 |
| **Margen de contribución por vet** | **~95.000 (≈ 63%)** |

- **Recuperar la inversión** (24.740.000 COP): con un margen de ~95.000 por vet, se recupera en aproximadamente **260 vet-mes**. Ejemplos: 50 vets ≈ 5,5 meses; 100 vets ≈ 2,7 meses.
- **Cubrir el costo fijo mensual** (ejemplo ilustrativo, si el sueldo de mantenimiento fuera 4.000.000 COP/mes): se necesitan ~**43 veterinarios** activos para cubrir sueldo + Google One; de ahí en adelante es ganancia.

*(Las cifras de equilibrio dependen del sueldo de mantenimiento que se defina.)*

---

## 8. Capacidad y escalabilidad

- La inversión de desarrollo cubre una plataforma diseñada para **500 a 1.000 usuarios**.
- **Costo de desarrollo por usuario:** entre **24.740 COP** (a 1.000 usuarios) y **49.480 COP** (a 500 usuarios) — una sola vez.
- Superados los 1.000 usuarios, el costo deja de ser desarrollo y pasa a ser **solo mantenimiento** (sueldo + recurrentes).
- El costo de IA **escala con el número de consultas, no con el número de clientes**, y es muy bajo por consulta.

---

## 9. Supuestos del informe

- Tasa de cambio: **3.700 COP/USD**.
- Salario de Elizabeth en desarrollo: 4.000.000 COP por los 3 meses.
- Valor de la hora del veterinario: ~30.000 COP (referencia para el cálculo de ahorro).
- Consumo de IA: estimado conservador; se ajustará con medición en operación real.
- Tiempo de documentación manual estimado: ~12 min/consulta.

---

*Documento interno de Vethos AI. Contiene información financiera confidencial.*
