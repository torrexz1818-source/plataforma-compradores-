from typing import Any

CATEGORIES = [
    "Mantenimiento electrico / luminarias",
    "Reparacion de infraestructura",
    "Aire acondicionado",
    "Limpieza",
    "Senalizacion / estacionamiento",
    "Compra de bienes",
    "Servicio recurrente",
    "Consultoria",
    "Obra menor",
    "Seguridad patrimonial",
    "Otro",
]

REQUIREMENT_TYPES = [
    "Servicio",
    "Bien",
    "Servicio + suministro",
    "Mantenimiento",
    "Reparacion",
    "Implementacion",
    "Inspeccion",
    "Consultoria",
    "Obra menor",
    "Otro",
]

SAFETY_OPTIONS = [
    "SCTR",
    "EMO",
    "EPP",
    "IPERC",
    "Procedimiento de trabajo seguro",
    "Permisos de trabajo",
    "Trabajo en altura",
    "Bloqueo y etiquetado",
    "Seguro Vida Ley",
    "Responsabilidad civil",
    "Senalizacion del area",
    "Gestion de residuos",
    "Induccion",
    "Manual del contratista",
    "Plan de rescate",
    "No aplica",
    "Otro",
]

TEMPLATES: dict[str, dict[str, list[str]]] = {
    "Mantenimiento electrico / luminarias": {
        "fields": [
            "Ubicacion de luminarias o equipos",
            "Cantidad de puntos o equipos",
            "Tipo de luminaria o equipo",
            "Altura de trabajo",
            "Medio de acceso requerido",
            "Condiciones de bloqueo y etiquetado",
        ],
        "safety": ["SCTR", "EMO", "EPP", "IPERC", "Permisos de trabajo", "Trabajo en altura", "Bloqueo y etiquetado", "Plan de rescate"],
        "documents": ["Plano o croquis", "Fotos del estado actual", "Ficha tecnica de luminarias", "Listado de puntos"],
    },
    "Reparacion de infraestructura": {
        "fields": ["Zonas afectadas", "Danos visibles", "Causa probable", "Acabado final esperado", "Horarios permitidos"],
        "safety": ["SCTR", "EPP", "Senalizacion del area", "Gestion de residuos", "Procedimiento de trabajo seguro"],
        "documents": ["Fotos antes/despues", "Croquis", "Informe previo", "Medidas del area"],
    },
    "Aire acondicionado": {
        "fields": ["Cantidad de equipos", "Tipo de equipo", "Ubicacion", "Capacidad conocida", "Tipo de mantenimiento"],
        "safety": ["SCTR", "EMO", "EPP", "IPERC", "Permisos de trabajo", "Trabajo en altura"],
        "documents": ["Ficha tecnica", "Fotos", "Listado de equipos", "Historial de mantenimiento"],
    },
    "Limpieza": {
        "fields": ["Area en m2", "Ambientes incluidos", "Frecuencia", "Horario del servicio", "Personal requerido"],
        "safety": ["SCTR", "EPP", "Induccion", "Manual del contratista", "Gestion de residuos"],
        "documents": ["Plano de areas", "Listado de ambientes", "Estandares de limpieza"],
    },
    "Senalizacion / estacionamiento": {
        "fields": ["Zona de intervencion", "Cantidad de espacios", "Medidas", "Senales requeridas", "Materiales"],
        "safety": ["SCTR", "EPP", "Senalizacion del area", "Procedimiento de trabajo seguro"],
        "documents": ["Plano o croquis", "Fotos", "Medidas en campo", "Especificacion de pintura o tachas"],
    },
    "Compra de bienes": {
        "fields": ["Cantidad", "Especificaciones tecnicas", "Marca o modelo sugerido", "Garantia", "Plazo de entrega"],
        "safety": ["No aplica"],
        "documents": ["Ficha tecnica", "Listado de cantidades", "Requisitos de entrega", "Certificaciones"],
    },
    "Consultoria": {
        "fields": ["Objetivo del servicio", "Metodologia esperada", "Perfil del consultor", "Experiencia requerida", "Entregables"],
        "safety": ["No aplica"],
        "documents": ["Terminos previos", "Diagnostico base", "Informes relacionados"],
    },
    "Obra menor": {
        "fields": ["Ubicacion", "Alcance tecnico", "Materiales", "Permisos", "Cronograma"],
        "safety": ["SCTR", "EMO", "EPP", "IPERC", "Permisos de trabajo", "Senalizacion del area", "Gestion de residuos"],
        "documents": ["Plano", "Croquis", "Fotos", "Metrado referencial"],
    },
}


