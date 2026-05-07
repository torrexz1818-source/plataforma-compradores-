# AI Engine - Comparativos de propuestas de proveedores

Este motor FastAPI implementa el MVP del agente de IA "Comparativos de propuestas de proveedores" para Buyer Nodus. Recibe propuestas, extrae texto de forma temporal, consulta OpenAI y devuelve un JSON comparativo con ranking, riesgos, información faltante y recomendación final.

## Privacidad

No se almacenan archivos, textos extraídos ni resultados. El procesamiento es temporal.

## Instalación

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Linux/Mac:

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

## Configuración

Copia `.env.example` como `.env` y configura tu clave:

```bash
OPENAI_API_KEY=tu_clave
OPENAI_MODEL=gpt-4.1-mini
MAX_FILES_PER_ANALYSIS=5
MAX_FILE_SIZE_MB=10
DELETE_TEMP_FILES=true
STORE_UPLOADS=false
STORE_EXTRACTED_TEXT=false
```

No hardcodees claves API en el código.

## Ejecución local

Desde la carpeta `ai-engine/`. El motor corre internamente en `8000`, pero el frontend lo consume desde `http://localhost:5173/ai-engine` mediante el proxy local de Vite.

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Endpoint principal

`POST /agents/proposal-comparison/analyze`

Acepta `multipart/form-data`:

- `title`: string opcional
- `service`: string obligatorio
- `objective`: string opcional
- `criteria`: JSON opcional
- `files`: múltiples archivos

Formatos soportados: PDF, DOCX, XLSX, CSV, JPG, JPEG y PNG.

## Ejemplo de curl

```bash
curl -X POST "http://localhost:8000/agents/proposal-comparison/analyze" \
  -F "title=Comparativo limpieza oficinas" \
  -F "service=Servicio de limpieza integral de oficinas 300 m²" \
  -F "objective=Seleccionar el proveedor más conveniente considerando precio, alcance, garantía y riesgo operativo" \
  -F "files=@./samples/propuesta1.pdf" \
  -F "files=@./samples/propuesta2.pdf"
```

## Ejemplo de respuesta

```json
{
  "analysis_title": "Comparativo limpieza oficinas",
  "service": "Servicio de limpieza integral de oficinas 300 m²",
  "objective": "Seleccionar el proveedor más conveniente considerando precio, alcance, garantía y riesgo operativo",
  "executive_summary": "Se compararon las propuestas considerando precio, alcance y riesgos.",
  "recommended_supplier": "Proveedor A",
  "ranking": [
    {
      "position": 1,
      "supplier_name": "Proveedor A",
      "score": 88,
      "reason": "Mejor equilibrio entre alcance, condiciones y riesgo.",
      "main_strengths": ["Alcance claro"],
      "main_risks": ["Falta confirmar vigencia"]
    }
  ],
  "suppliers": [],
  "comparison_table": [],
  "global_risks": [],
  "missing_information": [],
  "questions_for_suppliers": [],
  "final_recommendation": "Validar la información faltante antes de adjudicar.",
  "disclaimer": "Este análisis es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final."
}
```

## Notas del MVP

- El scoring normaliza puntajes de 0 a 100 y ordena el ranking sugerido por IA.
- El OCR de imágenes requiere `pytesseract`, `Pillow` y el binario Tesseract instalado en el sistema.
- Los archivos temporales se eliminan al finalizar el análisis, incluso si ocurre un error.
## Agente: Elaboracion de terminos de referencia - Fase 2

Este agente ayuda al comprador a crear un termino de referencia corporativo de forma guiada. El flujo tiene dos pasos:

1. El comprador describe que necesita realizar y el AI Engine clasifica el requerimiento para devolver un formulario inteligente por categoria.
2. El comprador completa el formulario, adjunta documentos de apoyo opcionales y genera un termino de referencia estructurado, con validacion basica de calidad y PDF descargable.

Endpoints:

- `POST /agents/terms-of-reference/form-schema`
- `POST /agents/terms-of-reference/generate`
- `POST /agents/terms-of-reference/generate-pdf`

Variables de entorno:

```bash
OPENAI_API_KEY=tu_clave
OPENAI_MODEL=gpt-4.1-mini
MAX_FILE_SIZE_MB=10
DELETE_TEMP_FILES=true
```

Ejecucion local:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Linux/Mac:

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Ejemplo `form-schema`:

```bash
curl -X POST "http://localhost:8000/agents/terms-of-reference/form-schema" \
  -H "Content-Type: application/json" \
  -d "{\"initial_description\":\"Necesito mantenimiento de luminarias en planta\"}"
```

Ejemplo `generate`:

```bash
curl -X POST "http://localhost:8000/agents/terms-of-reference/generate" \
  -F "initial_description=Necesito mantenimiento de luminarias en planta" \
  -F "title=Servicio de mantenimiento de luminarias" \
  -F "requirement_type=Mantenimiento" \
  -F "category=Mantenimiento electrico / luminarias" \
  -F "location=Terminal Monte Azul Sur" \
  -F "required_date=Marzo" \
  -F "objective=Asegurar la operatividad de luminarias del sistema de proteccion patrimonial" \
  -F "scope=Inspeccion, mantenimiento, ajuste de conexiones, verificacion electrica y entrega de informe tecnico" \
  -F "activities=Verificacion de funcionamiento; bloqueo y etiquetado; inspeccion de conexiones; limpieza; informe tecnico" \
  -F "deliverables=Servicio ejecutado; informe tecnico; registro fotografico; recomendaciones" \
  -F "justification=Cumplimiento del programa de mantenimiento preventivo y reduccion de riesgos operativos" \
  -F "additional_instructions=Considerar trabajos en altura y requisitos SSMA" \
  -F "files=@./samples/plano.pdf"
```

Ejemplo de PDF:

```bash
curl -X POST "http://localhost:8000/agents/terms-of-reference/generate-pdf" \
  -H "Content-Type: application/json" \
  -d "{\"document\":{...}}" \
  --output termino_referencia.pdf
```

Formatos soportados: PDF, DOCX, XLSX, CSV, JPG, JPEG y PNG. No se implementan DWG, DXF, BIM ni IFC en esta fase.

Privacidad: los archivos se guardan solo como temporales, se eliminan al finalizar el proceso y no se almacenan documentos, textos extraidos ni resultados.

Limitaciones del MVP/Fase 2:

- La lectura de imagenes depende de Tesseract instalado en el sistema.
- Los planos complejos se procesan solo por texto extraible u OCR basico.
- La IA no debe inventar datos; la informacion faltante queda marcada para validacion del comprador.
