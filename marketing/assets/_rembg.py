import sys
from rembg import remove
from PIL import Image
inp, out = sys.argv[1], sys.argv[2]
img = Image.open(inp)
res = remove(img)  # returns RGBA with transparent bg
res.save(out)
print("OK ->", out, res.size)
