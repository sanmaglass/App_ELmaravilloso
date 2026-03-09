import subprocess
import requests
import time
import json
import os
import sys
import logging

# ==========================================
# GESTIÓN DE CONFIGURACIÓN (V6.0 MODULAR)
# ==========================================
SETTINGS_FILE = "settings.json"

def load_settings():
    default_settings = {
        "supabase_url_sales": "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales",
        "supabase_url_daily": "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/daily_sales",
        "supabase_key": "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB",
        "db_path": r"127.0.0.1:C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB",
        "db_user": "SYSDBA",
        "db_pass": "masterkey",
        "isql_path": r"C:\Program Files (x86)\AbarrotesPDV\isql.exe",
        "timezone_offset": "-03:00",
        "sync_start_date": "2026-03-01 00:00:00"
    }
    
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                user_settings = json.load(f)
                default_settings.update(user_settings)
                return default_settings
        except Exception as e:
            print(f"Error cargando {SETTINGS_FILE}: {e}")
            return default_settings
    else:
        # Crear archivo por defecto si no existe
        try:
            with open(SETTINGS_FILE, "w") as f:
                json.dump(default_settings, f, indent=4)
        except: pass
        return default_settings

# Cargar configuración global
cfg = load_settings()

SUPABASE_URL_SALES = cfg["supabase_url_sales"]
SUPABASE_URL_DAILY = cfg["supabase_url_daily"]
SUPABASE_KEY = cfg["supabase_key"]
DB_PATH = cfg["db_path"]
DB_USER = cfg["db_user"]
DB_PASS = cfg["db_pass"]
ISQL_PATH = cfg["isql_path"]
TIMEZONE_OFFSET = cfg["timezone_offset"]
SYNC_START_DATE = cfg["sync_start_date"]

STATE_FILE_TICKETS = "ultimo_ticket.txt"
STATE_FILE_TURNOS  = "ultimo_turno.txt"
LOG_FILE = "eleventa_monitor.log"

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

def print_log(msg):
    logging.info(msg)

