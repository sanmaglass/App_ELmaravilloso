#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# 🚀 SMART GIT PUSH SCRIPT
# Muestra información relevante antes/después de subir a GitHub
# ════════════════════════════════════════════════════════════════════════════

set -e

clear

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                    🚀 GITHUB PUSH - INFORMACIÓN RELEVANTE               ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. VERIFICAR STATUS GIT
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 ESTADO GIT ACTUAL"
echo "───────────────────────────────────────────────────────────────────────────"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
REMOTE=$(git config branch.${BRANCH}.remote)
TRACKING=$(git config branch.${BRANCH}.merge)

echo "  Rama actual: $BRANCH"
echo "  Remote: ${REMOTE:-origin}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 2. CAMBIOS SIN COMMITEAR
# ─────────────────────────────────────────────────────────────────────────────

UNCOMMITTED=$(git status --short | wc -l)
if [ $UNCOMMITTED -gt 0 ]; then
  echo "⚠️  ADVERTENCIA: Hay $UNCOMMITTED cambios sin commitear"
  echo ""
  git status --short
  echo ""
  read -p "¿Continuar sin commitear? (s/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Push cancelado"
    exit 1
  fi
  echo ""
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. COMMITS A SUBIR
# ─────────────────────────────────────────────────────────────────────────────

echo "📦 COMMITS A SUBIR"
echo "───────────────────────────────────────────────────────────────────────────"

AHEAD=$(git rev-list --count origin/${BRANCH}..HEAD 2>/dev/null || echo "0")

if [ "$AHEAD" == "0" ]; then
  echo "  ✅ Ya está sincronizado (0 commits nuevos)"
  echo ""
  exit 0
fi

echo "  Commits nuevos: $AHEAD"
echo ""

git log --oneline origin/${BRANCH}..HEAD --no-decorate | nl -w2 -s'. ' | sed 's/^/  /'
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 4. CAMBIOS POR ARCHIVO
# ─────────────────────────────────────────────────────────────────────────────

echo "📁 ARCHIVOS MODIFICADOS"
echo "───────────────────────────────────────────────────────────────────────────"

git diff origin/${BRANCH}...HEAD --name-status | while read status file; do
  case $status in
    A) echo "  ✨ [NUEVO]     $file" ;;
    M) echo "  📝 [MODIFICADO] $file" ;;
    D) echo "  🗑️  [ELIMINADO]  $file" ;;
    R) echo "  🔄 [RENOMBRADO] $file" ;;
    *) echo "  ❓ [$status]      $file" ;;
  esac
done
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 5. ESTADÍSTICAS
# ─────────────────────────────────────────────────────────────────────────────

echo "📊 ESTADÍSTICAS"
echo "───────────────────────────────────────────────────────────────────────────"

STATS=$(git diff origin/${BRANCH}...HEAD --stat | tail -1)
echo "  $STATS" | sed 's/^/  /'
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 6. ÚLTIMO COMMIT
# ─────────────────────────────────────────────────────────────────────────────

echo "📌 ÚLTIMO COMMIT"
echo "───────────────────────────────────────────────────────────────────────────"

LAST_COMMIT=$(git log -1 --format="%h - %s (%an, %ar)")
echo "  $LAST_COMMIT"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 7. CONFIRMACIÓN
# ─────────────────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════════════════"
read -p "✅ ¿Subir $AHEAD commit(s) a GitHub? (s/n) " -n 1 -r
echo ""
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "❌ Push cancelado"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. EJECUTAR PUSH
# ─────────────────────────────────────────────────────────────────────────────

echo "🚀 SUBIENDO A GITHUB..."
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

START_TIME=$(date +%s)

if git push origin ${BRANCH} 2>&1; then
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║                        ✅ PUSH EXITOSO                                   ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📊 RESUMEN:"
  echo "  Rama: $BRANCH"
  echo "  Commits: $AHEAD"
  echo "  Destino: origin"
  echo "  Tiempo: ${DURATION}s"
  echo "  Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "🔗 GitHub:"
  echo "  https://github.com/sanmaglass/App_ELmaravilloso/commits/$BRANCH"
  echo ""
else
  echo ""
  echo "❌ ERROR: Falló el push a GitHub"
  echo ""
  echo "Posibles causas:"
  echo "  • Sin internet"
  echo "  • Credenciales inválidas"
  echo "  • Conflicto de ramas"
  echo ""
  exit 1
fi
