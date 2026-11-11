import pandas as pd, numpy as np, os
from PIL import Image, ImageDraw, ImageFont

BASE=r'D:/code/Epirus-Web/champion-map/'
G=pd.read_csv(BASE+'coords-gen3-1105.tsv',sep='\t',dtype=str)
L1=pd.read_csv(BASE+'lineage.tsv',sep='\t',dtype=str,usecols=['id','ts']).rename(columns={'ts':'ts1'})
L2=pd.read_csv(BASE+'lineage-g3.tsv',sep='\t',dtype=str,usecols=['id','ts']).rename(columns={'ts':'ts2'})
G=G.merge(L1,on='id',how='left').merge(L2,on='id',how='left')
G['ts']=pd.to_datetime(G.ts1.fillna(G.ts2),utc=True,format='mixed',errors='coerce')
for c in ['Hp5','Hplong5','P5','P5L','P5R','P5RL','C5R','C5RL']: G[c]=pd.to_numeric(G[c],errors='coerce')
G=G.dropna(subset=['ts']).sort_values('ts').reset_index(drop=True)
V=G[G.ver=='1.8'].reset_index(drop=True)
W=30
for c in ['Hp5','Hplong5','P5','P5L','P5R','P5RL','C5R','C5RL']:
    G['ma_'+c]=G[c].rolling(W,min_periods=15).mean()
    V['ma_'+c]=V[c].rolling(W,min_periods=15).mean()
    V['z_'+c]=(V[c]-V[c].mean())/V[c].std(ddof=0)
    V['maz_'+c]=V['z_'+c].rolling(W,min_periods=15).mean()
# save chart data
out=pd.DataFrame({'ts':G.ts,'id':G.id,'ver':G.ver})
for c in ['Hp5','Hplong5','P5','P5L','P5R','P5RL','C5R','C5RL']: out['ma_'+c]=G['ma_'+c]
out.to_csv(r'D:/code/Epirus-Web/scratch/my-review-1111/exam-old-vs-new.csv',index=False)

FONT='C:/Windows/Fonts/msyh.ttc'
if not os.path.exists(FONT): FONT='C:/Windows/Fonts/simhei.ttf'
def F(sz): return ImageFont.truetype(FONT, sz)
f12,f13,f14,f16,f18,f20,f24=F(15),F(16),F(18),F(20),F(22),F(26),F(32)

IW,IH=1900,1560
img=Image.new('RGB',(IW,IH),'white'); d=ImageDraw.Draw(img)
L,R,T,B=150,70,112,86; gap=44; PH=(IH-T-B-2*gap)//3
panels=[(T,T+PH),(T+PH+gap,T+2*PH+gap),(T+2*PH+2*gap,T+3*PH+2*gap)]
t0=G.ts.min(); t1=G.ts.max()
def X(ts): return L+(ts-t0).total_seconds()/(t1-t0).total_seconds()*(IW-L-R)
def Y(v,lo,hi,p): a,b=panels[p]; return b-(v-lo)/(hi-lo)*(b-a)
def line(pts,col,w=3,dash=False):
    pts=[(X(t),Y(v,lo,hi,p)) for t,v in pts if np.isfinite(v)]
    if len(pts)<2: return
    if not dash: d.line(pts,fill=col,width=w,joint='curve')
    else:
        for i in range(0,len(pts)-1,2):
            d.line([pts[i],pts[i+1]],fill=col,width=w)
def dot(ts,v,col,r=2,lo=0,hi=1,p=0):
    x,y=X(ts),Y(v,lo,hi,p); d.ellipse([x-r,y-r,x+r,y+r],fill=col)
def text(x,y,s,font=f14,col=(30,30,30),anchor='la'):
    d.text((x,y),s,font=font,fill=col,anchor=anchor)
def dt(s): return pd.Timestamp(s,tz='UTC')
def fmt(ts): return ts.strftime('%m-%d')

# panel 1: old
p=0; lo,hi=0,80; a,b=panels[p]
d.rectangle([L,a,IW-R,b],outline=(185,185,185),width=1)
for gv in range(0,81,20):
    y=Y(gv,lo,hi,p); d.line([L,y,IW-R,y],fill=(236,236,236),width=1); text(L-12,y,str(gv),font=f13,anchor='rm',col=(95,95,95))
for _,r in G.iterrows():
    if np.isfinite(r.Hp5): dot(r.ts,r.Hp5,(175,205,235),2,lo,hi,p)
    if np.isfinite(r.Hplong5): dot(r.ts,r.Hplong5,(242,198,160),2,lo,hi,p)
line([(r.ts,r.ma_Hp5) for _,r in G.iterrows()],(30,110,200),4)
line([(r.ts,r.ma_Hplong5) for _,r in G.iterrows()],(217,119,20),4)
text(L+14,a+10,'旧考卷：Hp5 / Hplong5（页面剂量 · 5P）· 30 枚滑动平均',font=f24)
text(L+14,a+48,'v7（1.8 代，831 枚）：early→late  +8.6 / +10.9 pts ‖ 斜率 +1.43 / +1.86 per 100 pk',font=f14,col=(65,65,65))
text(IW-R-230,a+12,'Hp5',font=f16,col=(30,110,200)); text(IW-R-155,a+12,'Hplong5',font=f16,col=(217,119,20))
v=G[G.id=='V111'].iloc[0]
d.line([X(v.ts),Y(v.Hp5,lo,hi,p),X(v.ts),b],fill=(200,0,0),width=1)
dot(v.ts,v.Hp5,(200,0,0),7,lo,hi,p)
text(X(v.ts)+10,Y(v.Hp5,lo,hi,p)-20,'V111 反弹墙  Hp5 25.6 / Hplong 19.0',font=f13,col=(180,0,0))

