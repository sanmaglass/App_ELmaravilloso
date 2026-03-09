import subprocess
import requests
import os
import json

# Configuración
DB_PATH = r'127.0.0.1:C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB'
ISQL_PATH = r'C:\Program Files (x86)\AbarrotesPDV\isql.exe'
DB_USER = 'SYSDBA'
DB_PASS = 'masterkey'

URL = 'https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales'
KEY = 'sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB'
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

def run_query(query_text):
    query_file = 'audit_query.sql'
    with open(query_file, 'w') as f:
        f.write(f"CONNECT '{DB_PATH}' USER '{DB_USER}' PASSWORD '{DB_PASS}';\n")
        f.write("SET HEADING OFF;\n")
        f.write(query_text + "\n")
        f.write("QUIT;\n")
    
    try:
        result = subprocess.run([ISQL_PATH, '-i', query_file], capture_output=True, text=True, timeout=30)
        if result.stderr:
            print(f"DEBUG ISQL Error: {result.stderr}")
        return result.stdout
    except Exception as e:
        print(f"DEBUG Subprocess Error: {e}")
        return ""
    finally:
        if os.path.exists(query_file): os.remove(query_file)

import sys

# Forzar salida en UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 1. Obtener los últimos 20 tickets de Eleventa (sin importar la fecha)
print('Consultando los últimos 20 tickets en Eleventa...')
query_latest = """
SELECT FIRST 20 V.TICKET_ID, CAST(V.FECHA_HORA AS VARCHAR(20)), V.SUBTOTAL + V.IMPUESTOS, V.ESTA_CANCELADO
FROM VENTATICKETS V
ORDER BY V.TICKET_ID DESC;
"""
out_latest = run_query(query_latest)
ele_latest = []
if out_latest:
    for line in out_latest.split('\n'):
        parts = [p.strip() for p in line.split() if p.strip()]
        if len(parts) >= 4:
            try:
                ele_latest.append({
                    'tid': int(parts[0]), 
                    'ts': parts[1] + ' ' + parts[2],
                    'total': float(parts[3]), 
                    'cancelled': parts[4].lower()
                })
            except: continue

if ele_latest:
    print(f'Ultimo ticket en Eleventa: #{ele_latest[0]["tid"]} del {ele_latest[0]["ts"]}')
    print('\nLista de los últimos 10 en Eleventa:')
    for e in ele_latest[:10]:
        print(f'  - #{e["tid"]} | {e["ts"]} | ${e["total"]} | {e["cancelled"]}')
else:
    print('No se pudieron obtener los últimos tickets de Eleventa.')

# 2. Obtener lo que hay en Supabase hoy
print('\nConsultando Supabase (Últimos 20)...')
r = requests.get(f"{URL}?select=ticket_id,total,date&order=ticket_id.desc&limit=20", headers=HEADERS)
supabase_rows = r.json()
print(f'Ultimo ticket en Supabase: #{supabase_rows[0]["ticket_id"]} del {supabase_rows[0]["date"]}')

# 3. Comparativa de brechas
ele_set = {e['tid'] for e in ele_latest}
supa_set = {s['ticket_id'] for s in supabase_rows}

print('\n--- ANALISIS DE DISCREPANCIAS ---')
for e in ele_latest:
    if e['tid'] not in supa_set and e['total'] > 0 and e['cancelled'] not in ('t', '1', 'y'):
        print(f'FALTA EN NUBE: Ticket #{e["tid"]} (${e["total"]})')
    elif e['tid'] in supa_set:
        # Check monto
        s_total = next(s['total'] for s in supabase_rows if s['ticket_id'] == e['tid'])
        if abs(e['total'] - s_total) > 1:
            print(f'DIFERENCIA MONTO: Ticket #{e["tid"]} (Eleventa: {e["total"]} vs Nube: {s_total})')

print('\nFin de auditoría.')
