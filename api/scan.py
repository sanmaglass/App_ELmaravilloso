# /api/scan — Escáner de documentos estilo CamScanner (Python + OpenCV).
# Recibe una foto, detecta el documento, corrige perspectiva (deskew), recorta
# y limpia el fondo dejando un look escaneado. Devuelve la imagen procesada.
#
# POST JSON: { "image": "<dataURL o base64>", "mode": "magic"|"bw"|"gray" }
# Resp JSON: { "ok": true, "image": "data:image/jpeg;base64,...", "cropped": bool }
# Auth: "Authorization: Bearer <supabase_jwt>" (solo usuarios logueados).
import os
import json
import base64
import urllib.request
from http.server import BaseHTTPRequestHandler

import cv2
import numpy as np

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ybonpeapvpdseqbtlysx.supabase.co")
# anon/publishable key (pública, protegida por RLS) — solo para validar el JWT
SUPABASE_ANON = os.environ.get("SUPABASE_ANON_KEY", "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB")


# ── Algoritmo de escaneo (validado localmente) ──
def _order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _four_point_transform(image, pts):
    rect = _order_points(pts)
    (tl, tr, br, bl) = rect
    maxWidth = max(int(np.linalg.norm(br - bl)), int(np.linalg.norm(tr - tl)))
    maxHeight = max(int(np.linalg.norm(tr - br)), int(np.linalg.norm(tl - bl)))
    if maxWidth < 10 or maxHeight < 10:
        return image
    dst = np.array([[0, 0], [maxWidth - 1, 0],
                    [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (maxWidth, maxHeight))


def _find_quad(image):
    ratio = image.shape[0] / 500.0
    small = cv2.resize(image, (int(image.shape[1] / ratio), 500))
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    edged = cv2.dilate(cv2.Canny(gray, 75, 200), np.ones((3, 3), np.uint8), iterations=1)
    cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]
    area = small.shape[0] * small.shape[1]
    for c in cnts:
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) == 4 and cv2.contourArea(c) > area * 0.20:
            return approx.reshape(4, 2).astype("float32") * ratio
    return None


def _remove_shadows(img):
    out = []
    for p in cv2.split(img):
        bg = cv2.medianBlur(cv2.dilate(p, np.ones((7, 7), np.uint8)), 21)
        diff = 255 - cv2.absdiff(p, bg)
        out.append(cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U))
    return cv2.merge(out)


def _enhance(warped, mode):
    if mode == "bw":
        g = cv2.cvtColor(_remove_shadows(warped), cv2.COLOR_BGR2GRAY)
        th = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 12)
        return cv2.cvtColor(th, cv2.COLOR_GRAY2BGR)
    if mode == "gray":
        return _remove_shadows(cv2.cvtColor(cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR))
    clean = _remove_shadows(warped)
    blur = cv2.GaussianBlur(clean, (0, 0), 3)
    return cv2.addWeighted(clean, 1.5, blur, -0.5, 0)


def scan_document(image, mode="magic", max_dim=1800):
    h, w = image.shape[:2]
    if max(h, w) > max_dim:
        s = max_dim / max(h, w)
        image = cv2.resize(image, (int(w * s), int(h * s)))
    quad = _find_quad(image)
    cropped = quad is not None
    warped = _four_point_transform(image, quad) if cropped else image
    return _enhance(warped, mode), cropped


def _verify_jwt(token):
    if not token:
        return False
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status == 200
    except Exception:
        return False


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            auth = (self.headers.get("authorization") or "").replace("Bearer ", "").strip()
            if not _verify_jwt(auth):
                return self._send(401, {"error": "no autorizado"})

            length = int(self.headers.get("content-length") or 0)
            if length <= 0 or length > 15 * 1024 * 1024:
                return self._send(413, {"error": "imagen inválida o muy grande"})
            payload = json.loads(self.rfile.read(length) or b"{}")

            raw = payload.get("image", "")
            mode = payload.get("mode", "magic")
            if mode not in ("magic", "bw", "gray"):
                mode = "magic"
            if "," in raw and raw.strip().startswith("data:"):
                raw = raw.split(",", 1)[1]
            img_bytes = base64.b64decode(raw)
            arr = np.frombuffer(img_bytes, np.uint8)
            image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if image is None:
                return self._send(400, {"error": "no se pudo leer la imagen"})

            result, cropped = scan_document(image, mode=mode)
            ok, buf = cv2.imencode(".jpg", result, [cv2.IMWRITE_JPEG_QUALITY, 88])
            if not ok:
                return self._send(500, {"error": "no se pudo codificar"})
            b64 = base64.b64encode(buf.tobytes()).decode()
            return self._send(200, {"ok": True, "cropped": cropped,
                                    "image": "data:image/jpeg;base64," + b64})
        except Exception as e:
            return self._send(500, {"error": "error interno", "detail": str(e)[:200]})
