"""
RF24 Scanner — Analizador Python v2
=====================================
Mapa de calor CONTINUO por zona (no por punto).
- Un HeatMap por nodo, cada uno en su propia capa seleccionable
- Gradiente verde→amarillo→naranja→rojo según RSSI
- Sin tono azul — fondo transparente para ver las calles
- Marcadores individuales con popup de detalle
- Compatible con CSV exportado por la app

Uso:
    python analyzer_v2.py scan.csv
    python analyzer_v2.py scan1.csv scan2.csv scan3.csv   (combina varios)
    python analyzer_v2.py scan.csv --output mapa.html
    python analyzer_v2.py scan.csv --zoom 19
"""

import sys, argparse, os
from pathlib import Path

try:
    import pandas as pd
    import folium
    from folium.plugins import HeatMap
except ImportError:
    print("\n[ERROR] Faltan dependencias. Ejecuta:")
    print("    pip install pandas folium\n")
    sys.exit(1)


# ── Mapeo slot → etiqueta ─────────────────────────────────────────────────────
SLOT_LABELS = {
    1: 'NODE1', 2: 'NODE2', 3: 'NODE3',
    4: 'NODE4', 5: 'NODE5', 6: 'RPT01',
}

# ── Color marcador por RSSI ───────────────────────────────────────────────────
def marker_color(rssi: float) -> str:
    if rssi >= -60: return 'green'
    if rssi >= -70: return 'orange'
    if rssi >= -80: return 'red'
    return 'darkred'

def rssi_label(rssi: float) -> str:
    if rssi >= -60: return 'Excelente'
    if rssi >= -70: return 'Buena'
    if rssi >= -80: return 'Regular'
    return 'Débil'


