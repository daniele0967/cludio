#!/usr/bin/env python3
"""Estrae dal modello Xbot (basket3d/assets/Xbot.glb, esempi di Three.js, origine Mixamo)
solo quello che serve al rider: le due mesh skinnate e lo scheletro, senza animazioni.

Uscita: snow3d/assets/rider.bin
  [u32 lunghezza JSON][JSON][padding a 4 byte][dati binari]
Il JSON descrive le ossa (nome, padre, posizione, rotazione), le matrici di bind
inverse e, per ogni mesh, offset e numero di vertici/indici. Unita' in metri.
Posizioni quantizzate a int16, normali int8, ossa uint8, pesi uint8, indici uint16.
"""
import json, struct, pathlib
import numpy as np

root = pathlib.Path(__file__).resolve().parents[2]
src = root / 'basket3d' / 'assets' / 'Xbot.glb'
dst = root / 'snow3d' / 'assets' / 'rider.bin'

b = src.read_bytes()
clen, _ = struct.unpack('<II', b[12:20])
j = json.loads(b[20:20 + clen])
off = 20 + clen
blen, _ = struct.unpack('<II', b[off:off + 8])
binchunk = b[off + 8: off + 8 + blen]

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def acc(i):
    a = j['accessors'][i]
    bv = j['bufferViews'][a['bufferView']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]
    dt = CT[a['componentType']]
    arr = np.frombuffer(binchunk, dtype=dt, count=a['count'] * n, offset=start)
    return arr.reshape(a['count'], n) if n > 1 else arr

S = 0.01  # l'Armature ha scala 0.01 (centimetri -> metri)
nodes = j['nodes']
skin = j['skins'][0]
joints = skin['joints']
parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []):
        parent[c] = i
bones = []
for ji, ni in enumerate(joints):
    n = nodes[ni]
    p = parent.get(ni)
    bones.append({
        'name': n['name'].replace('mixamorig:', ''),
        'parent': joints.index(p) if p in joints else -1,
        't': [round(v * S, 6) for v in n.get('translation', [0, 0, 0])],
        'r': [round(v, 7) for v in n.get('rotation', [0, 0, 0, 1])],
    })
ibm = acc(skin['inverseBindMatrices']).astype(np.float64).copy()  # colonna per colonna (glTF)
# le ossa sono in centimetri sotto l'Armature (scala 0.01), i vertici gia' in metri:
# togliendo la scala 0.01 dalle ossa, la matrice di bind inversa diventa S(0.01) * IBM
for c in (0, 1, 2, 3):
    ibm[:, c * 4:c * 4 + 3] *= S

blobs, meshes = [], []
cursor = 0
def push(arr):
    global cursor
    data = arr.tobytes()
    pad = (-len(data)) % 4
    blobs.append(data + b'\0' * pad)
    o = cursor
    cursor += len(data) + pad
    return o

for mi, name in [(1, 'surface'), (0, 'joints')]:
    prim = j['meshes'][mi]['primitives'][0]
    at = prim['attributes']
    pos = acc(at['POSITION']).astype(np.float64)  # gia' in metri
    nor = acc(at['NORMAL']).astype(np.float64)
    jo = acc(at['JOINTS_0']).astype(np.int64)
    we = acc(at['WEIGHTS_0']).astype(np.float64)
    idx = acc(prim['indices']).astype(np.uint16)
    lo, hi = pos.min(0), pos.max(0)
    q = np.round((pos - lo) / (hi - lo) * 65535 - 32768).astype(np.int16)
    nq = np.clip(np.round(nor / np.linalg.norm(nor, axis=1, keepdims=True) * 127), -127, 127).astype(np.int8)
    nq = np.concatenate([nq, np.zeros((len(nq), 1), np.int8)], 1)
    assert jo.max() < 256
    w = we / we.sum(1, keepdims=True)
    wq = np.floor(w * 255).astype(np.int64)
    rest = 255 - wq.sum(1)
    wq[np.arange(len(wq)), w.argmax(1)] += rest
    meshes.append({
        'name': name, 'count': int(len(pos)), 'index': int(len(idx)),
        'min': lo.round(6).tolist(), 'max': hi.round(6).tolist(),
        'pos': push(q), 'nor': push(nq), 'joi': push(jo.astype(np.uint8)),
        'wei': push(wq.astype(np.uint8)), 'idx': push(idx),
    })
ibm_off = push(ibm.astype(np.float32))
head = json.dumps({'bones': bones, 'ibm': ibm_off, 'meshes': meshes}, separators=(',', ':')).encode()
head += b' ' * ((-len(head)) % 4)
out = struct.pack('<I', len(head)) + head + b''.join(blobs)
dst.write_bytes(out)
print('ok', dst.relative_to(root), len(out), 'byte,', len(bones), 'ossa,', [m['count'] for m in meshes], 'vertici')
