from PIL import Image
im = Image.open(r'D:\code\Epirus-Web\scratch\ds-1107-def\map-sel.png').convert('RGB')
w, h = im.size
px = im.load()
pts = []
for y in range(0, h):
    for x in range(0, w):
        r, g, b = px[x, y]
        if r > 230 and g > 190 and b < 130 and abs(r - g) < 60:
            pts.append((x, y))
print('yellow pixels:', len(pts), pts[:8])