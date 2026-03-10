import subprocess
import os

DB_PATH = r'127.0.0.1:C:\Program Files (x86)\AbarrotesMultiCaja\db\PDVDATA.FDB'
ISQL_PATH = r'C:\Program Files (x86)\AbarrotesMultiCaja\FirebirdSQL20\isql.exe'
DB_USER = 'SYSDBA'
DB_PASS = 'masterkey'

def run_query(query_text):
    query_file = 'audit_final.sql'
    with open(query_file, 'w') as f:
        f.write(f"CONNECT '{DB_PATH}' USER '{DB_USER}' PASSWORD '{DB_PASS}';\n")
        f.write("SET HEADING OFF;\n")
        f.write(query_text + "\n")
        f.write("QUIT;\n")
    
    try:
        result = subprocess.run([ISQL_PATH, '-i', query_file], capture_output=True, text=True, timeout=30)
        return result.stdout
    except Exception as e:
        return str(e)
    finally:
        if os.path.exists(query_file): os.remove(query_file)

print('--- AUDITORÍA ELEVENTA (MARZO 2026) ---')

# 1. Total Marzo
q1 = "SELECT COUNT(*), MIN(TICKET_ID), MAX(TICKET_ID) FROM VENTATICKETS WHERE FECHA_HORA >= '2026-03-01 00:00:00';"
out1 = run_query(q1)
print(f'Total en Marzo [Conteo, Min, Max]:\n{out1}')

# 2. Solo Hoy (Marzo 9)
q2 = "SELECT COUNT(*) FROM VENTATICKETS WHERE FECHA_HORA >= '2026-03-09 00:00:00';"
out2 = run_query(q2)
print(f'Total Hoy (Marzo 9):\n{out2}')

# 3. Detalle por día
q3 = "SELECT CAST(FECHA_HORA AS DATE), COUNT(*) FROM VENTATICKETS WHERE FECHA_HORA >= '2026-03-01 00:00:00' GROUP BY 1 ORDER BY 1;"
out3 = run_query(q3)
print(f'Distribución por Día:\n{out3}')