# ── Cargar y limpiar CSV ──────────────────────────────────────────────────────
def load_csv(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    required = {'recordedAt','seq','slot','ok','rssi','lat','lng'}
    missing = required - set(df.columns)
    if missing:
        print(f"[ERROR] Columnas faltantes en {filepath}: {missing}")
        sys.exit(1)

    df['ok']         = df['ok'].astype(str).str.lower() == 'true'
    df['rssi']       = pd.to_numeric(df['rssi'], errors='coerce')
    df['lat']        = pd.to_numeric(df['lat'],  errors='coerce')
    df['lng']        = pd.to_numeric(df['lng'],  errors='coerce')
    df['slot']       = pd.to_numeric(df['slot'], errors='coerce').astype(int)
    df['recordedAt'] = pd.to_datetime(df['recordedAt'], errors='coerce')

    # Solo puntos con GPS válido y que respondieron
    df = df.dropna(subset=['lat','lng','rssi'])
    df = df[df['ok'] == True]
    df = df[df['lat'] != 0]
    df = df[df['rssi'] > -128]   # descartar no-respuesta

    return df


# ── Generar mapa ──────────────────────────────────────────────────────────────
def generate_map(df: pd.DataFrame, output: str, zoom: int):
    if len(df) == 0:
        print("[ERROR] Sin puntos válidos.")
        sys.exit(1)

    center_lat = df['lat'].mean()
    center_lng = df['lng'].mean()

    # Mapa base — CartoDB Voyager: buen contraste, sin tono azul
    m = folium.Map(
        location=[center_lat, center_lng],
        zoom_start=zoom,
        tiles='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attr='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        max_zoom=21,
    )

    slots = sorted(df['slot'].unique())

    for slot_id in slots:
        label = SLOT_LABELS.get(slot_id, f'NODE{slot_id}')
        slot_df = df[df['slot'] == slot_id].copy()

        if len(slot_df) == 0:
            continue

        # ── HeatMap continuo ──────────────────────────────────────────────────
        # El peso es el RSSI normalizado: -40=1.0 (verde), -100=0.0 (rojo)
        # Invertido para que verde=señal fuerte
        slot_df['weight'] = (slot_df['rssi'] - (-100)) / ((-40) - (-100))
        slot_df['weight'] = slot_df['weight'].clip(0, 1)

        heat_data = slot_df[['lat','lng','weight']].values.tolist()

        # Gradiente SIN azul: rojo→naranja→amarillo→verde
        # El punto clave: no incluir valores 0.0 para evitar el tono azul/morado
        gradient = {
            0.3: '#ff0000',   # rojo     — señal débil
            0.5: '#ff6600',   # naranja
            0.7: '#ffcc00',   # amarillo
            0.85: '#99ff00',  # verde claro
            1.0: '#00cc00',   # verde    — señal excelente
        }

        heat_layer = HeatMap(
            heat_data,
            name=f'Calor {label}',
            min_opacity=0.35,   # opacity mínima — evita zonas "vacías" con color
            max_zoom=21,
            radius=25,          # radio de influencia por punto (metros a este zoom)
            blur=20,            # suavizado entre puntos
            gradient=gradient,
            show=True,
        )

        # ── Marcadores individuales ───────────────────────────────────────────
        markers_fg = folium.FeatureGroup(name=f'Puntos {label}', show=False)

        for _, row in slot_df.iterrows():
            hora = row['recordedAt'].strftime('%H:%M:%S') if pd.notna(row['recordedAt']) else 'N/A'
            folium.CircleMarker(
                location=[row['lat'], row['lng']],
                radius=4,
                color=marker_color(row['rssi']),
                fill=True,
                fill_opacity=0.85,
                popup=folium.Popup(
                    f"<b>{label}</b><br>"
                    f"RSSI: <b>{row['rssi']:.0f} dBm</b><br>"
                    f"Calidad: {rssi_label(row['rssi'])}<br>"
                    f"Hora: {hora}<br>"
                    f"Seq: {int(row['seq'])}",
                    max_width=180
                ),
                tooltip=f"{label}: {row['rssi']:.0f} dBm",
            ).add_to(markers_fg)

        # Agregar capas en orden: calor primero, marcadores encima
        heat_layer.add_to(m)
        markers_fg.add_to(m)

    # ── Leyenda ───────────────────────────────────────────────────────────────
    legend_html = """
    <div style="position:fixed;bottom:30px;left:10px;z-index:1000;
                background:white;padding:10px 14px;border-radius:8px;
                border:2px solid #ccc;font-size:12px;font-family:monospace;
                box-shadow:2px 2px 6px rgba(0,0,0,.3)">
      <b>🎨 Intensidad de señal RF24</b><br>
      <div style="margin-top:6px">
        <span style="display:inline-block;width:14px;height:14px;background:#00cc00;
              border-radius:3px;vertical-align:middle;margin-right:4px"></span>
        &gt; -60 dBm — Excelente
      </div>
      <div>
        <span style="display:inline-block;width:14px;height:14px;background:#ffcc00;
              border-radius:3px;vertical-align:middle;margin-right:4px"></span>
        -60 a -70 dBm — Buena
      </div>
      <div>
        <span style="display:inline-block;width:14px;height:14px;background:#ff6600;
              border-radius:3px;vertical-align:middle;margin-right:4px"></span>
        -70 a -80 dBm — Regular
      </div>
      <div>
        <span style="display:inline-block;width:14px;height:14px;background:#ff0000;
              border-radius:3px;vertical-align:middle;margin-right:4px"></span>
        &lt; -80 dBm — Débil
      </div>
      <hr style="margin:6px 0;border-color:#eee">
      <span style="font-size:10px;color:#888">
        Activa "Puntos X" en capas para ver detalle
      </span>
    </div>
    """
    m.get_root().html.add_child(folium.Element(legend_html))

    # ── Panel de estadísticas ─────────────────────────────────────────────────
    stats_lines = ["<b>📊 Estadísticas</b><br>"]
    for slot_id in slots:
        label = SLOT_LABELS.get(slot_id, f'NODE{slot_id}')
        s = df[df['slot'] == slot_id]
        stats_lines.append(
            f"{label}: {len(s)} pts · "
            f"avg <b>{s['rssi'].mean():.0f}</b> dBm<br>"
        )
    stats_lines.append(f"<hr style='margin:4px 0;border-color:#eee'>")
    stats_lines.append(f"Total: <b>{len(df)}</b> puntos")

    stats_html = (
        "<div style='position:fixed;top:80px;right:10px;z-index:1000;"
        "background:white;padding:10px;border-radius:8px;"
        "border:2px solid #ccc;font-size:12px;font-family:monospace;"
        "box-shadow:2px 2px 6px rgba(0,0,0,.3)'>"
        + "".join(stats_lines) + "</div>"
    )
    m.get_root().html.add_child(folium.Element(stats_html))

    # ── Control de capas ──────────────────────────────────────────────────────
    folium.LayerControl(collapsed=False).add_to(m)

    m.save(output)
    print(f"\n[OK] Mapa guardado: {output}")
    print(f"     Abre en navegador: start {output}")
    print(f"\n     Capas disponibles en el panel superior derecho:")
    for slot_id in slots:
        label = SLOT_LABELS.get(slot_id, f'NODE{slot_id}')
        print(f"       - Calor {label}  (mapa de calor continuo)")
        print(f"       - Puntos {label} (marcadores individuales, off por defecto)")


# ── Reporte consola ───────────────────────────────────────────────────────────
def print_report(df: pd.DataFrame):
    print("\n" + "="*48)
    print("  REPORTE DE COBERTURA RF24")
    print("="*48)
    print(f"  Total puntos válidos : {len(df)}")
    print(f"  RSSI promedio        : {df['rssi'].mean():.1f} dBm")
    print(f"  RSSI min / max       : {df['rssi'].min():.0f} / {df['rssi'].max():.0f} dBm\n")
    for slot_id in sorted(df['slot'].unique()):
        label = SLOT_LABELS.get(slot_id, f'NODE{slot_id}')
        s = df[df['slot'] == slot_id]
        print(f"  {label}: {len(s):4d} pts | "
              f"avg {s['rssi'].mean():.1f} dBm | "
              f"min {s['rssi'].min():.0f} | max {s['rssi'].max():.0f} dBm "
              f"({rssi_label(s['rssi'].mean())})")
    print("="*48)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(
        description='RF24 Scanner — Mapa de calor por zona v2'
    )
    p.add_argument('csv', nargs='+',
                   help='Uno o más archivos CSV (se combinan en un solo mapa)')
    p.add_argument('--output', default=None,
                   help='Nombre del HTML de salida')
    p.add_argument('--zoom', type=int, default=18,
                   help='Zoom inicial del mapa (default: 18)')
    args = p.parse_args()

    # Cargar y combinar todos los CSVs
    frames = []
    for csv_path in args.csv:
        if not os.path.exists(csv_path):
            print(f"[ERROR] No existe: {csv_path}")
            sys.exit(1)
        print(f"[CSV] Cargando {csv_path}...")
        frames.append(load_csv(csv_path))

    df = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]
    print(f"[CSV] Total combinado: {len(df)} puntos válidos")

    if args.output is None:
        stem = Path(args.csv[0]).stem
        args.output = f"mapa_{stem}.html"

    print_report(df)
    generate_map(df, args.output, args.zoom)


if __name__ == '__main__':
    main()
