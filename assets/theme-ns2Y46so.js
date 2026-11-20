import{d as f,y as P,z as M,B as T,q as C,D as A,E as I,H as k,V as O,I as V,F as m,p as w,C as b,G as B,T as $}from"./index-gQBdTLAK.js";const _=class p{constructor(e){if(e instanceof f)this.texture=e,P(this,p.defaultOptions,{});else{const t={...p.defaultOptions,...e};P(this,t,{})}}get alpha(){return this._alpha}set alpha(e){this._alpha=Math.min(Math.max(e,0),1),this._updateColor()}get tint(){return M(this._tint)}set tint(e){this._tint=T.shared.setValue(e??16777215).toBgrNumber(),this._updateColor()}_updateColor(){this.color=this._tint+((this._alpha*255|0)<<24)}};_.defaultOptions={anchorX:0,anchorY:0,x:0,y:0,scaleX:1,scaleY:1,rotation:0,tint:16777215,alpha:1};let D=_;const y={vertex:{attributeName:"aVertex",format:"float32x2",code:`
            const texture = p.texture;
            const sx = p.scaleX;
            const sy = p.scaleY;
            const ax = p.anchorX;
            const ay = p.anchorY;
            const trim = texture.trim;
            const orig = texture.orig;

            if (trim)
            {
                w1 = trim.x - (ax * orig.width);
                w0 = w1 + trim.width;

                h1 = trim.y - (ay * orig.height);
                h0 = h1 + trim.height;
            }
            else
            {
                w1 = -ax * (orig.width);
                w0 = w1 + orig.width;

                h1 = -ay * (orig.height);
                h0 = h1 + orig.height;
            }

            f32v[offset] = w1 * sx;
            f32v[offset + 1] = h1 * sy;

            f32v[offset + stride] = w0 * sx;
            f32v[offset + stride + 1] = h1 * sy;

            f32v[offset + (stride * 2)] = w0 * sx;
            f32v[offset + (stride * 2) + 1] = h0 * sy;

            f32v[offset + (stride * 3)] = w1 * sx;
            f32v[offset + (stride * 3) + 1] = h0 * sy;
        `,dynamic:!1},position:{attributeName:"aPosition",format:"float32x2",code:`
            var x = p.x;
            var y = p.y;

            f32v[offset] = x;
            f32v[offset + 1] = y;

            f32v[offset + stride] = x;
            f32v[offset + stride + 1] = y;

            f32v[offset + (stride * 2)] = x;
            f32v[offset + (stride * 2) + 1] = y;

            f32v[offset + (stride * 3)] = x;
            f32v[offset + (stride * 3) + 1] = y;
        `,dynamic:!0},rotation:{attributeName:"aRotation",format:"float32",code:`
            var rotation = p.rotation;

            f32v[offset] = rotation;
            f32v[offset + stride] = rotation;
            f32v[offset + (stride * 2)] = rotation;
            f32v[offset + (stride * 3)] = rotation;
        `,dynamic:!1},uvs:{attributeName:"aUV",format:"float32x2",code:`
            var uvs = p.texture.uvs;

            f32v[offset] = uvs.x0;
            f32v[offset + 1] = uvs.y0;

            f32v[offset + stride] = uvs.x1;
            f32v[offset + stride + 1] = uvs.y1;

            f32v[offset + (stride * 2)] = uvs.x2;
            f32v[offset + (stride * 2) + 1] = uvs.y2;

            f32v[offset + (stride * 3)] = uvs.x3;
            f32v[offset + (stride * 3) + 1] = uvs.y3;
        `,dynamic:!1},color:{attributeName:"aColor",format:"unorm8x4",code:`
            const c = p.color;

            u32v[offset] = c;
            u32v[offset + stride] = c;
            u32v[offset + (stride * 2)] = c;
            u32v[offset + (stride * 3)] = c;
        `,dynamic:!1}};C.add(A);C.add(I);C.add(k);const G=new V(0,0,0,0),E=class x extends O{constructor(e={}){e={...x.defaultOptions,...e,dynamicProperties:{...x.defaultOptions.dynamicProperties,...e?.dynamicProperties}};const{dynamicProperties:t,shader:i,roundPixels:r,texture:s,particles:o,...n}=e;super({label:"ParticleContainer",...n}),this.renderPipeId="particle",this.batched=!1,this._childrenDirty=!1,this.texture=s||null,this.shader=i,this._properties={};for(const l in y){const c=y[l],h=t[l];this._properties[l]={...c,dynamic:h}}this.allowChildren=!0,this.roundPixels=r??!1,this.particleChildren=o??[]}addParticle(...e){for(let t=0;t<e.length;t++)this.particleChildren.push(e[t]);return this.onViewUpdate(),e[0]}removeParticle(...e){let t=!1;for(let i=0;i<e.length;i++){const r=this.particleChildren.indexOf(e[i]);r>-1&&(this.particleChildren.splice(r,1),t=!0)}return t&&this.onViewUpdate(),e[0]}update(){this._childrenDirty=!0}onViewUpdate(){this._childrenDirty=!0,super.onViewUpdate()}get bounds(){return G}updateBounds(){}destroy(e=!1){if(super.destroy(e),typeof e=="boolean"?e:e?.texture){const i=typeof e=="boolean"?e:e?.textureSource,r=this.texture??this.particleChildren[0]?.texture;r&&r.destroy(i)}this.texture=null,this.shader?.destroy()}removeParticles(e,t){e??(e=0),t??(t=this.particleChildren.length);const i=this.particleChildren.splice(e,t-e);return this.onViewUpdate(),i}removeParticleAt(e){const t=this.particleChildren.splice(e,1);return this.onViewUpdate(),t[0]}addParticleAt(e,t){return this.particleChildren.splice(t,0,e),this.onViewUpdate(),e}addChild(...e){throw new Error("ParticleContainer.addChild() is not available. Please use ParticleContainer.addParticle()")}removeChild(...e){throw new Error("ParticleContainer.removeChild() is not available. Please use ParticleContainer.removeParticle()")}removeChildren(e,t){throw new Error("ParticleContainer.removeChildren() is not available. Please use ParticleContainer.removeParticles()")}removeChildAt(e){throw new Error("ParticleContainer.removeChildAt() is not available. Please use ParticleContainer.removeParticleAt()")}getChildAt(e){throw new Error("ParticleContainer.getChildAt() is not available. Please use ParticleContainer.getParticleAt()")}setChildIndex(e,t){throw new Error("ParticleContainer.setChildIndex() is not available. Please use ParticleContainer.setParticleIndex()")}getChildIndex(e){throw new Error("ParticleContainer.getChildIndex() is not available. Please use ParticleContainer.getParticleIndex()")}addChildAt(e,t){throw new Error("ParticleContainer.addChildAt() is not available. Please use ParticleContainer.addParticleAt()")}swapChildren(e,t){throw new Error("ParticleContainer.swapChildren() is not available. Please use ParticleContainer.swapParticles()")}reparentChild(...e){throw new Error("ParticleContainer.reparentChild() is not available with the particle container")}reparentChildAt(e,t){throw new Error("ParticleContainer.reparentChildAt() is not available with the particle container")}};E.defaultOptions={dynamicProperties:{vertex:!1,position:!0,rotation:!1,uvs:!1,color:!1},roundPixels:!1};let N=E;const d=new Map;function z(a=64){const e=`tache:${a}`,t=d.get(e);if(t)return t;const i=document.createElement("canvas");i.width=i.height=a;const r=i.getContext("2d");if(!r)throw Error("canvas 2d indisponible");const s=a/2,o=r.createRadialGradient(s,s,0,s,s,s);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.25,"rgba(255,255,255,0.55)"),o.addColorStop(1,"rgba(255,255,255,0)"),r.fillStyle=o,r.fillRect(0,0,a,a);const n=f.from(i);return d.set(e,n),n}function q(a=.55){const e=`vig:${a}`,t=d.get(e);if(t)return t;const i=document.createElement("canvas");i.width=480,i.height=270;const r=i.getContext("2d");if(!r)throw Error("canvas 2d indisponible");r.translate(240,135),r.scale(1,270/480);const s=r.createRadialGradient(0,0,120,0,0,300);s.addColorStop(0,"rgba(0,0,0,0)"),s.addColorStop(1,`rgba(4,2,8,${a})`),r.fillStyle=s,r.fillRect(-300,-300,600,600);const o=f.from(i);return d.set(e,o),o}function J(a,e,t=128,i=0){const r=`deg:${a}:${e}:${t}:${i}`,s=d.get(r);if(s)return s;const o=document.createElement("canvas");o.width=4,o.height=t;const n=o.getContext("2d");if(!n)throw Error("canvas 2d indisponible");const l=n.createLinearGradient(0,0,0,t);l.addColorStop(0,a),i>0&&l.addColorStop(i,a),l.addColorStop(1,e),n.fillStyle=l,n.fillRect(0,0,4,t);const c=f.from(o);return d.set(r,c),c}function H(a=256){const e=`grain:${a}`,t=d.get(e);if(t)return t;const i=document.createElement("canvas");i.width=i.height=a;const r=i.getContext("2d");if(!r)throw Error("canvas 2d indisponible");const s=r.createImageData(a,a),o=new m(`render|grain|${a}`);for(let l=0;l<s.data.length;l+=4){const c=o.randf()<.5?0:255;s.data[l]=s.data[l+1]=s.data[l+2]=c,s.data[l+3]=Math.floor(o.randf()*22)}r.putImageData(s,0,0);const n=f.from(i);return d.set(e,n),n}function Z(){const a="eclair",e=d.get(a);if(e)return e;const t=document.createElement("canvas");t.width=160,t.height=420;const i=t.getContext("2d");if(!i)throw Error("canvas 2d indisponible");const r=new m("render|eclair"),s=[];let o=80;for(let c=0;c<=10;c++)s.push([o,c/10*400+10]),o+=r.randfRange(-26,26),o=Math.max(24,Math.min(136,o));const n=(c,h)=>{i.beginPath(),i.moveTo(s[0][0],s[0][1]);for(const[u,S]of s)i.lineTo(u,S);i.strokeStyle=h,i.lineWidth=c,i.lineJoin="round",i.lineCap="round",i.stroke()};n(16,"rgba(120,160,255,0.18)"),n(7,"rgba(170,200,255,0.5)"),n(2.5,"rgba(240,248,255,0.95)");for(const c of[3,6]){const[h,u]=s[c];i.beginPath(),i.moveTo(h,u),i.lineTo(h+r.randfRange(-40,40),u+r.randfRange(24,60)),i.strokeStyle="rgba(190,215,255,0.55)",i.lineWidth=2,i.stroke()}const l=f.from(t);return d.set(a,l),l}const U={braises:{couleurs:[16752704,16738848,16765056],taille:[.05,.22],vx:[-18,18],vy:[-90,-25],vie:[4,11],ondulation:22,additif:!0,etire:!1,scintille:!0},ames:{couleurs:[12098303,9099519,14733567],taille:[.15,.4],vx:[-10,10],vy:[-45,-15],vie:[6,12],ondulation:30,additif:!0,etire:!1,scintille:!1},neige:{couleurs:[16777215,14741759],taille:[.06,.18],vx:[-30,10],vy:[40,110],vie:[8,14],ondulation:25,additif:!1,etire:!1,scintille:!1},pluie:{couleurs:[11057368,13161710],taille:[.05,.08],vx:[-160,-120],vy:[900,1200],vie:[1.2,1.8],ondulation:0,additif:!1,etire:!0,scintille:!1},petales:{couleurs:[16769260,16777215,16763100],taille:[.07,.14],vx:[20,60],vy:[25,60],vie:[8,14],ondulation:40,additif:!1,etire:!1,scintille:!1},lumieres:{couleurs:[16773296,16769152,16777215],taille:[.04,.14],vx:[-15,15],vy:[-25,10],vie:[5,10],ondulation:18,additif:!0,etire:!1,scintille:!0},poussiere:{couleurs:[14207200,12101832],taille:[.03,.08],vx:[-12,12],vy:[-8,8],vie:[6,12],ondulation:12,additif:!0,etire:!1,scintille:!0},spores:{couleurs:[10354608,7334088,14221210],taille:[.08,.26],vx:[-14,14],vy:[-32,-8],vie:[6,13],ondulation:26,additif:!0,etire:!1,scintille:!0},cendres:{couleurs:[13617344,10130316,15262426],taille:[.05,.16],vx:[-26,6],vy:[18,55],vie:[7,13],ondulation:20,additif:!1,etire:!1,scintille:!1}},X=120;class j extends b{constructor(e,t,i,r,s){super(),this.liste=[],this.tex=e,this.type=t,this.largeur=i,this.hauteur=r,this.regles=U[t],this.flux=new m(`decor|particules|${t}`),this.conteneur=new N({dynamicProperties:{position:!0,color:!0,vertex:!0,rotation:!0}}),this.regles.additif&&(this.conteneur.blendMode="add"),this.addChild(this.conteneur);const o=Math.min(s,X);for(let n=0;n<o;n++){const l=this.nouvelle();l.vie=this.flux.randf()*l.duree,l.p.x=this.flux.randf()*this.largeur,l.p.y=this.flux.randf()*this.hauteur,this.liste.push(l),this.conteneur.addParticle(l.p)}}nouvelle(e){const t=this.flux,i=this.regles,r=e?.p??new D({texture:this.tex,anchorX:.5,anchorY:.5}),s=t.randfRange(i.taille[0],i.taille[1]);r.scaleX=s,r.scaleY=i.etire?s*9:s,r.tint=t.choisir(i.couleurs);const o=t.randfRange(i.vx[0],i.vx[1]),n=t.randfRange(i.vy[0],i.vy[1]);r.x=t.randf()*(this.largeur+200)-100,r.y=n<0?this.hauteur+20:n>0?-20:t.randf()*this.hauteur,i.etire&&(r.rotation=Math.atan2(n,o)-Math.PI/2);const l=e??{p:r,vx:o,vy:n,vie:0,duree:1,phase:0};return l.vx=o,l.vy=n,l.vie=0,l.duree=t.randfRange(i.vie[0],i.vie[1]),l.phase=t.randf()*Math.PI*2,l}mettreAJour(e){const t=this.regles;for(let i=0;i<this.liste.length;i++){const r=this.liste[i];r.vie+=e;const s=r.p;if(r.vie>=r.duree||s.y<-40||s.y>this.hauteur+40||s.x<-150||s.x>this.largeur+150){this.nouvelle(r);continue}const o=r.vie/r.duree;s.x+=(r.vx+Math.sin(r.vie*1.7+r.phase)*t.ondulation)*e,s.y+=r.vy*e,!t.etire&&(this.type==="petales"||this.type==="neige"||this.type==="cendres")&&(s.rotation+=e*(r.phase-Math.PI));const n=Math.min(1,o*6)*Math.min(1,(1-o)*4);s.alpha=t.scintille?n*(.6+.4*Math.sin(r.vie*9+r.phase)):n*(t.etire?.55:.9)}}}function K(a,e){return a.toFixed(e).replace(".",",")}const F='"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',Y='"Segoe UI", "Trebuchet MS", sans-serif',v=15255672,g=9071150,R=15983280;function L(a,e=R){return new w({fontFamily:F,fontSize:a,fontWeight:"600",fill:e,letterSpacing:a*.12,stroke:{color:1707782,width:Math.max(3,a/9)}})}function Q(a,e=16052196){return new w({fontFamily:Y,fontSize:a,fill:e,fontWeight:"500",stroke:{color:0,width:3},dropShadow:{color:0,alpha:.6,blur:3,distance:2,angle:Math.PI/2}})}function ee(a,e,t,i,r,s=.82){a.roundRect(e,t,i,r,14).fill({color:723216,alpha:s}),a.roundRect(e,t,i,r,14).stroke({color:v,width:2.5,alpha:.95}),a.roundRect(e+7,t+7,i-14,r-14,9).stroke({color:g,width:1.2,alpha:.9});for(const[o,n]of[[e,t],[e+i,t],[e,t+r],[e+i,t+r]])a.poly([o-9,n,o,n-9,o+9,n,o,n+9]).fill(g).stroke({color:v,width:1.5});return a}class te extends b{constructor(e,t=460,i=64,r=()=>{}){super(),this.fond=new B,this.selectionne=!1,this.actif=!0,this.largeur=t,this.hauteur=i,this.action=r,this.texte=new $({text:e,style:L(30)}),this.texte.anchor.set(.5),this.texte.position.set(t/2,i/2),this.addChild(this.fond,this.texte),this.eventMode="static",this.cursor="pointer",this.dessiner()}set libelle(e){this.texte.text=e}dessiner(){const e=this.fond;e.clear();const t=this.selectionne&&this.actif;if(e.roundRect(0,0,this.largeur,this.hauteur,10).fill({color:t?3811858:920338,alpha:t?.92:.7}),e.roundRect(0,0,this.largeur,this.hauteur,10).stroke({color:t?16770720:g,width:t?3:1.5}),t){e.roundRect(-4,-4,this.largeur+8,this.hauteur+8,13).stroke({color:v,width:1,alpha:.5});for(const i of[-1,1]){const r=i<0?-26:this.largeur+26,s=this.hauteur/2;e.poly([r,s,r-i*14,s-10,r-i*14,s+10]).fill(v)}}this.texte.style.fill=this.actif?t?16773836:R:6971496,this.texte.scale.set(t?1.04:1)}}export{te as B,j as C,v as O,N as P,q as a,Q as b,g as c,ee as d,J as e,D as f,Z as g,H as h,K as n,L as s,z as t};