def get_template(category: str | None) -> dict[str, Any]:
    normalized = category or "Otro"
    return TEMPLATES.get(normalized, {
        "fields": ["Detalle tecnico", "Cantidad o alcance", "Condiciones especiales"],
        "safety": ["SCTR", "EPP", "Induccion"],
        "documents": ["Documentos previos", "Fotos", "Fichas tecnicas"],
    })


def base_form_sections(category: str | None = None) -> list[dict[str, Any]]:
    template = get_template(category)
    return [
        {
            "section_title": "Datos generales",
            "fields": [
                {"name": "title", "label": "Nombre del requerimiento", "type": "text", "required": True, "placeholder": "Ejemplo: Servicio de mantenimiento de luminarias del sistema de proteccion patrimonial", "options": []},
                {"name": "requirement_type", "label": "Tipo de requerimiento", "type": "select", "required": True, "placeholder": "", "options": REQUIREMENT_TYPES},
                {"name": "category", "label": "Categoria", "type": "select", "required": True, "placeholder": "", "options": CATEGORIES},
                {"name": "location", "label": "Instalacion o ubicacion", "type": "text", "required": False, "placeholder": "Ejemplo: Terminal Monte Azul Sur, edificio administrativo, zona 2", "options": []},
                {"name": "required_date", "label": "Fecha requerida o urgencia", "type": "text", "required": False, "placeholder": "Ejemplo: Urgente, marzo, 31 de julio, esta semana", "options": []},
            ],
        },
        {
            "section_title": "Alcance y necesidad",
            "fields": [
                {"name": "objective", "label": "Objetivo de la contratacion", "type": "textarea", "required": True, "placeholder": "Describe que se busca lograr con este requerimiento.", "options": []},
                {"name": "scope", "label": "Alcance del servicio o compra", "type": "textarea", "required": True, "placeholder": "Describe que debe realizar el proveedor, zonas incluidas, actividades y limites.", "options": []},
                {"name": "activities", "label": "Actividades requeridas", "type": "textarea", "required": False, "placeholder": "Lista una actividad por linea.", "options": []},
                {"name": "deliverables", "label": "Producto final / entregables", "type": "textarea", "required": True, "placeholder": "Ejemplo: servicio ejecutado, informe tecnico, registro fotografico, acta de conformidad.", "options": []},
                {"name": "justification", "label": "Justificacion", "type": "textarea", "required": True, "placeholder": "Explica que problema resuelve, que riesgo evita o que necesidad atiende.", "options": []},
            ],
        },
        {
            "section_title": "Campos especificos sugeridos",
            "fields": [
                {"name": f"dynamic_{index}", "label": label, "type": "textarea", "required": False, "placeholder": f"Completa: {label.lower()}", "options": []}
                for index, label in enumerate(template["fields"], start=1)
            ],
        },
        {
            "section_title": "Seguridad y presupuesto",
            "fields": [
                {"name": "safety_requirements", "label": "Requisitos de seguridad", "type": "multiselect", "required": False, "placeholder": "", "options": SAFETY_OPTIONS},
                {"name": "budget_project", "label": "Proyecto", "type": "text", "required": False, "placeholder": "", "options": []},
                {"name": "budget_cost_center", "label": "Centro de costos", "type": "text", "required": False, "placeholder": "", "options": []},
                {"name": "budget_account", "label": "Cuenta", "type": "text", "required": False, "placeholder": "", "options": []},
                {"name": "budget_reference", "label": "Presupuesto referencial", "type": "text", "required": False, "placeholder": "", "options": []},
                {"name": "currency", "label": "Moneda", "type": "select", "required": False, "placeholder": "", "options": ["PEN", "USD", "EUR", "Otro"]},
            ],
        },
        {
            "section_title": "Documentos e instrucciones",
            "fields": [
                {"name": "files", "label": "Documentos de apoyo", "type": "file", "required": False, "placeholder": "Puedes subir planos, fichas tecnicas, fotos, croquis, Excel o PDF base.", "options": ["PDF", "DOCX", "XLSX", "CSV", "JPG", "JPEG", "PNG"]},
                {"name": "additional_instructions", "label": "Instrucciones adicionales", "type": "textarea", "required": False, "placeholder": "Agrega restricciones, condiciones especiales, criterios tecnicos, marcas sugeridas, zonas criticas, horarios permitidos, exclusiones o comentarios para el proveedor.", "options": []},
            ],
        },
    ]
