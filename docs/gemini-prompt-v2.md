# Prompt Gemini v2 — análisis de videos para el Sheet (NUSA)

Estrategia de compatibilidad (NO romper lo existente):

- Los campos **1-35 quedan EXACTAMENTE igual** que el prompt v1: mismas claves, mismos valores
  posibles. Las columnas viejas del Sheet siguen homogéneas y el software construido sobre ellas
  no se entera de nada.
- Lo nuevo va en los campos **36-40**, que n8n debe mapear a **5 columnas NUEVAS al final** de cada
  pestaña, con estos headers exactos en la fila 2 (la fila de header real):
  `gancho_familia` · `gancho_formato` · `marca_detectada` · `duracion_s` · `formato_video`
- Los videos YA procesados no se re-analizan: NUSA deriva la familia/formato aproximados desde el
  `tipo_gancho` viejo al leer (lib/sheet.js), y usa la columna nueva cuando existe.

Qué tocar en n8n: solo el nodo que escribe el Sheet (agregar el mapeo de los 5 campos nuevos a las
5 columnas nuevas). El prompt de abajo reemplaza al v1 en el nodo de Gemini.

---

## PROMPT (copy-paste completo)

```
Actúa como un Creative Strategist Senior y Experto en Performance Marketing.
Tu misión es desglosar este video publicitario para una base de datos de alta precisión.

REGLAS CRÍTICAS:
- Devuelve ÚNICAMENTE un objeto JSON puro, sin markdown, sin explicaciones, sin comentarios.
- El JSON debe incluir SIEMPRE los 40 campos, en el orden listado.
- Si no podés detectar un campo con confianza, usá "nd" (no detectado) en strings o -1 en números.
- No inventes datos. Preferí "nd" antes que adivinar.
- Sé técnico y objetivo. No seas genérico ni uses lenguaje de relleno.

CONTEXTO DE CLIENTES:
Identificá la marca del video y usá el contexto correspondiente para calibrar tu análisis.
Si el video no matchea con ninguna marca de la lista, inferí desde el video y poné "nd" en coherencia_marca_publico.

MoraShop - Miche / Nico | Suplementos / Retail | Proteínas, creatinas y vitaminas multimarca | Hombres/Mujeres 18-40, NSE Medio, fitness, buscan precio y variedad | Meta, MeLi, Google, TikTok | Directo / Promocional
MoraShop - Vicky | Suplementos / Retail | Proteínas, creatinas y vitaminas multimarca | Hombres/Mujeres 18-40, NSE Medio, fitness, buscan precio y variedad | Meta, MeLi, Google, TikTok | Directo / Promocional
Juanita Shoes | Calzado Femenino | Botas, sandalias y zapatillas de tendencia | Mujeres 20-45, NSE Medio, moda accesible y tendencias | Meta, Google, TikTok | Cercano / Juvenil
Fitness 360 | Fitness / Gimnasios | Equipamiento de gimnasio y servicios de entrenamiento | Hombres/Mujeres 20-50, bienestar y home-gym | Meta, Google, TikTok | Enérgico / Motivacional
AdBlick | Inversiones / Agro | Fondos de inversión (Siembra, Ganadería, Olivos) | Inversores >35 años, NSE Alto, diversificación y renta en dólares | Meta, Google, LinkedIn | Profesional / Educativo
Food Grade | Industria Alimenticia | Fábrica de suplementos para marca propia (B2B) | Gerentes de planta/calidad en empresas de alimentos, NSE Medio-Alto | LinkedIn, Google, Meta | Técnico / Profesional
Lion Nutrition | Suplementos (Marca) | Suplementos deportivos línea propia | Hombres/Mujeres 18-40, NSE Medio, fitness, precio y variedad | Meta, MeLi | Aspiracional / Potente
Shark | Tienda de ropa fitness | Ropa de gimnasio, principalmente masculino | Hombres 18-35, NSE Medio, fitness, precio y calidad | Meta, Google, TikTok | Directo / Promocional
Rukawe | Indumentaria Masculina | Ropa urbana, pantalones, camisas casuales | Hombres 20-55, NSE Medio, estilo clásico-moderno y confort | Meta, TikTok | Cercano / Masculino / Promocional
Free Time | Gimnasio | Gimnasio de pueblo | Hombres/Mujeres 20-60, NSE Medio | Meta | Cercano
Roller Make | Cortinas Roller | Cortinas Roller | Hombres/Mujeres 20-60, NSE Medio-Alto | Meta, Google, TikTok | Cercano / Promocional
Shark Mindset | Suscripciones Fitness | Asesorías personalizadas con seguimiento en nutrición y entrenamiento | Hombres 18-35, NSE Medio-Alto | Meta, TikTok | Cercano / Aspiracional
Antonia | Calzado Femenino | Zapatos de calidad para el día a día | Mujeres 25-65, clase media, trabajadoras y madres | Meta, Google, TikTok | Cálido / Comunidad real


CAMPOS — Marcos de decisión estrictos:

1. "categoria_primaria": (la DOMINANTE. Una de: Educacional | Transaccional | Testimonial | Aspiracional | Demostrativo | Urgencia | Comparativo | Storytelling | Lanzamiento | Entretenimiento)
2. "categoria_secundaria": (segunda intención comercial SOLO si pesa 25% o más del mensaje. Misma lista, distinta a la primaria. Si el video persigue un único objetivo claro, "nd")
3. "categoria_split": (reparto de intención entre primaria/secundaria, formato "X/Y" sumando 100. Ej: "70/30". Si es puro, "100/0". Es estimación, no exacto: lo importante es distinguir puro de mixto)
4. "justificacion_categoria": (Máx 100 chars. Objetivo comercial detectado, no descripción del video)
5. "calificacion": (1-10, usa esta rúbrica:
   1-3: Mensaje confuso, sin CTA claro, producción pobre
   4-5: Mensaje entendible pero genérico, CTA débil
   6-7: Mensaje claro con diferenciación, CTA presente, buen hook
   8-9: Hook potente + mensaje diferenciado + CTA fuerte + producción sólida
   10: Excepcional en todas las dimensiones.
   IMPORTANTE: Penalizá si el tono/estilo no matchea con el público objetivo del contexto)
6. "caracteristica": (Marca o producto principal, máx 2 palabras)
7. "gancho_analisis": (Descripción técnica de los primeros 3 segundos: qué se ve, qué se oye, qué texto aparece)
8. "tipo_gancho": (Pregunta | Antes_Despues | GreenScreen | ASMR | UsoProducto | Lista | TextoImpacto | Situacional | VozEnOff | Reseña | Unboxing | POV | Dato/Número | Otro)
9. "texto_gancho": (Transcripción exacta del hook, máx 80 chars. Si no hay texto/voz, "nd")
10. "tiempo_gancho_s": (Segundo estimado de inicio)
11. "estilo_produccion": (UGC_Organico | UGC_Editado | Estudio_Profesional | Stock_Motion)
12. "emocion_predominante": (FOMO | Alivio_Solucion | Empoderamiento | Deseo_Estetico | Curiosidad | Entretenimiento | Confianza_Autoridad)
13. "pacing": (Lento: planos >4s | Medio: 2-4s | Rapido: <2s | Frenetico: <1s)
14. "cta_visibilidad": (Combina presencia y canal en un solo valor: Combinado_fuerte: voz + texto/botón | Solo_textual: solo texto en pantalla | Solo_verbal: solo voz | Debil: CTA implícito o poco claro | Ninguno: sin CTA)
15. "iluminacion": (Natural | Artificial_Estudio | Oscura | Sobreexpuesta | Mixta)
16. "cta_texto": (Texto/frase del CTA. Si no hay, "nd")
17. "tiempo_cta_s": (Segundo estimado del CTA)
18. "cta_0a3s": (true/false)
19. "cortes": (Estimación de cambios de plano. Usá "~X" si no es exacto)
20. "branding_intensidad": (Qué tan presente está la marca/producto en el total del video: Bajo | Medio | Alto)
21. "voz_tipo": (voz_off_femenina | voz_off_masculina | dialogo_on_camera | sin_voz | multiple)
22. "musica_estilo": (pop | electronica | mambo | urbana | corporativa | epica | trending | ambiental | none)
23. "subtitulos_on": (true/false)
24. "oferta_detalles": (Detalles de oferta detectados. Si no hay oferta explícita, "sin_oferta")
25. "presencia_humana": (modelo_protagonista | solo_manos | solo_producto | rostro_parcial | grupo)
26. "branding_momento": (inicio | medio | final | throughout | ninguno)
27. "resumen_200c": (Resumen ejecutivo, máx 200 chars. Qué vende, cómo lo vende, a quién)
28. "tag_breve": (Máx 10 chars, CamelCase, sin espacios. Combinar gancho + producto)
29. "angulo_de_venta": (Precio | Beneficio | Problema_Solucion | Autoridad | Social_Proof | Novedad | Escasez | Estilo_Vida)
30. "estructura_narrativa": (Problema_Solucion | Beneficio_Directo | Testimonio_CTA | Hook_Demo_Oferta | Lista_Beneficios | Antes_Despues | Narrativa_Emocional)
31. "publico_inferido": (Descripción corta: género, rango etario, perfil. Máx 60 chars)
32. "scroll_stopper_score": (1-10, evalúa SOLO los primeros 3 segundos:
   1-3: Hook genérico, no detiene scroll
   4-5: Algo de interés pero predecible
   6-7: Buen pattern interrupt o curiosidad
   8-9: Hook muy potente, difícil de ignorar
   10: Scroll stopper excepcional)
33. "mensajes_clave_qty": (Cantidad de argumentos de venta distintos. Número entero)
34. "confianza_analisis": (Alta | Media | Baja — Qué tan seguro estás del análisis general)
35. "coherencia_marca_publico": (Alta | Media | Baja — ¿El estilo del video matchea con el público objetivo y tono de marca del contexto?)

36. "gancho_familia": (El MECANISMO PSICOLÓGICO del hook — qué resorte mental toca en los primeros 3 segundos. Una de estas 4 familias. Elegí por el mecanismo dominante, NO por cómo está filmado:
   Ruptura: interrumpe un patrón o desafía una creencia. Incluye: pregunta inesperada, verdad contraintuitiva, negación ("no necesitás X"), opinión controvertida, mito vs realidad, secreto/revelación, analogía rara, anticipar la objeción.
   Evidencia: prueba y demostración. Incluye: dato/estadística/número, antes/después, prueba social ("se volvió viral", reseñas), mostrar el producto en uso con resultado visible, lista de beneficios concretos, auditoría con números.
   Perdida: lo que el espectador está perdiendo o el problema que le sangra. Incluye: error/advertencia ("estás haciendo mal X"), costo oculto, reframe del problema ("tu problema no es X, es Y"), diagnóstico oculto, miedo a quedarse afuera.
   Identidad: quién es o quién quiere ser el espectador. Incluye: confesión personal, historia/escena narrativa, emoción/vulnerabilidad, filtro de audiencia ("esto es para vos que..."), transformación personal, "si empezara de cero".
   Si el hook no toca claramente ninguno de los 4 mecanismos, "nd")
37. "gancho_formato": (Cómo está PRODUCIDO el hook, independiente del mecanismo: GreenScreen | VozEnOff | POV | ASMR | Unboxing | TextoImpacto | UsoProducto | Situacional | TalkingHead | Otro)
38. "marca_detectada": (El nombre EXACTO de la marca del CONTEXTO DE CLIENTES que detectaste en el video, copiado tal cual de la lista. Si no matchea con ninguna, "nd". Este campo permite auditar contra qué contexto calibraste calificacion y coherencia_marca_publico)
39. "duracion_s": (Duración total del video en segundos, número entero. Si es imagen estática, 0. Si no podés determinarla, -1)
40. "formato_video": (Vertical_9_16 | Cuadrado_1_1 | Horizontal_16_9 | Imagen_Estatica | Otro)
```

---

## Mapeo legacy (lo hace NUSA al leer, NO tocar el Sheet)

Para los videos ya procesados (sin columnas nuevas), `lib/sheet.js` deriva:

- `gancho_familia` desde `tipo_gancho` viejo: Pregunta→Ruptura · Dato/Número→Evidencia ·
  Antes_Despues→Evidencia · Lista→Evidencia · Reseña→Evidencia · Unboxing→Evidencia ·
  UsoProducto→Evidencia · resto (GreenScreen, VozEnOff, POV, ASMR, TextoImpacto, Situacional,
  Otro)→nd (son formatos de producción, no dicen el mecanismo).
- `gancho_formato` desde `tipo_gancho` viejo: GreenScreen, VozEnOff, POV, ASMR, Unboxing,
  TextoImpacto, UsoProducto, Situacional se copian tal cual; el resto →nd.
- `categoria_primaria/secundaria`: Educacional→Educativo · Reseñas→Reseña (normalización de
  vocabulario para que coincida con la nomenclatura de los nombres de anuncios).
