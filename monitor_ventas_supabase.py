import subprocess
import time
import requests
import json
import os
import sys

# ==========================================
# CONFIGURACIÓN SUPABASE
# ==========================================
SUPABASE_URL_SALES = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales"
SUPABASE_URL_DAILY = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/daily_sales"
SUPABASE_KEY = "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# ==========================================
# CONFIGURACIÓN ELEVENTA DB
# ==========================================
DB_PATH = r"C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB"
ISQL_PATH = r"C:\Program Files (x86)\AbarrotesPDV\isql.exe"
DB_USER = "SYSDBA"
DB_PASS = "masterkey"

# Archivos de estado locales
STATE_FILE_TICKETS = "ultimo_ticket.txt"
STATE_FILE_TURNOS = "ultimo_turno.txt"

def get_last_processed(file_path):
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            try:
                return int(f.read().strip())
            except:
                return 0
    return 0

def save_last_processed(file_path, value):
    with open(file_path, "w") as f:
        f.write(str(value))

def run_query(sql_query):
    query_file = "temp_query.sql"
    with open(query_file, "w", encoding="utf-8") as f:
        f.write(f"CONNECT '{DB_PATH}' USER '{DB_USER}' PASSWORD '{DB_PASS}';\n")
        f.write(sql_query + "\n")
        f.write("QUIT;\n")
    
    result = subprocess.run([ISQL_PATH, "-in", query_file], capture_output=True, text=True)
    os.remove(query_file)
    
    if result.returncode != 0:
        print("Error en ISQL:", result.stderr)
        return None
        
    return result.stdout

def parse_sales(isql_output):
    sales = []
    lines = isql_output.split("\n")
    data_start = False
    for line in lines:
        if line.startswith("======="):
            data_start = True
            continue
        if data_start and line.strip():
            parts = [p.strip() for p in line.split() if p.strip()]
            if len(parts) >= 6: 
                try:
                    ticket_id = int(parts[0])
                    date_str = f"{parts[1]} {parts[2]}" 
                    total = float(parts[3])
                    ganancia = float(parts[4])
                    articulos = int(parts[5])
                    
                    sales.append({
                        "ticket_id": ticket_id,
                        "date": date_str,
                        "total": total,
                        "profit": ganancia,
                        "items_count": articulos
                    })
                except Exception as e:
                    print(f"Error parseando linea VENTA: {line}. Detalle: {e}")
    return sales

def parse_turnos(isql_output):
    turnos = []
    lines = isql_output.split("\n")
    data_start = False
    for line in lines:
        if line.startswith("======="):
            data_start = True
            continue
        if data_start and line.strip():
            parts = [p.strip() for p in line.split() if p.strip()]
            if len(parts) >= 4:
                try:
                    turno_id = int(parts[0])
                    fecha_str = parts[1] # YYYY-MM-DD
                    efectivo = float(parts[2])
                    tarjeta = float(parts[3])
                    
                    turnos.append({
                        "turno_id": turno_id,
                        "date": fecha_str,
                        "cash": efectivo,
                        "transfer": 0,
                        "debit": tarjeta,
                        "credit": 0,
                        "total": efectivo + tarjeta,
                        "notes": f"Cierre de caja Eleventa (Turno #{turno_id})"
                    })
                except Exception as e:
                    print(f"Error parseando linea TURNO: {line}. Detalle: {e}")
    return turnos

def push_to_supabase(url, payload, name):
    try:
        response = requests.post(url, headers=HEADERS, json=payload)
        if response.status_code in (200, 201):
            print(f"✅ {name} sincronizado en la nube.")
            return True
        else:
            print(f"❌ Error Supabase {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error de red: {e}")
        return False

def main():
    print("🚀 Iniciando Monitor de Eleventa (Ventas y Cierres en Tiempo Real)...")
    ultimo_ticket = get_last_processed(STATE_FILE_TICKETS)
    ultimo_turno  = get_last_processed(STATE_FILE_TURNOS)
    
    print(f"📌 Último ticket: {ultimo_ticket} | Último turno: {ultimo_turno}")
    
    while True:
        try:
            # ==============================
            # 1. MONITOREAR VENTAS NUEVAS
            # ==============================
            query_ventas = f"""
            SELECT FIRST 50
                V.TICKET_ID,
                CAST(V.FECHA_HORA AS VARCHAR(20)),
                V.SUBTOTAL + V.IMPUESTOS AS TOTAL,
                V.GANANCIA_NETA,
                V.CANTIDAD_ARTICULOS
            FROM VENTATICKETS V
            WHERE V.TICKET_ID > {ultimo_ticket} AND V.ESTA_CANCELADO = 'f'
            ORDER BY V.TICKET_ID ASC;
            """
            
            out_ventas = run_query(query_ventas)
            if out_ventas:
                nuevas_ventas = parse_sales(out_ventas)
                for v in nuevas_ventas:
                    if push_to_supabase(SUPABASE_URL_SALES, v, f"Venta #{v['ticket_id']} (${v['total']})"):
                        ultimo_ticket = v["ticket_id"]
                        save_last_processed(STATE_FILE_TICKETS, ultimo_ticket)
                    else:
                        print("Pausando 5s tras error en Venta.")
                        time.sleep(5)
                        break

            # ==============================
            # 2. MONITOREAR CORTES DE CAJA (TURNOS) CERRADOS
            # ==============================
            query_turnos = f"""
            SELECT FIRST 10
                T.ID,
                CAST(CAST(T.TERMINO_EN AS DATE) AS VARCHAR(10)),
                T.VENTAS_EFECTIVO,
                T.VENTAS_TARJETA
            FROM TURNOS T
            WHERE T.ID > {ultimo_turno} AND T.TERMINO_EN IS NOT NULL
            ORDER BY T.ID ASC;
            """
            
            out_turnos = run_query(query_turnos)
            if out_turnos:
                nuevos_turnos = parse_turnos(out_turnos)
                for t in nuevos_turnos:
                    turno_id = t.pop("turno_id")
                    t["deleted"] = False  # Soft delete flag para El Maravilloso
                    
                    if push_to_supabase(SUPABASE_URL_DAILY, t, f"Corte de Caja #{turno_id} (${t['total']})"):
                        ultimo_turno = turno_id
                        save_last_processed(STATE_FILE_TURNOS, ultimo_turno)
                    else:
                        print("Pausando 5s tras error en Turno.")
                        time.sleep(5)
                        break

            # Esperar 2 segundos antes de volver a verificar la base de datos local
            time.sleep(2)
            
        except Exception as e:
            print(f"Error crítico en el bucle principal: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
