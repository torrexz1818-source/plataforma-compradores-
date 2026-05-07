from pathlib import Path


def read_image(path: Path) -> tuple[str, list[str]]:
    try:
        from PIL import Image
        import pytesseract
    except ImportError:
        return (
            "",
            [
                "OCR de imágenes no está configurado. Instala pytesseract, Pillow y el binario Tesseract para extraer texto de imágenes."
            ],
        )

    try:
        with Image.open(path) as image:
            return pytesseract.image_to_string(image), []
    except Exception:
        return "", ["No se pudo extraer texto de la imagen con OCR."]
