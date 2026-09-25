import{C as e,D as t,M as n,N as r,O as i,S as a,w as o,x as s}from"./CanvasPool-DecUtJxW.js";import{a as c}from"./unites-BqHPujbo.js";import{S as l,c as u,m as d,u as f}from"./Filter-CTLKor2l.js";import{a as p,n as m}from"./BitmapFont-tJLClOv7.js";var h=class extends u{constructor(e,t){let{text:n,resolution:r,style:i,anchor:a,width:o,height:s,roundPixels:c,...u}=e;super({...u}),this.batched=!0,this._resolution=null,this._autoResolution=!0,this._didTextUpdate=!0,this._styleClass=t,this.text=n??``,this.style=i,this.resolution=r??null,this.allowChildren=!1,this._anchor=new l({_onUpdate:()=>{this.onViewUpdate()}}),a&&(this.anchor=a),this.roundPixels=c??!1,o!==void 0&&(this.width=o),s!==void 0&&(this.height=s)}get anchor(){return this._anchor}set anchor(e){typeof e==`number`?this._anchor.set(e):this._anchor.copyFrom(e)}set text(e){e=e.toString(),this._text!==e&&(this._text=e,this.onViewUpdate())}get text(){return this._text}set resolution(e){this._autoResolution=e===null,this._resolution=e,this.onViewUpdate()}get resolution(){return this._resolution}get style(){return this._style}set style(e){e||={},this._style?.off(`update`,this.onViewUpdate,this),this._style=e instanceof this._styleClass?e:new this._styleClass(e),this._style.on(`update`,this.onViewUpdate,this),this.onViewUpdate()}get width(){return Math.abs(this.scale.x)*this.bounds.width}set width(e){this._setWidth(e,this.bounds.width)}get height(){return Math.abs(this.scale.y)*this.bounds.height}set height(e){this._setHeight(e,this.bounds.height)}getSize(e){return e||={},e.width=Math.abs(this.scale.x)*this.bounds.width,e.height=Math.abs(this.scale.y)*this.bounds.height,e}setSize(e,t){typeof e==`object`?(t=e.height??e.width,e=e.width):t??=e,e!==void 0&&this._setWidth(e,this.bounds.width),t!==void 0&&this._setHeight(t,this.bounds.height)}containsPoint(e){let t=this.bounds.width,n=this.bounds.height,r=-t*this.anchor.x,i=0;return e.x>=r&&e.x<=r+t&&(i=-n*this.anchor.y,e.y>=i&&e.y<=i+n)}onViewUpdate(){this.didViewUpdate||(this._didTextUpdate=!0),super.onViewUpdate()}destroy(e=!1){this._style?.off(`update`,this.onViewUpdate,this),super.destroy(e),this.owner=null,this._bounds=null,this._anchor=null,(typeof e==`boolean`?e:e?.style)&&this._style.destroy(e),this._style=null,this._text=null}get styleKey(){return`${this._text}:${this._style.styleKey}:${this._resolution}`}};function g(e,t){let i=e[0]??{};return(typeof i==`string`||e[1])&&(n(r,`use new ${t}({ text: "hi!", style }) instead`),i={text:i,style:e[1]}),i}var _=!1;function v(e){if(_)return;let t=new i({scaleMode:e.scaleMode});e._resourceId!==t._resourceId&&(_=!0,s(`Text textureStyle: only scaleMode is applied to a text texture, the other fields are ignored`))}var y=class extends h{constructor(...e){let n=g(e,`Text`);super(n,m),this.renderPipeId=`text`,n.textureStyle&&(this.textureStyle=n.textureStyle instanceof i?n.textureStyle:new i(n.textureStyle),v(this.textureStyle)),this.autoGenerateMipmaps=n.autoGenerateMipmaps??t.defaultOptions.autoGenerateMipmaps}updateBounds(){let e=this._bounds,t=this._anchor,n=0,r=0;if(this._style.trim){let{frame:e,canvasAndContext:t}=c.getCanvasAndContext({text:this.text,style:this._style,resolution:1});c.returnCanvasAndContext(t),n=e.width,r=e.height}else{let e=p.measureText(this._text,this._style);n=e.width,r=e.height}e.minX=-t._x*n,e.maxX=e.minX+n,e.minY=-t._y*r,e.maxY=e.minY+r}},b=class e{constructor(t){if(t instanceof o)this.texture=t,f(this,e.defaultOptions,{});else{let n={...e.defaultOptions,...t};f(this,n,{})}}get alpha(){return this._alpha}set alpha(e){this._alpha=Math.min(Math.max(e,0),1),this._updateColor()}get tint(){return d(this._tint)}set tint(e){this._tint=a.shared.setValue(e??16777215).toBgrNumber(),this._updateColor()}_updateColor(){this.color=this._tint+((this._alpha*255|0)<<24)}};b.defaultOptions={anchorX:0,anchorY:0,x:0,y:0,scaleX:1,scaleY:1,rotation:0,tint:16777215,alpha:1};var x=b,S={vertex:{attributeName:`aVertex`,format:`float32x2`,code:`
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
        `,dynamic:!1},position:{attributeName:`aPosition`,format:`float32x2`,code:`
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
        `,dynamic:!0},rotation:{attributeName:`aRotation`,format:`float32`,code:`
            var rotation = p.rotation;

            f32v[offset] = rotation;
            f32v[offset + stride] = rotation;
            f32v[offset + (stride * 2)] = rotation;
            f32v[offset + (stride * 3)] = rotation;
        `,dynamic:!1},uvs:{attributeName:`aUV`,format:`float32x2`,code:`
            var uvs = p.texture.uvs;

            f32v[offset] = uvs.x0;
            f32v[offset + 1] = uvs.y0;

            f32v[offset + stride] = uvs.x1;
            f32v[offset + stride + 1] = uvs.y1;

            f32v[offset + (stride * 2)] = uvs.x2;
            f32v[offset + (stride * 2) + 1] = uvs.y2;

            f32v[offset + (stride * 3)] = uvs.x3;
            f32v[offset + (stride * 3) + 1] = uvs.y3;
        `,dynamic:!1},color:{attributeName:`aColor`,format:`unorm8x4`,code:`
            const c = p.color;

            u32v[offset] = c;
            u32v[offset + stride] = c;
            u32v[offset + (stride * 2)] = c;
            u32v[offset + (stride * 3)] = c;
        `,dynamic:!1}},C=new e(0,0,0,0),w=class e extends u{constructor(t={}){t={...e.defaultOptions,...t,dynamicProperties:{...e.defaultOptions.dynamicProperties,...t?.dynamicProperties}};let{dynamicProperties:n,shader:r,roundPixels:i,texture:a,particles:o,...s}=t;super({label:`ParticleContainer`,...s}),this.renderPipeId=`particle`,this.batched=!1,this._childrenDirty=!1,this.texture=a||null,this.shader=r,this._properties={};for(let e in S){let t=S[e],r=n[e];this._properties[e]={...t,dynamic:r}}this.allowChildren=!0,this.roundPixels=i??!1,this.particleChildren=o??[]}addParticle(...e){for(let t=0;t<e.length;t++)this.particleChildren.push(e[t]);return this.onViewUpdate(),e[0]}removeParticle(...e){let t=!1;for(let n=0;n<e.length;n++){let r=this.particleChildren.indexOf(e[n]);r>-1&&(this.particleChildren.splice(r,1),t=!0)}return t&&this.onViewUpdate(),e[0]}update(){this._childrenDirty=!0}onViewUpdate(){this._childrenDirty=!0,super.onViewUpdate()}get bounds(){return C}updateBounds(){}destroy(e=!1){if(super.destroy(e),typeof e==`boolean`?e:e?.texture){let t=typeof e==`boolean`?e:e?.textureSource,n=this.texture??this.particleChildren[0]?.texture;n&&n.destroy(t)}this.texture=null,this.shader?.destroy()}removeParticles(e,t){e??=0,t??=this.particleChildren.length;let n=this.particleChildren.splice(e,t-e);return this.onViewUpdate(),n}removeParticleAt(e){let t=this.particleChildren.splice(e,1);return this.onViewUpdate(),t[0]}addParticleAt(e,t){return this.particleChildren.splice(t,0,e),this.onViewUpdate(),e}addChild(...e){throw Error(`ParticleContainer.addChild() is not available. Please use ParticleContainer.addParticle()`)}removeChild(...e){throw Error(`ParticleContainer.removeChild() is not available. Please use ParticleContainer.removeParticle()`)}removeChildren(e,t){throw Error(`ParticleContainer.removeChildren() is not available. Please use ParticleContainer.removeParticles()`)}removeChildAt(e){throw Error(`ParticleContainer.removeChildAt() is not available. Please use ParticleContainer.removeParticleAt()`)}getChildAt(e){throw Error(`ParticleContainer.getChildAt() is not available. Please use ParticleContainer.getParticleAt()`)}setChildIndex(e,t){throw Error(`ParticleContainer.setChildIndex() is not available. Please use ParticleContainer.setParticleIndex()`)}getChildIndex(e){throw Error(`ParticleContainer.getChildIndex() is not available. Please use ParticleContainer.getParticleIndex()`)}addChildAt(e,t){throw Error(`ParticleContainer.addChildAt() is not available. Please use ParticleContainer.addParticleAt()`)}swapChildren(e,t){throw Error(`ParticleContainer.swapChildren() is not available. Please use ParticleContainer.swapParticles()`)}reparentChild(...e){throw Error(`ParticleContainer.reparentChild() is not available with the particle container`)}reparentChildAt(e,t){throw Error(`ParticleContainer.reparentChildAt() is not available with the particle container`)}};w.defaultOptions={dynamicProperties:{vertex:!1,position:!0,rotation:!1,uvs:!1,color:!1},roundPixels:!1};var T=w,E=new Map;function D(e=64){let t=`tache:${e}`,n=E.get(t);if(n)return n;let r=document.createElement(`canvas`);r.width=r.height=e;let i=r.getContext(`2d`);if(!i)throw Error(`canvas 2d indisponible`);let a=e/2,s=i.createRadialGradient(a,a,0,a,a,a);s.addColorStop(0,`rgba(255,255,255,1)`),s.addColorStop(.25,`rgba(255,255,255,0.55)`),s.addColorStop(1,`rgba(255,255,255,0)`),i.fillStyle=s,i.fillRect(0,0,e,e);let c=o.from(r);return E.set(t,c),c}function O(e=.55){let t=`vig:${e}`,n=E.get(t);if(n)return n;let r=document.createElement(`canvas`);r.width=480,r.height=270;let i=r.getContext(`2d`);if(!i)throw Error(`canvas 2d indisponible`);i.translate(240,135),i.scale(1,270/480);let a=i.createRadialGradient(0,0,120,0,0,300);a.addColorStop(0,`rgba(0,0,0,0)`),a.addColorStop(1,`rgba(4,2,8,${e})`),i.fillStyle=a,i.fillRect(-300,-300,600,600);let s=o.from(r);return E.set(t,s),s}function k(e,t,n=128,r=0){let i=`deg:${e}:${t}:${n}:${r}`,a=E.get(i);if(a)return a;let s=document.createElement(`canvas`);s.width=4,s.height=n;let c=s.getContext(`2d`);if(!c)throw Error(`canvas 2d indisponible`);let l=c.createLinearGradient(0,0,0,n);l.addColorStop(0,e),r>0&&l.addColorStop(r,e),l.addColorStop(1,t),c.fillStyle=l,c.fillRect(0,0,4,n);let u=o.from(s);return E.set(i,u),u}export{x as a,T as i,D as n,y as o,O as r,k as t};