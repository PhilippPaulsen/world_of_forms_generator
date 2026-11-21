# Task 117 (check helper, not a test): reads the ZIPs the browser run put into a folder: testzip, entry count and methods, and EVERY SVG as XML (root, polygons, paths, size).
#   python3 -I tools/anim/check-svg-zip.py DIR [expected-frames]
import sys, os, zipfile, xml.etree.ElementTree as ET
d = sys.argv[1]; want = int(sys.argv[2]) if len(sys.argv) > 2 else None
bad = 0
for f in sorted(os.listdir(d)):
    if not f.endswith('.zip') or os.path.getsize(os.path.join(d, f)) < 100: continue
    z = zipfile.ZipFile(os.path.join(d, f)); names = z.namelist(); infos = z.infolist(); polys = []; paths = []; raw = 0; ok = True; why = ''
    for n in names:
        b = z.read(n); raw += len(b)
        try:
            r = ET.fromstring(b)
            if not r.tag.endswith('svg'): ok = False; why = 'root ' + r.tag
            ns = '{http://www.w3.org/2000/svg}'
            polys.append(sum(1 for _ in r.iter(ns + 'polygon'))); paths.append(sum(1 for _ in r.iter(ns + 'path')))
        except Exception as e:
            ok = False; why = n + ': ' + str(e)[:80]
    good = z.testzip() is None and ok and (want is None or len(names) == want) and all(n == 'frame_%04d.svg' % (i + 1) for i, n in enumerate(names)) and set(i.compress_type for i in infos) == {8}
    if not good: bad += 1
    print('%-24s %s frames=%d methods=%s zipMB=%.2f rawMB=%.1f polygons(min..max)=%d..%d paths(min..max)=%d..%d %s' % (f, 'OK ' if good else 'BAD', len(names), set(i.compress_type for i in infos), os.path.getsize(os.path.join(d, f)) / 1048576, raw / 1048576, min(polys), max(polys), min(paths), max(paths), why))
sys.exit(1 if bad else 0)
