// △N ganz: Maschenstreckung (Diagonale p-q : p+q = 1 : sqrt3 ist regulaer) und Dreieckszaehlung
const S3=Math.sqrt(3);
function px(W,H,a,b,p,q){const v=p+q;return [W*p/v,H*a*(b-v)/((b-a)*v)];}
function info(a,b,W,H,tri){let n=0,stretch=1;const e=1e-4;
 for(let i=0;i<b;i++)for(let j=0;j<b;j++){for(const up of [0,1]){
  const v=up?[[i+1,j],[i,j+1],[i+1,j+1]]:[[i,j],[i+1,j],[i,j+1]];
  const vs=v.map(P=>P[0]+P[1]);if(Math.min(...vs)>=a&&Math.max(...vs)<=b&&v.every(P=>P[0]>=0&&P[1]>=0)){n++;
   const c=[(v[0][0]+v[1][0]+v[2][0])/3,(v[0][1]+v[1][1]+v[2][1])/3];
   const A=px(W,H,a,b,c[0]-e,c[1]+e),B=px(W,H,a,b,c[0]+e,c[1]-e),C=px(W,H,a,b,c[0]-e,c[1]-e),D=px(W,H,a,b,c[0]+e,c[1]+e);
   let asp=Math.abs(B[0]-A[0])/Math.abs(D[1]-C[1]);if(tri)asp*=S3;stretch=Math.max(stretch,asp,1/asp);}}}
 return {W:n,stretch};}
console.log('Zaehlung W (Dreiecke) = b^2-a^2:',[[2,4],[3,6],[1,3],[3,5]].map(([a,b])=>`${a},${b}: ${info(a,b,600,600,1).W} (Formel ${b*b-a*a})`).join(' | '));
for(const r of [0.5,0.75,1,1.5,2]){const H=600,W=600*r,l=[];
 for(let b=2;b<=9;b++)for(let a=1;a<b;a++){const t=info(a,b,W,H,1),s=info(a,b,W,H,0);if(t.W>=8&&t.W<=16&&t.stretch<=2)l.push({k:a+','+b,W:t.W,st:+t.stretch.toFixed(2)});}
 l.sort((x,y)=>x.st-y.st);console.log('B:H',r,l.slice(0,8).map(x=>`${x.k}(W${x.W},${x.st})`).join(' '));}
// bestes Verhaeltnis (2,4)
let best=null;for(let r=0.3;r<3;r+=0.01){const t=info(2,4,600*r,600,1);if(!best||t.stretch<best.s)best={r:+r.toFixed(2),s:+t.stretch.toFixed(2)};}console.log('beste B:H fuer 2,4 ganz Dreieck',best);
console.log('2,4 bei B:H 1.34 (Fig.159 gedreht gelesen):',info(2,4,600*1.34,600,1).stretch.toFixed(2),'; Quadrat-Definition (ohne sqrt3):',info(2,4,600*1.34,600,0).stretch.toFixed(2));
