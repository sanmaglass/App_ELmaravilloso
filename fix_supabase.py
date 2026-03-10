import requests
import json

URL = 'https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales'
KEY = 'sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB'
HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json'
}

print("--- LIMPIANDO TICKETS DE PRUEBA ($0) ---")

# 1. Buscar tickets con total $0
r = requests.get(f"{URL}?total=eq.0&select=id,ticket_id", headers=HEADERS)
to_delete = r.json()

if not to_delete:
    print("No se encontraron tickets con total $0.")
else:
    print(f"Encontrados {len(to_delete)} tickets con total $0.")
    for t in to_delete:
        print(f"Eliminando ID {t['id']} (Ticket #{t['ticket_id']})...")
        rd = requests.delete(f"{URL}?id=eq.{t['id']}", headers=HEADERS)
        if rd.status_code in [200, 204]:
            print(f"OK: Ticket #{t['ticket_id']} eliminado.")
        else:
            print(f"Error al eliminar #{t['ticket_id']}: {rd.text}")

print("\nListo. Los tickets de $0 han sido purgados de la nube.")
