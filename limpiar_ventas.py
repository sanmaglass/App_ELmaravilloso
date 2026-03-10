import requests

# Configuración
SUPABASE_URL_SALES = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales"
SUPABASE_URL_DAILY = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/daily_sales"
SUPABASE_KEY = "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def limpiar():
    print("="*60)
    print("🛡️  LIMPIEZA SEGURA DE VENTAS (SOLO NUBE)")
    print("="*60)
    print("IMPORTANTE: Este script NO BORRARÁ NADA de tu PC de la tienda.")
    print("Tus ventas en el software Eleventa están 100% SEGURAS.")
    print("\nSolo vamos a vaciar el 'espejo' que hay en la App web para")
    print("que se vuelvan a sincronizar de forma perfecta y ordenada.")
    print("="*60)
    
    confirm = input("Escribe 'si' para borrar la nube y reiniciar: ")
    if confirm.lower() != "si":
        print("Cancelado.")
        return

    # Borramos todo lo relacionado a ventas de Eleventa en la nube
    print("Vaciando ventas en la nube...")
    # Usamos id=gt.0 para atrapar absolutamente todos los registros
    res = requests.delete(f"{SUPABASE_URL_SALES}?id=gt.0", headers=HEADERS)
    if res.status_code in [200, 204]:
        print("✅ Aplicativo: Ventas borradas de la nube.")
    else:
        print(f"❌ Error al borrar ventas: {res.text}")

    print("Vaciando cierres diarios en la nube...")
    res2 = requests.delete(f"{SUPABASE_URL_DAILY}?id=gt.0", headers=HEADERS)
    if res2.status_code in [200, 204]:
        print("✅ Aplicativo: Cierres borrados de la nube.")
    
    print("\n" + "="*40)
    print("✅ LIMPIEZA COMPLETADA EN LA NUBE")
    print("="*40)
    print("\nPRÓXIMOS PASOS EN TU PC:")
    print("1. Borra el archivo 'ultimo_ticket.txt' (está en esta carpeta).")
    print("2. Borra el archivo 'ultimo_turno.txt' (está en esta carpeta).")
    print("3. Abre 'monitor_ventas_supabase.py'.")
    print("\nEl sistema empezará a subir todas las ventas desde Marzo 1")
    print("con el horario corregido y sin duplicados.")

if __name__ == "__main__":
    limpiar()
