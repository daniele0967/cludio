#!/usr/bin/env python3
"""Costruisce la vecchia versione 2D di Playmaker in basket/playmaker2d.html."""
import json, pathlib
here = pathlib.Path(__file__).parent
html = (here / 'index.html').read_text()
code = (here / 'game.js').read_text()
assert '</script' not in code.lower()
html = html.replace('/*__GAME__*/', code, 1)
(here / 'playmaker2d.html').write_text(html)
print('ok 2D', len(html), 'byte')
