import requests
import json

URL = 'https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales'
KEY = 'sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB'
HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Prefer': 'count=exact'
}

print("--- REPORTE SUPABASE (MARZO 2026) ---")

# 1. Conteo Total
r_count = requests.get(f"{URL}?date=gte.2026-03-01T00:00:00", headers=HEADERS)
count = r_count.headers.get("Content-Range", "0-0/0").split("/")[-1]
print(f"Total en Nube (Marzo): {count}")

# 2. Últimos 10 Tickets
r_last = requests.get(f"{URL}?select=ticket_id,total,date&order=ticket_id.desc&limit=10", headers=HEADERS)
print("\nÚltimos 10 Tickets:")
for t in r_last.json():
    print(f"#{t['ticket_id']} | ${t['total']} | {t['date']}")

# 3. Tickets de HOY (Marzo 9)
r_today = requests.get(f"{URL}?date=gte.2026-03-09T00:00:00&select=ticket_id,total,date&order=ticket_id.asc", headers=HEADERS)
data_today = r_today.json()
print(f"\nTickets de Hoy: {len(data_today)}")
if data_today:
    print(f"Rango de Hoy: #{data_today[0]['ticket_id']} - #{data_today[-1]['ticket_id']}")
    total_monto = sum(t['total'] for t in data_today)
    print(f"Total Monto Hoy: ${total_monto:,.0f}")
