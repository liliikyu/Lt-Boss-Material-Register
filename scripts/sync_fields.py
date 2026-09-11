#!/usr/bin/env python3
"""Sync field Monster Illustrations + Item Codex entries from Official La Tale Wiki.

Field and Dungeon data are intentionally separate. This script writes only locations
explicitly labelled (Field) or (Fields) by the wiki. If parsing fails, the existing
snapshot is preserved.
"""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
from datetime import date
import json,re,urllib.parse,urllib.request
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'assets'/'field-data.js'
API='https://latale.wiki.gg/api.php'
PAGES={'monsters':('Monster_Illustrations','https://latale.wiki.gg/wiki/Monster_Illustrations'),'codex':('Item_Codex','https://latale.wiki.gg/wiki/Item_Codex')}
def clean(v): return re.sub(r'\s+',' ',re.sub(r'\[[^\]]+\]','',v or '')).strip()
def pint(v,d=1):
  try:return max(1,int(v or d))
  except:return d
class P(HTMLParser):
  def __init__(self):super().__init__();self.tables=[];self.depth=0;self.rows=None;self.row=None;self.parts=None;self.attrs={}
  def handle_starttag(self,t,a):
    t=t.lower();a=dict(a)
    if t=='table':self.depth+=1;self.rows=[] if self.depth==1 else self.rows
    elif self.depth==1 and t=='tr':self.row=[]
    elif self.depth==1 and t in ('td','th') and self.row is not None:self.parts=[];self.attrs=a
    elif self.parts is not None and t in ('br','p','div','li'):self.parts.append(' ')
  def handle_data(self,d):
    if self.parts is not None:self.parts.append(d)
  def handle_endtag(self,t):
    t=t.lower()
    if self.depth==1 and t in ('td','th') and self.parts is not None:self.row.append({'text':clean(''.join(self.parts)),'rowspan':pint(self.attrs.get('rowspan')),'colspan':pint(self.attrs.get('colspan'))});self.parts=None;self.attrs={}
    elif self.depth==1 and t=='tr' and self.row is not None:
      if self.row:self.rows.append(self.row)
      self.row=None
    elif t=='table' and self.depth:
      if self.depth==1 and self.rows is not None:self.tables.append(self.rows);self.rows=None
      self.depth-=1
def expand(raw):
  active={};out=[]
  for rr in raw:
    row={}
    for c,(remaining,text) in list(active.items()):
      row[c]=text
      if remaining<=1:del active[c]
      else:active[c]=(remaining-1,text)
    col=0
    for cell in rr:
      while col in row:col+=1
      text=clean(cell['text']);rs=pint(cell.get('rowspan'));cs=pint(cell.get('colspan'))
      for off in range(cs):
        row[col+off]=text
        if rs>1:active[col+off]=(rs-1,text)
      col+=cs
    w=max(row.keys(),default=-1)+1;out.append([row.get(i,'') for i in range(w)])
  w=max(map(len,out),default=0);return [r+['']*(w-len(r)) for r in out]
def fetch(page):
  q=urllib.parse.urlencode({'action':'parse','page':page,'prop':'text','format':'json','formatversion':'2'})
  req=urllib.request.Request(API+'?'+q,headers={'User-Agent':'LtDungeonTracker/1.0 (GitHub Pages sync)','Accept':'application/json'})
  with urllib.request.urlopen(req,timeout=60) as r:data=json.loads(r.read().decode())
  html=data.get('parse',{}).get('text','')
  if not html:raise RuntimeError(f'No HTML returned for {page}')
  return html
def field_name(location):
  s=clean(location)
  m=re.match(r'^(.*?)\s*\(\s*Fields?\s*\)?\s*$',s,re.I)
  if not m:return None
  return clean(m.group(1))
def parse(html):
  p=P();p.feed(html);result={}
  for raw in p.tables:
    table=expand(raw)
    for hi,row in enumerate(table[:10]):
      headers=[clean(x).lower() for x in row]
      loc=next((i for i,h in enumerate(headers) if h in ('location','locations','area')),None)
      name=next((i for i,h in enumerate(headers) if h in ('name','item','item name','monster','monster name')),None)
      if loc is None or name is None:continue
      for r in table[hi+1:]:
        if max(loc,name)>=len(r):continue
        n=clean(r[name]);f=field_name(r[loc])
        if n and f:result.setdefault(f,[]).append(n)
      break
  return {k:list(dict.fromkeys(v)) for k,v in result.items()}
def main():
  monsters=parse(fetch(PAGES['monsters'][0]));codex=parse(fetch(PAGES['codex'][0]))
  if not monsters:raise RuntimeError('No field Monster Illustrations parsed; existing snapshot preserved')
  if not codex:raise RuntimeError('No field Item Codex entries parsed; existing snapshot preserved')
  fields={}
  for f,names in monsters.items():fields.setdefault(f,{'illustrations':[],'codex':[]})['illustrations']=names
  for f,names in codex.items():fields.setdefault(f,{'illustrations':[],'codex':[]})['codex']=names
  data={'source':{k:v[1] for k,v in PAGES.items()},'updated':date.today().isoformat(),'fields':dict(sorted(fields.items()))}
  OUTPUT.write_text('window.LT_FIELD_DATA = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
  print(f"Synced {len(fields)} fields, {sum(len(v['illustrations']) for v in fields.values())} illustrations, {sum(len(v['codex']) for v in fields.values())} codex entries")
if __name__=='__main__':main()
