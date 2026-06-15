#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Motor de AUDIO del Estudio — El Maravilloso.
Genera una pista (bed musical + SFX sincronizados a los "beats" del video) y la
muxea sobre un MP4 mudo usando el ffmpeg que trae imageio-ffmpeg.

Diseño robusto (PRIORIDAD: que el video SIEMPRE quede listo):
  - SFX 100% sintetizados con numpy (sin dependencia de red).
  - Bed: usa assets/audio/bed.mp3 si existe (CC0/CC); si no, sintetiza uno.
  - add_audio(): escribe la pista a WAV, muxea con ffmpeg copiando el video.
    Si CUALQUIER paso falla, deja el MP4 mudo intacto (nunca rompe el render).

Uso desde make_video.py:
    import audio as AU
    AU.add_audio(silent_mp4, final_mp4, dur, beats)
donde beats = {"name": t_seconds, ...} con nombres conocidos (ver SFX_FOR_BEAT).
"""
import math, os, struct, wave
import numpy as np

SR = 44100
HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")
AUDIO_DIR = os.path.join(ASSETS, "audio")

# ---------------------------------------------------------------- utilidades
def _t(n):
    return np.arange(n, dtype=np.float64) / SR

def _adsr(n, a=0.005, d=0.05, s=0.7, r=0.1):
    """Envolvente ADSR simple (longitud n samples)."""
    env = np.ones(n, dtype=np.float64) * s
    ai = max(1, int(a * SR)); di = max(1, int(d * SR)); ri = max(1, int(r * SR))
    ai = min(ai, n);
    env[:ai] = np.linspace(0, 1, ai)
    de = min(ai + di, n)
    env[ai:de] = np.linspace(1, s, de - ai)
    rs = max(0, n - ri)
    env[rs:] = np.linspace(env[rs] if rs < n else s, 0, n - rs)
    return env

def _tone(freq, dur, kind="sine"):
    n = max(1, int(dur * SR)); t = _t(n)
    if kind == "saw":
        x = 2.0 * (t * freq - np.floor(0.5 + t * freq))
    elif kind == "square":
        x = np.sign(np.sin(2 * np.pi * freq * t))
    elif kind == "tri":
        x = 2.0 * np.abs(2.0 * (t * freq - np.floor(0.5 + t * freq))) - 1.0
    else:
        x = np.sin(2 * np.pi * freq * t)
    return x

def _noise(dur):
    n = max(1, int(dur * SR))
    return np.random.uniform(-1, 1, n)

def _lowpass(x, cutoff):
    """1-pole lowpass."""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc); y[i] = acc
    return y

def _norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1.0
    return x * (peak / m)

# ---------------------------------------------------------------- SFX (numpy)
def sfx_whoosh(dur=0.45, soft=False):
    n = int(dur * SR); x = _noise(dur)
    # barrido de cutoff (sube y baja) -> sensación de "swoosh"
    cuts = np.linspace(400, 4000, n) * (np.hanning(n) * 0.5 + 0.5)
    # aproximación rápida: filtrar por bloques
    y = np.zeros(n); step = 512
    for i in range(0, n, step):
        seg = x[i:i+step]
        c = float(np.clip(cuts[min(i, n-1)], 200, 8000))
        y[i:i+len(seg)] = _lowpass(seg, c)
    env = np.hanning(n)
    g = 0.5 if soft else 0.9
    return _norm(y * env, 0.85) * g

def sfx_ding(freq=1320, dur=0.5):
    t = _t(int(dur * SR))
    x = (np.sin(2*np.pi*freq*t) + 0.5*np.sin(2*np.pi*freq*2*t)
         + 0.25*np.sin(2*np.pi*freq*3.01*t))
    env = np.exp(-t * 7.0)
    return _norm(x * env, 0.8)

def sfx_sparkle(dur=0.6):
    out = np.zeros(int(dur * SR))
    freqs = [2093, 2637, 3136, 3520, 4186]
    for k, f in enumerate(freqs):
        off = int((k * 0.05) * SR)
        d = sfx_ding(f, dur=0.32) * (0.6 - k*0.07)
        end = min(off + len(d), len(out))
        out[off:end] += d[:end-off]
    return _norm(out, 0.7)

def sfx_click(dur=0.06):
    n = int(dur * SR); x = _noise(dur)
    env = np.exp(-_t(n) * 90.0)
    body = _tone(900, dur) * np.exp(-_t(n) * 40.0)
    return _norm(x * env * 0.6 + body * 0.4, 0.55)

def sfx_kaching(dur=0.9):
    """Caja registradora: 2 dings (cha-ching) + golpe de cajón."""
    out = np.zeros(int(dur * SR))
    d1 = sfx_ding(1568, 0.45)
    d2 = sfx_ding(2093, 0.55)
    out[:len(d1)] += d1
    off = int(0.12 * SR)
    end = min(off + len(d2), len(out)); out[off:end] += d2[:end-off]
    # golpe grave del cajón
    n = int(0.18 * SR); thud = _tone(120, 0.18) * np.exp(-_t(n) * 18.0)
    end = min(len(thud), len(out)); out[:end] += thud[:end] * 0.7
    return _norm(out, 1.0)

SFX_BUILDERS = {
    "whoosh":      lambda: sfx_whoosh(0.45, soft=False),
    "whoosh_soft": lambda: sfx_whoosh(0.40, soft=True),
    "sparkle":     lambda: sfx_sparkle(0.6),
    "kaching":     lambda: sfx_kaching(0.9),
    "click":       lambda: sfx_click(0.06),
    "ding":        lambda: sfx_ding(),
}

# Qué SFX (y ganancia/offset) corresponde a cada beat lógico del video
# offset = adelanto en segundos respecto al beat
SFX_FOR_BEAT = {
    "whoosh_tag":  [("whoosh", 0.9, 0.0)],
    "whoosh_prod": [("whoosh_soft", 0.5, 0.0)],
    "price":       [("sparkle", 0.8, 0.08), ("kaching", 1.0, 0.0)],
    "footer":      [("click", 0.5, 0.0)],
}

# ---------------------------------------------------------------- bed musical
def synth_bed(dur, bpm=120):
    """Bed alegre sintetizado (acordes mayores + bajo + hi-hat suave)."""
    n = int(dur * SR); out = np.zeros(n)
    beat = 60.0 / bpm
    # progresión mayor I-V-vi-IV (C-G-Am-F) en frecuencias
    chords = [
        [261.63, 329.63, 392.00],  # C
        [392.00, 493.88, 587.33],  # G
        [220.00, 261.63, 329.63],  # Am
        [349.23, 440.00, 523.25],  # F
    ]
    bar = beat * 4
    nbars = int(math.ceil(dur / bar))
    for b in range(nbars):
        ch = chords[b % len(chords)]
        start = int(b * bar * SR)
        seg_n = min(int(bar * SR), n - start)
        if seg_n <= 0: break
        t = _t(seg_n)
        pad = np.zeros(seg_n)
        for f in ch:
            pad += _tone(f, seg_n / SR, "sine") * 0.5
            pad += _tone(f, seg_n / SR, "tri") * 0.15
        # bajo en la fundamental
        bass = _tone(ch[0] / 2, seg_n / SR, "saw")
        bass = _lowpass(bass, 220) * 0.5
        env = (np.sin(np.pi * t / (seg_n / SR)) ** 0.5)  # swell por compás
        out[start:start+seg_n] += (pad * 0.5 + bass) * env
    # hi-hat suave en cada beat
    nb = int(dur / beat)
    for k in range(nb):
        off = int(k * beat * SR)
        hl = int(0.04 * SR)
        if off + hl >= n: break
        h = _noise(0.04) * np.exp(-_t(hl) * 60.0) * 0.12
        out[off:off+hl] += h
    return _norm(out, 0.5)

def find_bed():
    for name in ("bed.mp3", "bed.wav", "bed.m4a", "bed.ogg"):
        p = os.path.join(AUDIO_DIR, name)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return p
    return None

# ---------------------------------------------------------------- IO de audio
def load_audio_mono(path, dur):
    """Decodifica cualquier audio a mono float [-1,1] de longitud dur (via ffmpeg)."""
    import imageio_ffmpeg, subprocess
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    n = int(dur * SR)
    cmd = [exe, "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
           "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    arr = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    if len(arr) == 0:
        raise RuntimeError("audio vacío")
    if len(arr) < n:
        reps = int(math.ceil(n / len(arr)))
        arr = np.tile(arr, reps)
    return arr[:n].copy()

def write_wav(path, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path

# ---------------------------------------------------------------- mezcla
def _place(track, snippet, at_sec):
    off = int(at_sec * SR)
    if off < 0: off = 0
    end = min(off + len(snippet), len(track))
    if end > off:
        track[off:end] += snippet[:end - off]

def build_track(dur, beats):
    """Construye la pista completa (bed + SFX) como float mono."""
    n = int(dur * SR)
    track = np.zeros(n, dtype=np.float64)

    # --- bed ---
    bed = None
    bedp = find_bed()
    if bedp:
        try:
            bed = load_audio_mono(bedp, dur) * 0.35
        except Exception:
            bed = None
    if bed is None:
        bed = synth_bed(dur) * 0.7
    # fade in/out del bed
    fi = int(0.4 * SR); fo = int(0.5 * SR)
    if len(bed) >= fi: bed[:fi] *= np.linspace(0, 1, fi)
    if len(bed) >= fo: bed[-fo:] *= np.linspace(1, 0, fo)
    track[:len(bed)] += bed[:n]

    # --- SFX por beat ---
    for beat_name, t in (beats or {}).items():
        for fx, gain, offset in SFX_FOR_BEAT.get(beat_name, []):
            snip = SFX_BUILDERS[fx]() * gain
            _place(track, snip, t - offset)

    # limitador suave
    track = np.tanh(track * 1.1)
    return _norm(track, 0.89)

def add_audio(silent_mp4, out_mp4, dur, beats):
    """
    Muxea la pista de audio sobre silent_mp4 -> out_mp4 (video copiado, audio aac).
    Si algo falla, deja silent_mp4 como out_mp4 (video sin audio, pero válido).
    Devuelve True si quedó con audio, False si quedó mudo.
    """
    import imageio_ffmpeg, subprocess, tempfile
    try:
        track = build_track(dur, beats)
        wav = os.path.splitext(out_mp4)[0] + ".track.wav"
        write_wav(wav, track)
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        tmp_out = out_mp4 + ".muxing.mp4"
        cmd = [exe, "-y", "-i", silent_mp4, "-i", wav,
               "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
               "-map", "0:v:0", "-map", "1:a:0", "-shortest", tmp_out]
        subprocess.run(cmd, capture_output=True, check=True)
        os.replace(tmp_out, out_mp4)
        try: os.remove(wav)
        except OSError: pass
        if silent_mp4 != out_mp4 and os.path.exists(silent_mp4):
            try: os.remove(silent_mp4)
            except OSError: pass
        return True
    except Exception as e:
        # fallback: dejar el mudo como salida final
        try:
            if silent_mp4 != out_mp4:
                os.replace(silent_mp4, out_mp4)
        except OSError:
            pass
        print("  [audio] mux falló, video queda mudo:", repr(e))
        return False

if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "..", "content", "_previews"), exist_ok=True)
    p = os.path.join(HERE, "..", "content", "_previews", "_audio_test.wav")
    write_wav(p, build_track(6.0, {"whoosh_tag": 0.3, "whoosh_prod": 0.45,
                                   "price": 1.8, "footer": 5.5}))
    print("audio test ->", p)