# panel 2: A/B/C
p=1; lo,hi=-0.28,0.34; a,b=panels[p]
d.rectangle([L,a,IW-R,b],outline=(185,185,185),width=1)
for gv in [-0.2,-0.1,0,0.1,0.2,0.3]:
    y=Y(gv,lo,hi,p); d.line([L,y,IW-R,y],fill=(236,236,236),width=1); text(L-12,y,f'{gv:+.1f}',font=f13,anchor='rm',col=(95,95,95))
line([(r.ts,r.ma_P5) for _,r in G.iterrows()],(22,150,70),4)
line([(r.ts,r.ma_P5L) for _,r in G.iterrows()],(110,170,80),3,dash=True)
line([(r.ts,r.ma_P5R) for _,r in G.iterrows()],(200,40,40),4)
line([(r.ts,r.ma_P5RL) for _,r in G.iterrows()],(230,120,90),3,dash=True)
line([(r.ts,r.ma_C5R) for _,r in G.iterrows()],(20,20,20),5)
line([(r.ts,r.ma_C5RL) for _,r in G.iterrows()],(125,60,170),4,dash=True)
text(L+14,a+10,'新考卷拆成 A / B 两半：C = (A+B)/2',font=f24)
text(L+14,a+48,'A 轴（v2 脚本桌）上行 ‖ B 轴（F2 冠军夹具）下行 ⇒ C 走平：v7 内 A +0.0096 / B −0.0052 / C +0.0022（每 100 枚）',font=f14,col=(65,65,65))
# legend two rows
text(IW-R-560,a+10,'A：P5 / P5L',font=f14,col=(22,150,70))
text(IW-R-400,a+10,'B：P5R / P5RL',font=f14,col=(200,40,40))
text(IW-R-230,a+10,'C：C5R / C5RL',font=f14,col=(20,20,20))
text(IW-R-560,a+34,'实线=短程 · 虚线=长程',font=f12,col=(110,110,110))
d.line([X(v.ts),Y(v.C5R,lo,hi,p),X(v.ts),b],fill=(200,0,0),width=1)
dot(v.ts,v.C5R,(200,0,0),7,lo,hi,p)
text(X(v.ts)+10,Y(v.C5R,lo,hi,p)+8,'V111 C5R −0.149',font=f13,col=(180,0,0))

# panel 3: z within v7
p=2; lo,hi=-2.4,2.4; a,b=panels[p]
d.rectangle([L,a,IW-R,b],outline=(185,185,185),width=1)
for gv in [-2,-1,0,1,2]:
    y=Y(gv,lo,hi,p); d.line([L,y,IW-R,y],fill=(236,236,236),width=1); text(L-12,y,f'{gv:+d}',font=f13,anchor='rm',col=(95,95,95))
# shade 2.0
xb=X(pd.Timestamp('2026-11-01T00:00:00Z')); d.rectangle([xb,a,IW-R,b],fill=(247,247,247))
line([(r.ts,r.maz_Hp5) for _,r in V.iterrows()],(30,110,200),4)
line([(r.ts,r.maz_P5) for _,r in V.iterrows()],(22,150,70),4)
line([(r.ts,r.maz_P5R) for _,r in V.iterrows()],(200,40,40),4)
line([(r.ts,r.maz_C5R) for _,r in V.iterrows()],(20,20,20),4)
text(L+14,a+10,'v7 内标准化（z-score，仅 1.8 代）· 短程四线',font=f24)
text(L+14,a+48,'旧考卷与 A 轴同向（ρ(Hp5,P5)=0.74）；A 上行、B 下行 ⇒ C 把两者抵消',font=f14,col=(65,65,65))
text(L+14,a+78,'ρ(Hp5,P5R)=0.20；ρ(H5plong,P5RL)=0.12；ρ(Hp5,C5R)=0.55',font=f13,col=(90,90,90))
text(L+14,a+104,'长程同形：A +0.0118 / B −0.0154 / C −0.0018（每 100 枚）',font=f13,col=(90,90,90))
# legend box (top-right, avoid line-end collisions)
lx,ly=IW-R-300,a+12
for i,(lab,col) in enumerate([('Hp5',(30,110,200)),('A：P5',(22,150,70)),('B：P5R',(200,40,40)),('C：C5R',(20,20,20))]):
    xx=lx+(i%2)*150; yy=ly+(i//2)*24
    d.line([xx,yy+8,xx+26,yy+8],fill=col,width=4); text(xx+34,yy,lab,font=f13,col=col)

# x ticks
for s in ['2026-09-10','2026-09-20','2026-10-01','2026-10-10','2026-10-20','2026-11-01','2026-11-10']:
    ts=dt(s); x=X(ts); yy=panels[2][1]
    d.line([x,yy,x,yy+6],fill=(95,95,95),width=1); text(x,yy+10,fmt(ts),font=f13,anchor='ma',col=(70,70,70))
for p in [0,1]:
    a,b=panels[p]; d.line([xb,a,xb,b],fill=(205,205,205),width=2)
text(xb-8,panels[0][0]+10,'2.0 首包 →',font=f13,anchor='ra',col=(120,120,120))
text(L,IH-48,'窗口=30 枚（min 15）· ts 合并 lineage.tsv + lineage-g3.tsv · n=926（v7 831 / 2.0 95）· Hp5 903、Hplong5 849',font=f13,col=(90,90,90))
text(L,IH-25,'数据：champion-map/coords-gen3-1105.tsv · 图/表：scratch/my-review-1111/exam-old-vs-new.png/.csv',font=f12,col=(140,140,140))
img.save(r'D:/code/Epirus-Web/scratch/my-review-1111/exam-old-vs-new.png')
print('saved', img.size)
