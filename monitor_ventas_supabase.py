import subprocess
import time
import requests
import json
import os
import sys

# ==========================================
# CONFIGURACIÓN SUPABASE
# ==========================================
# Reemplaza esto con tu URL de Supabase y tu Anon Key pública
SUPABASE_URL = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales"
SUPABASE_KEY = "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal" # No necesitamos que devuelva la data insertada
}

# ==========================================
# CONFIGURACIÓN ELEVENTA DB
# ==========================================
DB_PATH = r"C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB"
ISQL_PATH = r"C:\Program Files (x86)\AbarrotesPDV\isql.exe"
DB_USER = "SYSDBA"
DB_PASS = "masterkey"

# Archivo local para no perder el estado si se reinicia la PC
STATE_FILE = "ultimo_ticket.txt"

def get_last_processed_ticket():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            try:
                return int(f.read().strip())
            except:
                return 0
    return 0

def save_last_processed_ticket(ticket_id):
    with open(STATE_FILE, "w") as f:
        f.write(str(ticket_id))

def run_query(sql_query):
    # Escribir el script SQL en un archivo temporal
    query_file = "temp_query.sql"
    with open(query_file, "w", encoding="utf-8") as f:
        f.write(f"CONNECT '{DB_PATH}' USER '{DB_USER}' PASSWORD '{DB_PASS}';\n")
        f.write(sql_query + "\n")
        f.write("QUIT;\n")
    
    # Ejecutar isql.exe
    result = subprocess.run([ISQL_PATH, "-in", query_file], capture_output=True, text=True)
    os.remove(query_file)
    
    if result.returncode != 0:
        print("Error en ISQL:", result.stderr)
        return None
        
    return result.stdout

def parse_sales(isql_output):
    """
    Parsea la tabla rudimentaria que lanza isql.exe
    """
    sales = []
    lines = isql_output.split("\n")
    
    # Encontrar donde empiezan los datos (luego de la linea ======= =======...)
    data_start = False
    for line in lines:
        if line.startswith("======="):
            data_start = True
            continue
            
        if data_start and line.strip():
            # Formato esperado: TICKET_ID | FECHA | TOTAL | GANANCIA | ARTICULOS
            parts = [p.strip() for p in line.split() if p.strip()]
            if len(parts) >= 6: 
                try:
                    ticket_id = int(parts[0])
                    # Construir fecha: YYYY-MM-DD HH:MM:SS
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
                    print(f"Error parseando linea: {line}. Detalle: {e}")
                    
    return sales

def push_to_supabase(sale_data):
    try:
        response = requests.post(SUPABASE_URL, headers=HEADERS, json=sale_data)
        if response.status_code in (200, 201):
            print(f"✅ Venta {sale_data['ticket_id']} enviada a la nube (${sale_data['total']})")
            return True
        else:
            print(f"❌ Error Supabase {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error de red: {e}")
        return False

def main():
    print("🚀 Iniciando Monitor de Ventas Supabase (Tiempo Real)...")
    ultimo_ticket = get_last_processed_ticket()
    print(f"Último ticket procesado: {ultimo_ticket}")
    
    while True:
        try:
            # Seleccionar ventas más nuevas que el último ticket procesado
            # Limitar a 50 para evitar sobrecarga si el script estuvo apagado mucho tiempo
            query = f"""
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
            
            output = run_query(query)
            if output:
                nuevas_ventas = parse_sales(output)
                
                for venta in nuevas_ventas:
                    # Enviar a Supabase (Dashboard El Maravilloso)
                    success = push_to_supabase(venta)
                    
                    if success:
                        ultimo_ticket = venta["ticket_id"]
                        save_last_processed_ticket(ultimo_ticket)
                    else:
                        print("Pausando sincronización 10 segundos debido a un error temporal.")
                        time.sleep(10)
                        break # Romper for loop y reintentar en el siguiente tick normal
            
            # Esperar 2 segundos antes de volver a verificar la base de datos local
            time.sleep(2)
            
        except Exception as e:
            print(f"Error crítico en el bucle principal: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
