import pandas as pd, numpy as np
G=pd.read_csv(r'D:/code/Epirus-Web/champion-map/coords-gen3-1105.tsv',sep='\t',dtype=str)
L1=pd.read_csv(r'D:/code/Epirus-Web/champion-map/lineage.tsv',sep='\t',dtype=str,usecols=['id','ts']).rename(columns={'ts':'ts1'})
L2=pd.read_csv(r'D:/code/Epirus-Web/champion-map/lineage-g3.tsv',sep='\t',dtype=str,usecols=['id','ts']).rename(columns={'ts':'ts2'})
G=G.merge(L1,on='id',how='left').merge(L2,on='id',how='left')
G['ts']=pd.to_datetime(G.ts1.fillna(G.ts2),utc=True,format='mixed',errors='coerce')
for c in ['Hp5','Hplong5','P5','P5L','P5R','P5RL','C5R','C5RL']: G[c]=pd.to_numeric(G[c],errors='coerce')
G=G.dropna(subset=['ts']).sort_values('ts').reset_index(drop=True)
V=G[G.ver=='1.8'].reset_index(drop=True)
for a,b,c in [('P5','P5R','C5R'),('P5L','P5RL','C5RL')]:
    m=V[[a,b,c]].dropna(); pred=(m[a]+m[b])/2
    print(c,'maxdiff',round((pred-m[c]).abs().max(),8),'corr',round(pred.corr(m[c]),5),'n',len(m))
for col in ['P5','P5L','P5R','P5RL','C5R','C5RL']:
    print(col,'mean',round(V[col].mean(),3),'p10',round(V[col].quantile(.1),3),'p90',round(V[col].quantile(.9),3),
          'slope/100',round(np.polyfit(np.arange(len(V))[V[col].notna()],V[col].dropna(),1)[0]*100,4))
def corr(a,b):
    m=V[[a,b]].dropna(); return round(m[a].rank().corr(m[b].rank()),3), round(m[a].corr(m[b]),3), len(m)
for a,b in [('Hp5','P5'),('Hplong5','P5L'),('Hp5','P5R'),('Hplong5','P5RL'),('Hp5','C5R'),('Hplong5','C5RL')]:
    print('corr',a,b,corr(a,b))
