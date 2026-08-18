"""
RF24 Scanner — Analizador Python
=================================
Lee el CSV exportado por la app y genera un
mapa de calor interactivo sobre OpenStreetMap.

Uso:
    python analyzer.py scan.csv
    python analyzer.py scan.csv --slot 1
    python analyzer.py scan.csv --output mapa.html
"""

import sys, argparse, os
from pathlib import Path

try:
    import pandas as pd
    import folium
    from folium.plugins import HeatMap
except ImportError:
    print("\n[ERROR] Faltan dependencias. Ejecuta:")
    print("    pip install -r requirements.txt\n")
    sys.exit(1)


def rssi_color(rssi: float) -> str:
    if rssi >= -60: return 'green'
    if rssi >= -70: return 'yellow'
    if rssi >= -80: return 'orange'
    return 'red'

def rssi_label(rssi: float) -> str:
    if rssi >= -60: return 'Excelente'
    if rssi >= -70: return 'Buena'
    if rssi >= -80: return 'Regular'
    return 'Débil'


def load_csv(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    required = {'recordedAt','seq','slot','ok','rssi','lat','lng'}
    missing = required - set(df.columns)
    if missing:
        print(f"[ERROR] Columnas faltantes: {missing}")
        sys.exit(1)

    df['ok']        = df['ok'].astype(str).str.lower() == 'true'
    df['rssi']      = pd.to_numeric(df['rssi'], errors='coerce')
    df['lat']       = pd.to_numeric(df['lat'],  errors='coerce')
    df['lng']       = pd.to_numeric(df['lng'],  errors='coerce')
    df['slot']      = pd.to_numeric(df['slot'], errors='coerce').astype(int)
    df['recordedAt']= pd.to_datetime(df['recordedAt'], errors='coerce')

    df = df.dropna(subset=['lat','lng','rssi'])
    df = df[df['ok'] == True]
    df = df[df['lat'] != 0]

    print(f"[CSV] {len(df)} puntos válidos cargados")
    return df


def generate_map(df: pd.DataFrame, output: str, slot_filter):
    if slot_filter is not None:
        df = df[df['slot'] == slot_filter]
        print(f"[FILTRO] Slot {slot_filter}: {len(df)} puntos")

    if len(df) == 0:
        print("[ERROR] Sin puntos válidos.")
        sys.exit(1)

    center_lat = df['lat'].mean()
    center_lng = df['lng'].mean()

    m = folium.Map(location=[center_lat, center_lng], zoom_start=17, tiles='OpenStreetMap')

    # ── Mapa de calor ──────────────────────────────────────────────
    min_rssi   = df['rssi'].min()
    max_rssi   = df['rssi'].max()
    rssi_range = max_rssi - min_rssi if max_rssi != min_rssi else 1

    heat_data = [
        [r['lat'], r['lng'], (r['rssi'] - min_rssi) / rssi_range]
        for _, r in df.iterrows()
    ]

    HeatMap(
        heat_data,
        name='Mapa de calor RF24',
        min_opacity=0.3,
        radius=20, blur=15,
        gradient={0.0:'blue', 0.3:'red', 0.6:'orange', 0.8:'yellow', 1.0:'green'},
    ).add_to(m)

    # ── Marcadores por slot ────────────────────────────────────────
    for slot_id in sorted(df['slot'].unique()):
        fg = folium.FeatureGroup(name=f'NODE{slot_id}', show=True)
        for _, r in df[df['slot']==slot_id].iterrows():
            hora = r['recordedAt'].strftime('%H:%M:%S') if pd.notna(r['recordedAt']) else 'N/A'
            folium.CircleMarker(
                location=[r['lat'], r['lng']],
                radius=5,
                color=rssi_color(r['rssi']),
                fill=True, fill_opacity=0.7,
                popup=folium.Popup(
                    f"<b>NODE{r['slot']}</b><br>"
                    f"RSSI: {r['rssi']:.0f} dBm<br>"
                    f"Calidad: {rssi_label(r['rssi'])}<br>"
                    f"Hora: {hora}",
                    max_width=200
                ),
                tooltip=f"NODE{r['slot']}: {r['rssi']:.0f} dBm"
            ).add_to(fg)
        fg.add_to(m)

    # ── Leyenda ────────────────────────────────────────────────────
    m.get_root().html.add_child(folium.Element("""
    <div style="position:fixed;bottom:30px;left:30px;z-index:1000;
                background:white;padding:12px;border-radius:8px;
                border:2px solid #ccc;font-size:13px;font-family:monospace">
      <b>🎨 RSSI Señal RF24</b><br>
      <span style="color:green">●</span> &gt; -60 dBm — Excelente<br>
      <span style="color:#cccc00">●</span> -70 dBm — Buena<br>
      <span style="color:orange">●</span> -80 dBm — Regular<br>
      <span style="color:red">●</span> &lt; -80 dBm — Débil
    </div>
    """))

    # ── Stats ──────────────────────────────────────────────────────
    lines = ["<b>📊 Estadísticas</b><br>"]
    for sid in sorted(df['slot'].unique()):
        s = df[df['slot']==sid]
        lines.append(f"NODE{sid}: {len(s)} pts · avg {s['rssi'].mean():.0f} dBm<br>")

    m.get_root().html.add_child(folium.Element(
        f'<div style="position:fixed;top:80px;right:10px;z-index:1000;'
        f'background:white;padding:10px;border-radius:8px;border:2px solid #ccc;'
        f'font-size:12px;font-family:monospace">{"".join(lines)}'
        f'Total: {len(df)} puntos</div>'
    ))

    folium.LayerControl(collapsed=False).add_to(m)
    m.save(output)

    print(f"\n[OK] Mapa guardado: {output}")
    print(f"     Abrir en navegador: start {output}")


def print_report(df: pd.DataFrame):
    print("\n" + "="*45)
    print("  REPORTE DE COBERTURA RF24")
    print("="*45)
    print(f"  Total puntos : {len(df)}")
    print(f"  RSSI promedio: {df['rssi'].mean():.1f} dBm")
    print(f"  RSSI min/max : {df['rssi'].min():.0f} / {df['rssi'].max():.0f} dBm\n")
    for sid in sorted(df['slot'].unique()):
        s = df[df['slot']==sid]
        print(f"  NODE{sid}: {len(s)} pts | avg {s['rssi'].mean():.1f} dBm ({rssi_label(s['rssi'].mean())})")
    print("="*45)


def main():
    p = argparse.ArgumentParser(description='Genera mapa de calor RF24 desde CSV')
    p.add_argument('csv')
    p.add_argument('--slot',   type=int, default=None, help='Filtrar por slot 1-5')
    p.add_argument('--output', default=None,            help='Nombre HTML de salida')
    args = p.parse_args()

    if not os.path.exists(args.csv):
        print(f"[ERROR] No existe: {args.csv}")
        sys.exit(1)

    if args.output is None:
        args.output = f"mapa_{Path(args.csv).stem}.html"

    df = load_csv(args.csv)
    print_report(df)
    generate_map(df, args.output, args.slot)


if __name__ == '__main__':
    main()
