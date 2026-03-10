import subprocess
import os

DB_PATH = r'127.0.0.1:C:\Program Files (x86)\AbarrotesMultiCaja\db\PDVDATA.FDB'
ISQL_PATH = r'C:\Program Files (x86)\AbarrotesMultiCaja\FirebirdSQL20\isql.exe'
DB_USER = 'SYSDBA'
DB_PASS = 'masterkey'

sql_query = """
SET HEADING OFF;
CONNECT '127.0.0.1:C:\\Program Files (x86)\\AbarrotesMultiCaja\\db\\PDVDATA.FDB' USER 'SYSDBA' PASSWORD 'masterkey';
SELECT 
    'T:' || V.TICKET_ID || '|H:' || V.FECHA_HORA || '|M:' || (V.SUBTOTAL + V.IMPUESTOS) || '|C:' || V.ESTA_CANCELADO
FROM VENTATICKETS V
WHERE V.TICKET_ID >= 6330 AND V.TICKET_ID <= 6345
ORDER BY V.TICKET_ID ASC;
QUIT;
"""

with open('audit_local.sql', 'w') as f:
    f.write(sql_query)

try:
    result = subprocess.run([ISQL_PATH, '-i', 'audit_local.sql'], capture_output=True, text=True, timeout=12)
    print("--- RESULTADO AUDITORIA LOCAL ---")
    print(result.stdout)
    if result.stderr:
        print("--- ERRORES ---")
        print(result.stderr)
except Exception as e:
    print(f"Error fatal: {e}")
finally:
    if os.path.exists('audit_local.sql'):
        os.remove('audit_local.sql')
