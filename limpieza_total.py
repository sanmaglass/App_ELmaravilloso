import requests
import time

# Configuración
SUPABASE_URL_SALES = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/eleventa_sales"
SUPABASE_URL_DAILY = "https://ybonpeapvpdseqbtlysx.supabase.co/rest/v1/daily_sales"
SUPABASE_KEY = "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def clean_table(url, name):
    print(f"Buscando registros en {name}...")
    # Obtenemos los IDs para borrar (limitado por seguridad, se puede repetir)
    r = requests.get(f"{url}?select=id", headers=HEADERS)
    if r.status_code == 200:
        ids = r.json()
        total = len(ids)
        if total == 0:
            print(f"La tabla {name} ya está vacía.")
            return True
        
        print(f"Eliminando {total} registros de {name}...")
        # Borrar todos los registros (usando un filtro que atrape todo, como id > 0 o simplemente sin filtro si el API lo permite)
        # En Supabase REST, DELETE requiere un filtro. id=neq.0 suele funcionar para todos.
        del_r = requests.delete(f"{url}?id=gt.0", headers=HEADERS)
        if del_r.status_code in [200, 204]:
            print(f"✅ Tabla {name} vaciada con éxito.")
            return True
        else:
            print(f"❌ Error al vaciar {name}: {del_r.text}")
            return False
    else:
        print(f"❌ Error al consultar {name}: {r.text}")
        return False

if __name__ == "__main__":
    print("=== SCRIPT DE LIMPIEZA PROFUNDA (SUPABASE) ===")
    print("ADVERTENCIA: Esto borrará TODA la información de ventas y cierres de la nube.")
    confirm = input("¿Estás seguro? Escribe 'borrar' para continuar: ")
    
    if confirm.lower() == "borrar":
        clean_table(SUPABASE_URL_SALES, "eleventa_sales")
        clean_table(SUPABASE_URL_DAILY, "daily_sales")
        print("\nLimpieza completada. Ahora puedes borrar los archivos .txt locales.")
    else:
        print("Operación cancelada.")
