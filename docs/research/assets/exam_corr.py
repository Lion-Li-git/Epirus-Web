import pandas as pd, numpy as np
G = pd.read_csv(r'D:/code/Epirus-Web/champion-map/coords-gen3-1105.tsv', sep='\t', dtype=str)
L1 = pd.read_csv(r'D:/code/Epirus-Web/champion-map/lineage.tsv', sep='\t', dtype=str, usecols=['id','ts','fam']).rename(columns={'ts':'ts1','fam':'fam1'})
L2 = pd.read_csv(r'D:/code/Epirus-Web/champion-map/lineage-g3.tsv', sep='\t', dtype=str, usecols=['id','ts','fam']).rename(columns={'ts':'ts2','fam':'fam2'})
G = G.merge(L1,on='id',how='left').merge(L2,on='id',how='left')
G['ts']=pd.to_datetime(G.ts1.fillna(G.ts2),utc=True,format='mixed',errors='coerce')
G['fam']=G.fam1.fillna(G.fam2)
for c in ['Hp5','Hplong5','H5','Hlong5','P5R','P5RL','C5R','C5RL','S','F']: G[c]=pd.to_numeric(G[c],errors='coerce')
G=G.dropna(subset=['ts']).sort_values('ts').reset_index(drop=True)
V=G[G.ver=='1.8'].reset_index(drop=True)
def corr(a,b):
    m=V[[a,b]].dropna(); return m[a].corr(m[b]), m[a].corr(m[b],method='pearson'), len(m)
for a,b in [('Hp5','P5R'),('Hplong5','P5RL'),('Hp5','C5R'),('Hplong5','C5RL'),('P5R','C5R'),('H5','P5R')]:
    m=V[[a,b]].dropna(); rp=m[a].rank().corr(m[b].rank()); print('corr',a,b,'spearman',round(rp,3),'pearson',round(m[a].corr(m[b]),3),'n',len(m))
def slope(y,x):
    m=np.isfinite(y)&np.isfinite(x); return np.polyfit(x[m],y[m],1)[0] if m.sum()>2 else np.nan
x=np.arange(len(V))
for c in ['Hp5','Hplong5','P5R','P5RL','C5R','C5RL']:
    print(c,'slope/100',round(slope(V[c].values,x)*100,3),'early',round(V[c].iloc[:len(V)//4].mean(),3),'late',round(V[c].iloc[-len(V)//4:].mean(),3))
for fam,g in V.groupby('fam'):
    if len(g)>=30:
        xx=np.arange(len(g)); print('fam',fam,len(g),'Hp5',round(slope(g.Hp5.values,xx)*100,2),'P5R',round(slope(g.P5R.values,xx)*100,3),'C5R',round(slope(g.C5R.values,xx)*100,3))
# 2.0 values
W=G[G.ver=='2.0']
for c in ['Hp5','Hplong5','P5R','P5RL','C5R','C5RL']:
    print('2.0',c,'n',W[c].notna().sum(),'mean',round(W[c].mean(),3),'p10',round(W[c].quantile(.1),3),'p90',round(W[c].quantile(.9),3))