def run_query(query_text):
    query_file = "temp_query.sql"
    try:
        with open(query_file, "w") as f:
            f.write(f"CONNECT '{DB_PATH}' USER '{DB_USER}' PASSWORD '{DB_PASS}';\n")
            f.write("SET HEADING OFF;\n")
            f.write(query_text + "\n")
            f.write("QUIT;\n")
        
        result = subprocess.run(
            [ISQL_PATH, "-i", query_file],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.stderr:
            print_log(f"Error en ISQL: {result.stderr}")
            return None
        return result.stdout
    except Exception as e:
        print_log(f"Error ejecutando query: {e}")
        return None
    finally:
        if os.path.exists(query_file):
            os.remove(query_file)

def check_exists_in_supabase(url, column_name, value):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    params = {
        column_name: f"eq.{value}",
        "select": "id"
    }
    try:
        r = requests.get(url, headers=headers, params=params)
        if r.status_code == 200:
            return len(r.json()) > 0
        return False
    except:
        return False

def push_to_supabase(url, data, description="Registro"):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Escudo Anti-Duplicados
    if "ticket_id" in data:
        if check_exists_in_supabase(url, "ticket_id", data["ticket_id"]):
            return True
            
    try:
        r = requests.post(url, headers=headers, data=json.dumps(data))
        if r.status_code in [200, 201]:
            print_log(f"✅ {description} sincronizado en la nube.")
            return True
        else:
            print_log(f"❌ Error Supabase ({r.status_code}): {r.text}")
            return False
    except Exception as e:
        print_log(f"❌ Error de red: {e}")
        return False

def get_last_processed(filename):
    if os.path.exists(filename):
        with open(filename, "r") as f:
            content = f.read().strip()
            return int(content) if content.isdigit() else 0
    return 0

def save_last_processed(filename, value):
    with open(filename, "w") as f:
        f.write(str(value))

def parse_sales(output):
    sales = []
    if not output: return sales
    lines = output.split("\n")
    for line in lines:
        parts = [p.strip() for p in line.split() if p.strip()]
        if len(parts) >= 5:
            try:
                sales.append({
                    "ticket_id": int(parts[0]),
                    "date": parts[1] + "T" + parts[2] + TIMEZONE_OFFSET,
                    "total": float(parts[3]),
                    "profit": float(parts[4]),
                    "items_count": int(parts[5]) if len(parts) > 5 else 1
                })
            except: continue
    return sales

def parse_shifts(output):
    shifts = []
    if not output: return shifts
    lines = output.split("\n")
    for line in lines:
        parts = [p.strip() for p in line.split() if p.strip()]
        if len(parts) >= 4:
            try:
                shifts.append({
                    "id_eleventa": int(parts[0]),
                    "date": parts[1], 
                    "cash": float(parts[2]),
                    "debit": float(parts[3]),
                    "total": float(parts[2]) + float(parts[3]),
                    "notes": "Sincronizado desde Eleventa"
                })
            except: continue
    return shifts

def main():
    print_log(f"🚀 Iniciando Monitor V6.0 (Zona Horaria: {TIMEZONE_OFFSET})...")
    
    ultimo_ticket = get_last_processed(STATE_FILE_TICKETS)
    ultimo_turno  = get_last_processed(STATE_FILE_TURNOS)
    
    if ultimo_ticket == 0:
        print_log(f"⚠️ Fast-Forward: Buscando inicio en {SYNC_START_DATE}...")
        out = run_query(f"SELECT MIN(TICKET_ID) FROM VENTATICKETS WHERE FECHA_HORA >= '{SYNC_START_DATE}';")
        if out:
            try:
                for line in out.split("\n"):
                    if line.strip().isdigit():
                        ultimo_ticket = int(line.strip()) - 1
                        save_last_processed(STATE_FILE_TICKETS, ultimo_ticket)
                        break
            except: pass

    if ultimo_turno == 0:
        print_log(f"⚠️ Fast-Forward: Buscando cierres desde {SYNC_START_DATE}...")
        out = run_query(f"SELECT MIN(ID) FROM TURNOS WHERE TERMINO_EN >= '{SYNC_START_DATE.split()[0]}' AND TERMINO_EN IS NOT NULL;")
        if out:
            try:
                for line in out.split("\n"):
                    if line.strip().isdigit():
                        ultimo_turno = int(line.strip()) - 1
                        save_last_processed(STATE_FILE_TURNOS, ultimo_turno)
                        break
            except: pass
                
    print_log(f"📌 Estado Actual | Último ticket: {ultimo_ticket} | Último turno: {ultimo_turno}")
    
    while True:
        try:
            # 1. MONITOREAR VENTAS NUEVAS
            # Hemos quitado el filtro de > 0 para asegurar que no se pierda nada.
            # El Dashboard se encargará de ocultar los $0 si es necesario.
            query_ventas = f"""
            SELECT FIRST 100
                V.TICKET_ID, CAST(V.FECHA_HORA AS VARCHAR(20)),
                V.SUBTOTAL + V.IMPUESTOS AS TOTAL, V.GANANCIA_NETA, V.CANTIDAD_ARTICULOS
            FROM VENTATICKETS V
            WHERE V.TICKET_ID > {ultimo_ticket} 
              AND (V.ESTA_CANCELADO IS NULL OR LOWER(V.ESTA_CANCELADO) NOT IN ('t', '1', 'y'))
            ORDER BY V.TICKET_ID ASC;
            """
            
            out_ventas = run_query(query_ventas)
            if out_ventas:
                nuevas_ventas = parse_sales(out_ventas)
                for v in nuevas_ventas:
                    if push_to_supabase(SUPABASE_URL_SALES, v, f"Venta #{v['ticket_id']} (${v['total']})"):
                        ultimo_ticket = v["ticket_id"]
                        save_last_processed(STATE_FILE_TICKETS, ultimo_ticket)

            query_turnos = f"""
            SELECT FIRST 10 ID, CAST(TERMINO_EN AS DATE), VENTAS_EFECTIVO, VENTAS_TARJETA FROM TURNOS
            WHERE ID > {ultimo_turno} AND TERMINO_EN IS NOT NULL ORDER BY ID ASC;
            """
            out_turnos = run_query(query_turnos)
            if out_turnos:
                nuevos = parse_shifts(out_turnos)
                for t in nuevos:
                    daily = {"date": t["date"], "cash": t["cash"], "debit": t["debit"], "total": t["total"], "notes": f"Cierre #{t['id_eleventa']}"}
                    if push_to_supabase(SUPABASE_URL_DAILY, daily, f"Cierre #{t['id_eleventa']}"):
                        ultimo_turno = t["id_eleventa"]
                        save_last_processed(STATE_FILE_TURNOS, ultimo_turno)
        except Exception as e:
            print_log(f"⚠️ Error: {e}")
        
        time.sleep(5)

if __name__ == "__main__":
    main()
