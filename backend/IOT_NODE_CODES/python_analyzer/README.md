# RF24 Scanner — Analizador Python

## Requisitos
- Python 3.9+

## Instalación

```bash
cd python_analyzer
pip install -r requirements.txt
```

## Uso

### Todos los nodos
```bash
python analyzer.py scan.csv
```

### Solo un nodo
```bash
python analyzer.py scan.csv --slot 1
```

### Nombre de salida personalizado
```bash
python analyzer.py scan.csv --output mapa_zona.html
```

## Resultado

Abre el `.html` generado en cualquier navegador.
Incluye mapa de calor, marcadores por nodo, leyenda y estadísticas.

## Escala de colores

| Color    | RSSI        | Calidad   |
|----------|-------------|-----------|
| Verde    | > -60 dBm  | Excelente |
| Amarillo | -60 a -70  | Buena     |
| Naranja  | -70 a -80  | Regular   |
| Rojo     | < -80 dBm  | Débil     |
